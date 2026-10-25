// P4-29: Journey segment disclosure focus/accessibility checks (PR #32).
// Usage: node qa/p4-29-journey-disclosure-check.cjs <baseURL> [--baseline]
// --baseline runs against the parent build; checks of the new inert/focus contract are reported as BASELINE instead of FAIL.
const { chromium } = require("playwright");
const base = process.argv[2] || "http://127.0.0.1:4173";
const baselineMode = process.argv.includes("--baseline");
let pass = 0, fail = 0, gaps = 0;
const check = (name, ok, detail = "", contract = false) => {
  if (!ok && contract && baselineMode) { gaps++; console.log(`BASELINE ${name}${detail ? " — " + detail : ""}`); return; }
  ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};
const TRIP = "regional-connection";
const toggles = (p) => p.locator("article button[aria-controls^='segment-details-']");
const info = (p) => p.evaluate(() => {
  const a = document.activeElement;
  return { tag: a?.tagName, text: (a?.textContent || "").trim().slice(0, 40), controls: a?.getAttribute?.("aria-controls") || null,
    inDetails: !!a?.closest?.("[id^='segment-details-']"), isBody: a === document.body };
});
const containers = (p) => p.$$eval("[id^='segment-details-']", (cs) => cs.map((c) => ({ id: c.id, inert: c.hasAttribute("inert"), hidden: c.getAttribute("aria-hidden") })));
async function tabWalk(p, max = 80) {
  await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await p.locator("body").focus().catch(() => {});
  const seen = [];
  for (let i = 0; i < max; i++) {
    await p.keyboard.press("Tab");
    const a = await info(p);
    if (a.isBody) break;
    seen.push(a);
  }
  return seen;
}
async function axTicketNames(p, cdp) {
  const { nodes } = await cdp.send("Accessibility.getFullAXTree");
  return nodes.filter((n) => !n.ignored && n.role?.value === "link" && /^Get tickets from/.test(n.name?.value || "")).map((n) => n.name.value);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const cdp = await ctx.newCDPSession(page);
  await page.goto(`${base}/journey/${TRIP}`); await page.waitForSelector("article time");
  const n = await toggles(page).count();
  check(`K0 ${TRIP}: ${n} segment disclosure toggles found`, n >= 2, `${n}`);

  // K1/K2 collapsed: inert + aria-hidden, links not tabbable, not in AX tree
  let cs = await containers(page);
  check("K1 all collapsed containers carry inert and aria-hidden=true", cs.every((c) => c.inert && c.hidden === "true"), JSON.stringify(cs.map((c) => [c.inert, c.hidden])), true);
  let walk = await tabWalk(page);
  const ticketTabs = walk.filter((w) => w.inDetails);
  check("K2 Tab never reaches a collapsed ticket link", ticketTabs.length === 0, `${ticketTabs.length} collapsed-detail stops of ${walk.length}: ${ticketTabs.map((t) => t.text).join(" | ")}`, true);
  let ax = await axTicketNames(page, cdp);
  check("K3 collapsed ticket links are absent from the accessibility tree", ax.length === 0, ax.join(" | "), true);

  // K4 pointer expand: focus on toggle, contents accessible, next Tab reaches its link
  await toggles(page).nth(0).click();
  let a = await info(page);
  check("K4 pointer click expands card 1 and focus is on its toggle", a.controls && (await toggles(page).nth(0).getAttribute("aria-expanded")) === "true", JSON.stringify(a));
  cs = await containers(page);
  check("K5 only card 1's container is non-inert and aria-hidden=false (others stay inert)", !cs[0].inert && cs[0].hidden === "false" && cs.slice(1).every((c) => c.inert), JSON.stringify(cs.map((c) => c.inert)), true);
  await page.keyboard.press("Tab");
  a = await info(page);
  check("K6 Tab from the expanded toggle reaches its ticket link", a.inDetails && /^Get tickets from/.test(a.text), JSON.stringify(a));
  ax = await axTicketNames(page, cdp);
  check("K7 exactly one ticket link is exposed to the accessibility tree", ax.length === 1, ax.join(" | "), true);

  // K8 keyboard Enter/Space toggles keep focus on the toggle
  await toggles(page).nth(0).focus();
  await page.keyboard.press("Enter");
  a = await info(page);
  check("K8 Enter collapses card 1; focus stays on its toggle", (await toggles(page).nth(0).getAttribute("aria-expanded")) === "false" && a.controls === (await toggles(page).nth(0).getAttribute("aria-controls")), JSON.stringify(a));
  await page.keyboard.press("Space");
  a = await info(page);
  check("K9 Space expands card 1; focus stays on its toggle", (await toggles(page).nth(0).getAttribute("aria-expanded")) === "true" && a.controls === (await toggles(page).nth(0).getAttribute("aria-controls")), JSON.stringify(a));

  // K10 switching cards: focus inside card 1 link, then pointer-open card 2 — focus must stay on toggle 2
  await page.keyboard.press("Tab");
  await toggles(page).nth(1).click();
  a = await info(page);
  check("K10 opening card 2 while focus was in card 1's link: card 1 collapses, focus on toggle 2 (not stolen back)", (await toggles(page).nth(0).getAttribute("aria-expanded")) === "false" && a.controls === (await toggles(page).nth(1).getAttribute("aria-controls")), JSON.stringify(a));

  // K11 Reset by pointer while focus inside card 2's link: focus stays on Reset
  await page.keyboard.press("Tab");
  const resetBtn = page.getByRole("button", { name: "Reset", exact: true });
  await resetBtn.click();
  a = await info(page);
  check("K11 Reset (pointer) collapses all; focus stays on Reset (no steal)", (await containers(page)).every((c) => c.inert || baselineMode) && a.text === "Reset", JSON.stringify(a));

  // K12 external collapse while focus is inside the open details (Reset dispatched without moving focus)
  await toggles(page).nth(0).click();
  await page.keyboard.press("Tab");
  const before = await info(page);
  await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Reset").click());
  await page.waitForTimeout(100);
  a = await info(page);
  check("K12 external collapse while focus was in the details returns focus to that card's toggle", before.inDetails && a.controls === (await toggles(page).nth(0).getAttribute("aria-controls")), `before ${JSON.stringify(before)} after ${JSON.stringify(a)}`, true);

  // K13 trip change via router (popstate) while focus inside open details
  await toggles(page).nth(0).click();
  await page.keyboard.press("Tab");
  await page.evaluate(() => { history.pushState({}, "", "/journey/amtrak-connection"); dispatchEvent(new PopStateEvent("popstate")); });
  await page.waitForFunction(() => location.pathname.endsWith("amtrak-connection"));
  await page.waitForTimeout(300);
  cs = await containers(page);
  a = await info(page);
  check("K13 trip change: new trip's cards all collapsed and inert; focus not left inside hidden details", cs.length > 0 && cs.every((c) => c.inert) && !a.inDetails, `${cs.length} cards, active ${JSON.stringify(a)}`, true);

  // K14 mobile 320px: expanded details visible and link reachable
  const m = await browser.newContext({ viewport: { width: 320, height: 760 }, isMobile: true, hasTouch: true });
  const mp = await m.newPage(); await mp.goto(`${base}/journey/${TRIP}`); await mp.waitForSelector("article time");
  await toggles(mp).nth(0).tap(); await mp.waitForTimeout(400);
  const link = mp.locator("[id^='segment-details-'] a").first();
  const box = await link.boundingBox();
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  check("K14 320px: tap expands; ticket link visible inside viewport; no page overflow", !!box && box.width > 0 && box.x >= 0 && box.x + box.width <= 320 && !overflow, JSON.stringify(box));
  await m.close();

  check("K15 no page or console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${pass}/${pass + fail} P4-29 checks passed${baselineMode ? `; ${gaps} BASELINE contract gaps on the control build` : ""}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
