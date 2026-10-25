// P4-41: browser checks for PR #41 Journey/Wallet QA feedback (J2, J3, W3, F8, S4, F1, F6).
// Usage: node qa/p4-41-journey-feedback-check.cjs <baseUrl> [shotsDir] [--baseline]
// --baseline: run against the parent build (#33); checks of the new contract are reported as BASELINE, not FAIL.
const { chromium } = require("playwright");
const fs = require("node:fs");
const base = process.argv[2] || "http://127.0.0.1:4194";
const shots = process.argv[3] && !process.argv[3].startsWith("--") ? process.argv[3] : null;
const baselineMode = process.argv.includes("--baseline");
if (shots) fs.mkdirSync(shots, { recursive: true });
let pass = 0, fail = 0, gaps = 0;
const failures = [];
function check(name, ok, detail = "", contract = true) {
  if (ok) { pass++; console.log(`PASS ${name}${detail ? " — " + detail : ""}`); return; }
  if (contract && baselineMode) { gaps++; console.log(`BASELINE ${name}${detail ? " — " + detail : ""}`); return; }
  fail++; failures.push(name); console.log(`FAIL ${name}${detail ? " — " + detail : ""}`);
}
const tag = baselineMode ? "-base" : "";
const SINGLE = "east-new-york--philadelphia--amtrak";
const TRIPS = {
  "regional-connection": { status: "tight", remain: 3 },
  "amtrak-connection": { status: "tight", remain: 8 },
  "east-boston--new-york--greyhound": { bus: true },
  "east-washington--orlando--amtrak": {},
  "east-washington--stony-brook--amtrak": {},
  "east-boston--stony-brook--greyhound": { bus: true },
  [SINGLE]: {},
};

const live = (p) => p.locator('main [role="status"][aria-live="polite"]').filter({ hasText: /Simulat/ });
const liveText = async (p) => {
  const all = await p.locator("[aria-live]").evaluateAll((els) => els.map((e) => e.textContent.replace(/\s+/g, " ").trim()));
  return all;
};
const btn = (p, name) => p.getByRole("button", { name, exact: true });
const focusedName = (p) => p.evaluate(() => (document.activeElement === document.body ? "<body>" : (document.activeElement.textContent || document.activeElement.tagName).trim()));

async function open(p, id) {
  await p.goto(`${base}/journey/${id}`, { waitUntil: "networkidle" });
  await p.locator("#timeline-title").waitFor();
}

(async () => {
  const browser = await chromium.launch();
  // LA browser timezone to prove Eastern labels are not local-time.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: "America/Los_Angeles" });
  const p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  // ---------- J2 / F6 / S4 / F8 per trip ----------
  for (const [id, exp] of Object.entries(TRIPS)) {
    await open(p, id);
    const legs = await p.locator("main article").count();
    const transfers = p.locator("section[aria-label^='Transfer at'], section[aria-label*='Transfer at']");
    const tCount = await transfers.count();
    const isSingle = tCount === 0;
    console.log(`-- ${id}: ${legs} segment cards, ${tCount} transfers`);
    const before = await liveText(p);
    check(`F6 ${id}: live region shows 'Simulation off' before toggle`, before.some((t) => /Simulation off/.test(t)), JSON.stringify(before).slice(0, 160));
    // S4: transfer next-departure is dated + Eastern
    if (!isSingle) {
      const nextLine = (await transfers.first().locator("p", { hasText: /^Next:/ }).first().textContent()).replace(/\s+/g, " ");
      check(`S4 ${id}: transfer 'Next' time dated + Eastern`, /· Oct \d+/.test(nextLine) && /Eastern Time/.test(nextLine), nextLine.slice(0, 120));
    }
    // F8: bus disclaimer visible exactly on bus legs
    const busCards = await p.locator("main article").evaluateAll((els) => els.map((e) => /Sample coach corridor/.test(e.textContent)));
    const disclaimers = p.getByText("Sample coach corridor.", { exact: false });
    const dCount = await disclaimers.count();
    if (exp.bus) {
      check(`F8 ${id}: coach disclaimer present + visible`, dCount > 0 && (await disclaimers.first().isVisible()), `${dCount} disclaimers; cards=${JSON.stringify(busCards)}`);
      const txt = dCount ? await disclaimers.first().locator("xpath=..").textContent() : "";
      check(`F8 ${id}: disclaimer mentions stops, rest breaks, not nonstop`, /Intermediate stops/.test(txt) && /rest breaks/.test(txt) && /not a claim of nonstop/.test(txt));
    } else {
      check(`F8 ${id}: no coach disclaimer on non-coach trip`, dCount === 0, `${dCount}`, false);
    }

    // toggle simulation via keyboard
    await btn(p, "Simulate delay").focus();
    await p.keyboard.press("Enter");
    await p.waitForTimeout(150);
    const after = await liveText(p);
    const region = live(p);
    const rCount = await region.count();
    const rText = rCount ? (await region.first().textContent()).replace(/\s+/g, " ") : "";
    const attrs = rCount ? await region.first().evaluate((e) => [e.getAttribute("role"), e.getAttribute("aria-live"), e.getAttribute("aria-atomic")].join("/")) : "";
    check(`F6 ${id}: single atomic status region with simulated feedback`, rCount === 1 && attrs === "status/polite/true", `count=${rCount} attrs=${attrs}`);
    check(`F6 ${id}: 'Simulated delay' announced once across all live regions`, after.join(" ").split("Simulated delay: +12").length - 1 === 1, `${after.join(" | ").slice(0, 200)}`);
    check(`F6 ${id}: feedback states simulated arrival with date + Eastern`, /Sample arrival at .+?: \d{1,2}:\d{2} [AP]M · Oct \d+ Eastern Time/.test(rText), rText.slice(0, 160));
    if (isSingle) {
      check(`F6/J2 ${id}: single-leg says no onward connection, no recovery`, /no onward connection/.test(rText) && !/Recovery|missed/i.test(rText), rText.slice(0, 220));
    } else {
      const at = await transfers.first().evaluate((e) => e.className);
      const amber = /border-amber-300/.test(at);
      const tText = (await transfers.first().textContent()).replace(/\s+/g, " ");
      const hasRecovery = (await p.getByText(/recovery|next available|other option/i).count()) > 0;
      if (exp.status === "tight") {
        check(`J2 ${id}: tight -> 'Only ${exp.remain} min remains' in live region + transfer`, rText.includes(`Only ${exp.remain} min remains`) && tText.includes(`Only ${exp.remain} min remains`), rText.slice(0, 200));
        check(`J2 ${id}: tight transfer is amber/at-risk`, amber, at.slice(0, 80));
        check(`J2 ${id}: recovery recommendation shown for tight`, hasRecovery);
      } else {
        check(`J2 ${id}: 60-min transfer -> 48 min remains, comfortable`, rText.includes("48 min remains") && tText.includes("48 min remains"), rText.slice(0, 200));
        check(`J2 ${id}: comfortable transfer not amber`, !amber, at.slice(0, 80));
        check(`J2 ${id}: no recovery recommendation for viable 48-min connection`, !hasRecovery);
      }
      check(`J2 ${id}: states 10-minute demo buffer is not official`, /10-minute demo buffer is not an official minimum transfer time/.test(rText));
    }
    if (shots && (id === "regional-connection" || id === "east-boston--new-york--greyhound" || id === SINGLE)) {
      await p.locator('main div.mt-6[aria-live="polite"]').first().screenshot({ path: `${shots}/p4-41-feedback-${id}-1280${tag}.png`, timeout: 5000 }).catch(() => console.log(`   (no feedback region screenshot for ${id})`));
    }
    // Reset via the DelaySimulation toggle (now "Reset simulation")
    await btn(p, "Reset simulation").press("Space");
    await p.waitForTimeout(150);
    const reset = await liveText(p);
    check(`F6 ${id}: live region returns to 'Simulation off' after reset`, reset.some((t) => /Simulation off/.test(t)) && !reset.join(" ").includes("Simulated delay: +"), JSON.stringify(reset).slice(0, 160));
    // Reset via demo-controls Reset
    await btn(p, "Simulate delay").click();
    const demoReset = p.locator("section[aria-labelledby='demo-journey-title']").getByRole("button", { name: /^Reset/ });
    await demoReset.focus();
    await p.keyboard.press("Enter");
    await p.waitForTimeout(150);
    const reset2 = await liveText(p);
    check(`F6 ${id}: demo Reset also returns feedback to 'Simulation off'`, reset2.some((t) => /Simulation off/.test(t)) && !reset2.join(" ").includes("Simulated delay: +"));
  }

  // ---------- F1 keyboard focus at boundaries ----------
  for (const id of ["regional-connection", "east-washington--stony-brook--amtrak", "east-boston--new-york--greyhound", SINGLE]) {
    await open(p, id);
    const sec = p.locator("section[aria-labelledby='demo-journey-title']");
    // Tab-only from the Simulate/Wallet area: focus Start via Tab sequence
    await p.locator("body").click({ position: { x: 1, y: 1 } });
    let reached = false;
    for (let i = 0; i < 40; i++) { await p.keyboard.press("Tab"); if ((await focusedName(p)) === "Start demo journey") { reached = true; break; } }
    check(`F1 ${id}: Start reachable with Tab`, reached);
    await p.keyboard.press("Enter");
    const steps = await sec.evaluate((s) => s.textContent.match(/of (\d+)/)?.[1]);
    const n = Number(steps) || 0;
    console.log(`   ${id}: ${n} demo steps`);
    await p.keyboard.press("Tab"); await p.keyboard.press("Tab"); // Start -> Previous(disabled, skipped) -> Next -> Reset? verify
    let f = await focusedName(p);
    // Normalise: get to Next
    if (f !== "Next step") { await btn(p, "Next step").isEnabled() && (await btn(p, "Next step").focus()); }
    const nextEnabled = await btn(p, "Next step").isEnabled();
    if (nextEnabled) {
      for (let i = 0; i < n + 2 && (await btn(p, "Next step").isEnabled()); i++) await p.keyboard.press(i % 2 ? "Space" : "Enter");
      await p.waitForTimeout(100);
      f = await focusedName(p);
      check(`F1 ${id}: at last step focus moves from disabled Next to Previous`, f === "Previous step", `focused=${f}`);
      for (let i = 0; i < n + 2 && (await btn(p, "Previous step").isEnabled()); i++) await p.keyboard.press("Enter");
      await p.waitForTimeout(100);
      f = await focusedName(p);
      check(`F1 ${id}: at first step focus moves from disabled Previous to Next`, f === "Next step", `focused=${f}`);
      // Arrow keys
      await p.keyboard.press("ArrowRight"); await p.waitForTimeout(50);
      await p.keyboard.press("ArrowLeft"); await p.waitForTimeout(50);
      f = await focusedName(p);
      check(`F1 ${id}: ArrowRight/ArrowLeft back to first keeps focus on enabled control`, f === "Next step" || f === "Previous step" ? !(await p.evaluate(() => document.activeElement.disabled)) : false, `focused=${f}`);
      // Last step then Reset from keyboard
      for (let i = 0; i < n + 2 && (await btn(p, "Next step").isEnabled()); i++) await btn(p, "Next step").press("Enter");
      await sec.getByRole("button", { name: /^Reset/ }).focus();
      await p.keyboard.press("Enter"); await p.waitForTimeout(100);
      f = await focusedName(p);
      check(`F1 ${id}: Reset keeps focus on an enabled control`, f !== "<body>" && !(await p.evaluate(() => document.activeElement.disabled)), `focused=${f}`);
    } else {
      check(`F1 ${id}: single-step demo: Next/Previous both disabled after Start`, !(await btn(p, "Previous step").isEnabled()));
    }
    // From Next pressed into last step with Space? Also: focus restoration when direction button disabled after Start->Reset sequence
    await btn(p, "Start demo journey").focus(); await p.keyboard.press("Enter");
    if (n > 1) { await btn(p, "Next step").focus(); for (let i = 0; i < n + 2 && (await btn(p, "Next step").isEnabled()); i++) await p.keyboard.press("Enter"); }
    // Outside focus must not be stolen: Tab away to Simulate delay, toggle it, then press Reset via mouse is not keyboard; instead use demo Reset by click while focus elsewhere
    await btn(p, "Simulate delay").focus();
    await p.keyboard.press("Enter"); await p.waitForTimeout(100);
    f = await focusedName(p);
    check(`F1 ${id}: toggling Simulate delay keeps focus on the toggle (no steal)`, f === "Reset simulation", `focused=${f}`);
    await p.keyboard.press("Enter"); // back off
    // Programmatic boundary change while outside control is focused: ArrowLeft not possible outside; click Previous with mouse then focus link
    const wallet = p.getByRole("link", { name: /View ticket wallet/ });
    await wallet.focus();
    await sec.getByRole("button", { name: /^Reset/ }).dispatchEvent("click"); await p.waitForTimeout(100);
    f = await p.evaluate(() => document.activeElement.textContent.trim());
    check(`F1 ${id}: Reset triggered while focus is on Wallet link does not steal focus`, /View ticket wallet/.test(f), `focused=${f}`);
    // single-leg / reset uses Start when both directions disabled
    if (n <= 1) {
      await btn(p, "Start demo journey").focus(); await p.keyboard.press("Enter");
      f = await focusedName(p);
      check(`F1 ${id}: single-step: focus stays on Start (enabled)`, f === "Start demo journey", `focused=${f}`);
    }
  }

  // ---------- J3 delayed times alignment ----------
  for (const w of [320, 390, 1280]) {
    await p.setViewportSize({ width: w, height: 900 });
    await open(p, "regional-connection");
    await btn(p, "Simulate delay").click();
    const card = p.locator("main article").first();
    const times = card.locator("time");
    const boxes = await times.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { l: Math.round(r.left), r: Math.round(r.right) }; }));
    const del = boxes.slice(-2); // original + simulated arrival
    const cardBox = await card.boundingBox();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (w < 640) check(`J3 ${w}: original + simulated arrival left-aligned`, del.length === 2 && Math.abs(del[0].l - del[1].l) <= 1, JSON.stringify(del));
    else check(`J3 ${w}: desktop keeps right alignment`, del.length === 2 && Math.abs(del[0].r - del[1].r) <= 1, JSON.stringify(del), false);
    check(`J3 ${w}: no horizontal overflow`, !overflow, "", false);
    if (shots) {
      await card.screenshot({ path: `${shots}/p4-41-delayed-card-${w}${tag}.png` });
      await p.screenshot({ path: `${shots}/p4-41-journey-regional-delay-${w}${tag}.png`, fullPage: true });
      if (w !== 1280) {
        await open(p, "east-boston--new-york--greyhound");
        await btn(p, "Simulate delay").click();
        await p.screenshot({ path: `${shots}/p4-41-journey-greyhound-delay-${w}${tag}.png`, fullPage: true });
      }
    }
  }
  await p.setViewportSize({ width: 1280, height: 900 });

  // ---------- W3 Wallet back link ----------
  for (const id of ["regional-connection", "amtrak-connection", "east-boston--new-york--greyhound", "east-washington--orlando--amtrak", "east-boston--stony-brook--greyhound", SINGLE]) {
    await open(p, id);
    const title = (await p.locator("h1").first().textContent()).trim();
    await p.getByRole("link", { name: /View ticket wallet/ }).click();
    await p.waitForURL(`**/wallet/${id}`);
    const back = p.getByRole("link", { name: "Back to journey" });
    await p.locator("h1").first().waitFor();
    await back.waitFor({ timeout: 5000 }).catch(() => {});
    check(`W3 ${id}: Wallet has 'Back to journey' link to this trip`, (await back.count()) === 1 && (await back.getAttribute("href")) === `/journey/${id}`, (await back.count()) ? await back.getAttribute("href") : "missing");
    if (await back.count()) {
      // keyboard activate
      await back.focus(); await p.keyboard.press("Enter");
      await p.waitForURL(`**/journey/${id}`);
      await p.locator("#timeline-title").waitFor();
      const t2 = (await p.locator("h1").first().textContent()).trim();
      check(`W3 ${id}: back link returns to the same trip`, t2 === title, `${title} -> ${t2}`);
    }
    // direct load + reload of wallet
    await p.goto(`${base}/wallet/${id}`, { waitUntil: "networkidle" }); await p.reload({ waitUntil: "networkidle" });
    const href = (await back.count()) ? await back.getAttribute("href") : null;
    check(`W3 ${id}: back link correct after direct load + reload`, href === `/journey/${id}`, String(href));
  }
  if (shots) for (const w of [320, 390, 1280]) {
    await p.setViewportSize({ width: w, height: 900 });
    await p.goto(`${base}/wallet/regional-connection`, { waitUntil: "networkidle" });
    await p.screenshot({ path: `${shots}/p4-41-wallet-top-${w}${tag}.png` });
  }
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto(`${base}/wallet/does-not-exist`, { waitUntil: "networkidle" });
  check("W3 invalid wallet: no Back to journey link", (await p.getByRole("link", { name: "Back to journey" }).count()) === 0, "", false);

  // ---------- reload + trip switching ----------
  await open(p, "regional-connection");
  await btn(p, "Simulate delay").click();
  await p.reload({ waitUntil: "networkidle" });
  check("Reload: simulation resets to off", (await liveText(p)).some((t) => /Simulation off/.test(t)), "", false);
  await btn(p, "Simulate delay").click();
  await btn(p, "Start demo journey").click();
  // client-side trip switch (SPA navigation keeps the same route element)
  await p.evaluate((id) => { history.pushState({}, "", `/journey/${id}`); dispatchEvent(new PopStateEvent("popstate")); }, "east-washington--orlando--amtrak");
  await p.waitForTimeout(300);
  const sw = await liveText(p);
  const h1 = (await p.locator("h1").first().textContent()).trim();
  const swText = sw.join(" | ");
  console.log(`   after SPA switch: h1=${h1}; live=${swText.slice(0, 200)}`);
  check("Trip switch (SPA): feedback refers to new trip, no stale tight warning", !/Only 3 min/.test(swText) && (/Simulation off/.test(swText) || /48 min remains/.test(swText)), swText.slice(0, 200), false);
  check("Trip switch (SPA): simulation/demo state reset for new trip", /Simulation off/.test(swText), swText.slice(0, 160), false);
  await p.goBack({ waitUntil: "networkidle" }); await p.waitForTimeout(200);
  const backText = (await liveText(p)).join(" | ");
  console.log(`   after goBack: ${backText.slice(0, 160)}`);

  check("No console/page errors", errors.length === 0, errors.slice(0, 3).join(" ; "), false);
  await browser.close();
  console.log(`\n${pass}/${pass + fail} P4-41 checks passed${baselineMode ? `; ${gaps} BASELINE contract gaps on the control build` : ""}`);
  if (failures.length) console.log("FAILURES: " + failures.join(" ; "));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
