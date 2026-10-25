// P4-38 (WIP): fresh-checkout browser checks of PR #37 (dated-transit planner) WITHOUT the timetable artifact.
// Usage: node qa/p4-38-browser-check.cjs <baseURL> <outDir>
// Serves nothing itself; point it at `PORT=<port> node server/index.mjs` from a #37 build.
// Records: catalogue/autocomplete, honest "unavailable" messaging, no sample fallback, URL/history/refresh,
// fake itinerary link, 320-400px date/time layout, third-party requests, geolocation calls, storage, wording.
const { chromium } = require("playwright");
const fs = require("node:fs");
const [base, out] = [process.argv[2] || "http://127.0.0.1:4185", process.argv[3] || "p4-38-out"];
fs.mkdirSync(out, { recursive: true });
const R = { base, checks: [], requests: { thirdParty: [], api: [] }, console: [], geolocationCalls: 0 };
const check = (id, ok, detail) => { R.checks.push({ id, result: ok ? "PASS" : "FAIL", detail }); console.log(ok ? "PASS" : "FAIL", id, JSON.stringify(detail).slice(0, 300)); };
const origin = new URL(base).origin;
const BANNED = [/google/i, /\blive\b/i, /real-?time/i, /\$\s?\d/, /\bfares?\b/i, /all operators/i];

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    window.__geo = 0;
    if (navigator.geolocation) for (const k of ["getCurrentPosition", "watchPosition"]) navigator.geolocation[k] = () => { window.__geo++; };
  });
  ctx.on("request", (r) => { const u = r.url(); if (!u.startsWith(origin) && !u.startsWith("data:")) R.requests.thirdParty.push(u); else if (u.includes("/api/")) R.requests.api.push(r.method() + " " + u.slice(origin.length)); });
  const page = await ctx.newPage();
  page.on("console", (m) => { if (m.type() === "error") R.console.push(m.text()); });
  const status = () => page.locator(".results-heading p[role=status]").innerText();
  const geo = async () => { R.geolocationCalls += await page.evaluate(() => window.__geo); };

  // 1. Fresh root
  await page.goto(base + "/");
  await page.waitForFunction(() => /source-backed transit places|could not be loaded/.test(document.querySelector(".catalogue-qualification")?.textContent || ""), null, { timeout: 15000 });
  const qual = await page.locator(".catalogue-qualification").innerText();
  check("root-catalogue-1371", /1,371 source-backed transit places/.test(qual) && /Only 0 /.test(qual), qual);
  const coverage = await page.locator(".timetable-coverage").innerText();
  check("root-coverage-says-no-snapshot", /No published timetable snapshot is loaded on this checkout/.test(coverage), coverage.slice(0, 220));
  const hero = await page.locator(".timetable-hero").innerText();
  R.heroText = hero;
  check("root-no-search-before-submit", !R.requests.api.some((a) => a.includes("/api/transit/plan")), R.requests.api);
  await page.screenshot({ path: `${out}/root-1280.png`, fullPage: true });

  // 2. Autocomplete at 1,371 places
  const o = page.locator("#origin");
  await o.fill(""); const t0 = Date.now(); await o.pressSequentially("Phil", { delay: 30 }); const typed = Date.now() - t0;
  await page.waitForSelector("#origin ~ div [role=option], [role=listbox] [role=option]", { timeout: 5000 });
  const opts = await page.locator("[role=listbox] [role=option]").allInnerTexts();
  check("autocomplete-phil-ranks-philadelphia-first", /Philadelphia/.test(opts[0] || ""), { opts: opts.slice(0, 5), typeMs: typed });
  await o.press("ArrowDown"); await o.press("Enter");
  check("autocomplete-keyboard-select", /Philadelphia, PA/.test(await o.inputValue()), await o.inputValue());
  await o.fill("Portland");
  await page.waitForTimeout(200);
  const port = await page.locator("[role=listbox] [role=option]").allInnerTexts();
  check("autocomplete-portland-disambiguated", port.some((x) => /ME/.test(x)) && port.some((x) => /OR/.test(x)), port.slice(0, 6));
  await o.press("Escape");
  check("autocomplete-escape-closes", (await o.getAttribute("aria-expanded")) === "false", await o.getAttribute("aria-expanded"));
  await o.fill("Atlantis"); await page.waitForTimeout(200);
  const nomatch = await page.locator(".location-autocomplete").first().innerText();
  check("autocomplete-no-match-feedback", /No .*cities match/.test(nomatch), nomatch.slice(0, 200));
  await o.press("Escape");

  // 3. Submit a real-city search on fresh checkout
  await page.goto(base + "/");
  await page.waitForFunction(() => /source-backed/.test(document.querySelector(".catalogue-qualification")?.textContent || ""));
  await page.locator("#origin").fill("Boston, MA"); await page.locator("#origin").press("Escape");
  await page.locator("#destination").fill("Philadelphia, PA"); await page.locator("#destination").press("Escape");
  await page.locator('input[name="departure-date"]').fill("2026-10-26");
  await page.locator('input[name="departure-time"]').fill("08:00");
  await page.locator(".search-button").click();
  await page.waitForFunction(() => !/Searching published/.test(document.querySelector(".results-heading p[role=status]")?.textContent || "x"), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  const st = await status();
  const results = await page.locator("#routes").innerText();
  const url1 = page.url();
  check("submit-url-has-query", /from=Boston/.test(url1) && /date=2026-10-26/.test(url1) && /time=08%3A00|time=08:00/.test(url1), url1.slice(origin.length));
  check("submit-honest-unavailable", /unavailable on this checkout/i.test(st) && /couldn.t verify this search/i.test(results), st);
  check("submit-no-sample-fallback", (await page.locator(".route-card").count()) === 0 && !/regional-connection|amtrak-connection|\$\d/.test(results) && !/scheduled options for/.test(st), { routeCards: await page.locator(".route-card").count() });
  check("submit-says-no-sample-substitution", /won.t substitute sample times/.test(results), "");
  await page.screenshot({ path: `${out}/fresh-search-unavailable-1280.png`, fullPage: true });

  // 4. URL/history: date-only change, back/forward, reload
  await page.locator('input[name="departure-date"]').fill("2026-10-27");
  await page.locator(".search-button").click(); await page.waitForTimeout(800);
  const url2 = page.url();
  await page.goBack(); await page.waitForTimeout(800);
  const backDate = await page.locator('input[name="departure-date"]').inputValue();
  await page.goForward(); await page.waitForTimeout(800);
  const fwdDate = await page.locator('input[name="departure-date"]').inputValue();
  check("history-date-roundtrip", /date=2026-10-27/.test(url2) && backDate === "2026-10-26" && fwdDate === "2026-10-27", { backDate, fwdDate });
  await page.reload(); await page.waitForTimeout(1200);
  check("reload-keeps-query-and-honest-state", (await page.locator('input[name="departure-date"]').inputValue()) === "2026-10-27" && /unavailable on this checkout/i.test(await status()), await status());
  // Shared URL in a fresh context
  const ctx2 = await browser.newContext(); const p2 = await ctx2.newPage(); await p2.goto(url2); await p2.waitForTimeout(1500);
  check("shared-url-fresh-context", (await p2.locator("#origin").inputValue()) === "Boston, MA" && /unavailable on this checkout/i.test(await p2.locator(".results-heading p[role=status]").innerText()), await p2.locator("#origin").inputValue());
  await ctx2.close();

  // 5. Operator gap filter on fresh checkout (API unavailable -> honest error, no sample)
  await page.goto(base + "/?from=Philadelphia%2C+PA&to=Stony+Brook%2C+NY&date=2026-10-26&time=08%3A00&operator=SEPTA&search=1");
  await page.waitForTimeout(1500);
  check("operator-septa-no-sample", (await page.locator(".route-card").count()) === 0 && /unavailable/i.test(await status()), await status());

  // 6. Fake / tampered itinerary link
  await page.goto(base + "/itinerary/tt1-eyJ2IjoieCJ9"); await page.waitForTimeout(1500);
  const itin = await page.locator("main").innerText();
  R.itineraryText = itin.slice(0, 600);
  check("itinerary-fake-id-no-sample", !/regional-connection|amtrak-connection|\$\d/.test(itin) && /unavailable|could not|invalid|search again/i.test(itin), itin.slice(0, 240));
  await page.screenshot({ path: `${out}/itinerary-fake-1280.png`, fullPage: true });

  // 7. Wording scan
  for (const path of ["/", "/itinerary/tt1-eyJ2IjoieCJ9"]) {
    await page.goto(base + path); await page.waitForTimeout(1200);
    const text = await page.locator("body").innerText();
    const hits = [];
    for (const re of BANNED) for (const line of text.split("\n")) if (re.test(line)) hits.push(`${re} :: ${line.trim().slice(0, 160)}`);
    R[`wording${path}`] = hits;
    console.log("WORDING", path, hits);
  }

  // 8. Narrow widths: date/time values and overflow
  R.widths = [];
  for (const w of [320, 360, 375, 390, 400]) {
    const c = await browser.newContext({ viewport: { width: w, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await c.newPage(); await p.goto(base + "/?from=Boston%2C+MA&to=Philadelphia%2C+PA&date=2026-12-30&time=23:45"); await p.waitForTimeout(1200);
    const m = await p.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { w: Math.round(b.width), x: Math.round(b.x), right: Math.round(b.right), y: Math.round(b.y), scrollW: e.scrollWidth, clientW: e.clientWidth }; };
      return { docScroll: document.documentElement.scrollWidth, inner: innerWidth, date: r('input[name="departure-date"]'), time: r('input[name="departure-time"]'),
        stacked: document.querySelector('input[name="departure-time"]').getBoundingClientRect().y > document.querySelector('input[name="departure-date"]').getBoundingClientRect().y + 10 };
    });
    await p.locator(".search-form").screenshot({ path: `${out}/form-${w}.png` });
    const ok = m.docScroll <= m.inner && m.date.right <= m.inner && m.time.right <= m.inner && m.date.scrollW <= m.date.clientW && m.time.scrollW <= m.time.clientW;
    R.widths.push({ w, ...m });
    check(`width-${w}-no-overflow`, ok, m);
    await c.close();
  }
  // 9. Request race (J2): intercepted plan responses (mock JSON, QA-only; no artifact). First search delayed.
  {
    const c = await browser.newContext(); const p = await c.newPage();
    const failed = []; p.on("requestfailed", (r) => { if (r.url().includes("/api/transit/plan")) failed.push(r.url().slice(origin.length) + " " + (r.failure()?.errorText || "")); });
    const seen = [];
    await p.route("**/api/transit/plan?**", async (route) => {
      const u = new URL(route.request().url()); seen.push(u.searchParams.get("date"));
      const slow = u.searchParams.get("date") === "2026-10-26";
      if (slow) await new Promise((r) => setTimeout(r, 2500));
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ version: "qa", query: {}, itineraries: [], warnings: [], feeds: [], reason: "no-connection", message: slow ? "QA-STALE-RESPONSE-A" : "QA-FRESH-RESPONSE-B" }) }).catch(() => {});
    });
    await p.goto(base + "/"); await p.waitForSelector(".search-form");
    await p.locator("#origin").fill("Boston, MA"); await p.locator("#origin").press("Escape");
    await p.locator("#destination").fill("Philadelphia, PA"); await p.locator("#destination").press("Escape");
    await p.locator('input[name="departure-date"]').fill("2026-10-26");
    await p.locator(".search-button").click(); await p.waitForTimeout(300);
    await p.locator('input[name="departure-date"]').fill("2026-10-27");
    await p.locator(".search-button").click(); await p.waitForTimeout(4000);
    const s = await p.locator(".results-heading p[role=status]").innerText();
    R.race = { seen, failed, status: s };
    check("J2-race-stale-reply-not-shown", /QA-FRESH-RESPONSE-B/.test(s) && !/QA-STALE/.test(s), R.race);
    await c.close();
  }
  await geo();
  R.storage = await page.evaluate(() => ({ local: Object.fromEntries(Object.entries(localStorage)), session: Object.fromEntries(Object.entries(sessionStorage)) }));
  check("no-third-party-requests", R.requests.thirdParty.length === 0, R.requests.thirdParty.slice(0, 5));
  check("no-geolocation-calls", R.geolocationCalls === 0, R.geolocationCalls);
  check("storage-no-coordinates", !/lat|lon|coord/i.test(JSON.stringify(R.storage)), R.storage);
  fs.writeFileSync(`${out}/p4-38-browser.json`, JSON.stringify(R, null, 2));
  const fails = R.checks.filter((c) => c.result === "FAIL").length;
  console.log(`TOTAL ${R.checks.length - fails}/${R.checks.length} passed; console errors: ${R.console.length}`);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(2); });
