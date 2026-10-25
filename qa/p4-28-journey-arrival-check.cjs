// P4-28: browser checks for Journey arrival timestamps (PR #31): ISO datetime on arrival <time>, separate original/simulated
// arrivals during the +12-minute delay simulation, visible labels, reset, Journey controls, coach labels, Wallet link, mobile layout.
// Usage: node qa/p4-28-journey-arrival-check.cjs <baseURL> [screenshotDir] [--baseline]
// --baseline: run against the parent build as a control; checks that target the new datetime contract are reported as BASELINE.
const { chromium } = require("playwright");
const fs = require("node:fs");
const base = process.argv[2] || "http://127.0.0.1:4173";
const shots = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : null;
const baselineMode = process.argv.includes("--baseline");
if (shots) fs.mkdirSync(shots, { recursive: true });
let pass = 0, fail = 0, baselineGaps = 0;
const check = (name, ok, detail = "", contract = false) => {
  if (!ok && contract && baselineMode) { baselineGaps++; console.log(`BASELINE ${name}${detail ? " — " + detail : ""}`); return; }
  ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};
// Independent formatter for Eastern-time segment labels: "h:mm AM · Mon D".
const fmt = (iso) => {
  const d = new Date(iso);
  const t = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(d);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(d);
  return `${t} · ${day}`;
};
const norm = (s) => s.replace(/ /g, " ").replace(/\s+/g, " ").trim();
const TRIPS = ["regional-connection", "amtrak-connection", "east-washington--orlando--amtrak", "east-boston--new-york--greyhound", "east-portland--miami--amtrak"];

async function cards(page) {
  return page.$$eval("article", (as) => as.filter((a) => a.querySelector("time")).map((a) => ({
    text: a.innerText,
    times: [...a.querySelectorAll("time")].map((t) => ({ dt: t.getAttribute("datetime"), text: t.textContent, label: t.getAttribute("aria-label"), strike: getComputedStyle(t).textDecorationLine })),
  })));
}
async function axName(page, cdp, selector, index) {
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector });
  const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId: nodeIds[index], fetchRelatives: false });
  const n = nodes[0];
  return { ignored: !!n.ignored, role: n.role?.value, name: n.name?.value ?? "" };
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const id of TRIPS) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${id}: ${e}`));
    page.on("console", (m) => { if (m.type() === "error") errors.push(`${id}: ${m.text()}`); });
    await page.goto(`${base}/journey/${id}`);
    await page.waitForSelector(`#main-content a[href="/wallet/${id}"]`, { timeout: 20000 });
    const before = await cards(page);
    // T1 every segment departure/arrival <time> carries a valid ISO datetime whose label equals the independent formatter
    const all = before.flatMap((c) => c.times);
    const bad = all.filter((t) => !t.dt || !Number.isFinite(Date.parse(t.dt)) || norm(t.text) !== norm(fmt(t.dt)));
    check(`T1 ${id}: ${all.length} segment <time> elements have valid ISO datetime matching their visible Eastern label`, bad.length === 0, bad.slice(0, 2).map((t) => `${t.dt}|${norm(t.text)}`).join(" ; "), true);
    const order = before.every((c) => c.times.length === 2 && (!c.times[0].dt || !c.times[1].dt || Date.parse(c.times[1].dt) >= Date.parse(c.times[0].dt)));
    check(`T2 ${id}: each card has one departure and one arrival; arrival not before departure`, order, `${before.length} cards`);
    if (id === "east-washington--orlando--amtrak") {
      const first = before[0].times;
      check(`T3 ${id}: overnight first leg shows the next calendar date on arrival`, first[1].dt && norm(first[1].text).endsWith("Oct 25") && norm(first[0].text).endsWith("Oct 24"), `${norm(first[0].text)} → ${norm(first[1].text)}`, true);
    }
    if (id.includes("greyhound")) check(`T4 ${id}: coach operator label visible`, /Greyhound/.test(before.map((c) => c.text).join(" ")));

    // Delay simulation
    const sim = page.getByRole("button", { name: "Simulate delay" });
    await sim.click();
    check(`D1 ${id}: Simulate delay toggles aria-pressed=true`, (await page.getByRole("button", { name: "Reset simulation" }).getAttribute("aria-pressed")) === "true");
    const during = await cards(page);
    const f = during[0];
    check(`D2 ${id}: delayed first card shows "Simulated delay: +12 min" and "Arrive (simulated)"`, f.text.includes("Simulated delay: +12 min") && f.text.includes("Arrive (simulated)"));
    check(`D3 ${id}: delayed first card has 3 time elements (departure, original, simulated)`, f.times.length === 3, `${f.times.length}`, true);
    if (f.times.length === 3) {
      const [dep, orig, simt] = f.times;
      check(`D4 ${id}: original arrival keeps the unchanged ISO instant and is struck through`, orig.dt === before[0].times[1].dt && orig.strike.includes("line-through"), `${orig.dt}`, true);
      check(`D5 ${id}: simulated arrival is exactly +12 minutes and its label matches`, Date.parse(simt.dt) - Date.parse(orig.dt) === 12 * 60000 && norm(simt.text) === norm(fmt(simt.dt)), `${orig.dt} → ${simt.dt} "${norm(simt.text)}"`, true);
      check(`D6 ${id}: aria-labels distinguish original and simulated`, (orig.label || "").startsWith("Original sample arrival:") && (simt.label || "").startsWith("Simulated arrival (+12 minutes):"), "", true);
      const cdp = await ctx.newCDPSession(page);
      const a1 = await axName(page, cdp, "article time", 1), a2 = await axName(page, cdp, "article time", 2);
      check(`D7 ${id}: Chromium exposes the purpose labels as accessible names`, !a1.ignored && !a2.ignored && a1.name.startsWith("Original sample arrival") && a2.name.startsWith("Simulated arrival"), `${JSON.stringify(a1)} ${JSON.stringify(a2)}`, true);
    }
    const others = JSON.stringify(during.slice(1).map((c) => c.times)) === JSON.stringify(before.slice(1).map((c) => c.times));
    check(`D8 ${id}: only the first leg changes during simulation`, others);
    await page.getByRole("button", { name: "Reset simulation" }).click();
    check(`D9 ${id}: Reset restores the original itinerary times exactly`, JSON.stringify(await cards(page)) === JSON.stringify(before));

    // Journey controls and Wallet navigation
    if (id === TRIPS[0] || id === TRIPS[3]) {
      await page.getByRole("button", { name: "Start demo journey" }).click();
      const next = page.getByRole("button", { name: "Next step" });
      const multi = before.length > 1;
      if (multi) { await next.click(); await page.getByRole("button", { name: "Previous step" }).click(); }
      else check(`J0 ${id}: single-leg trip disables Next step after Start (one step only)`, await next.isDisabled());
      await page.getByRole("button", { name: /^Reset/ }).first().click();
      check(`J1 ${id}: Start${multi ? " / Next / Previous" : ""} / Reset controls operate; times unchanged`, JSON.stringify(await cards(page)) === JSON.stringify(before));
      await page.click(`#main-content a[href="/wallet/${id}"]`);
      await page.waitForSelector(".ol-ticket-list > li", { timeout: 15000 });
      await page.goBack(); await page.waitForSelector(`#main-content a[href="/wallet/${id}"]`);
      check(`J2 ${id}: Wallet link opens the trip wallet and Back returns to Journey`, page.url().endsWith(`/journey/${id}`));
    }
    await ctx.close();
  }

  // Mobile layout with simulation active
  for (const w of [320, 390]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    await p.goto(`${base}/journey/east-washington--orlando--amtrak`); await p.waitForSelector("article time");
    await p.getByRole("button", { name: "Simulate delay" }).click();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const boxes = await p.$$eval("article", (as) => as.filter((a) => a.querySelector("time")).slice(0, 1).flatMap((a) => { const r = a.getBoundingClientRect(); return [...a.querySelectorAll("time")].map((t) => { const b = t.getBoundingClientRect(); return { inside: b.left >= r.left - 0.5 && b.right <= r.right + 0.5, w: Math.round(b.width) }; }); }));
    check(`M1 ${w}px: no page overflow; all times in the delayed card stay inside the card`, !overflow && boxes.every((b) => b.inside), JSON.stringify(boxes));
    if (shots) await p.locator("article").filter({ has: p.locator("time") }).first().screenshot({ path: `${shots}/p4-28-delayed-card-${w}${baselineMode ? "-base" : ""}.png` });
    await ctx.close();
  }
  check("No page or console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  await browser.close();
  console.log(`\n${pass}/${pass + fail} P4-28 checks passed${baselineMode ? `; ${baselineGaps} BASELINE contract gaps on the control build` : ""}`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
