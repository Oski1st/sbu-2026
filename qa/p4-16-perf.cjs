// P4-16 browser measurement: run the same protocol against baseline and candidate builds.
// Usage: node qa/p4-16-perf.cjs <label> <baseURL> <out.json>
// Browser results only (Chromium via Playwright). Seeded cases; see SEED.
const { chromium } = require("playwright");
const zlib = require("node:zlib");
const fs = require("node:fs");
const [label, base, out] = [process.argv[2] ?? "target", process.argv[3] ?? "http://127.0.0.1:4173", process.argv[4] ?? "perf.json"];
const SEED = 20261024;
const COLD_LOADS = 10;
const CASES = 200;
const CITIES = ["Portland", "Boston", "Providence", "Hartford", "New Haven", "Albany", "New York", "Stony Brook", "Trenton", "Philadelphia", "Baltimore",
  "Washington, DC", "Richmond", "Norfolk", "Raleigh", "Charlotte", "Fayetteville", "Charleston", "Savannah", "Jacksonville", "Orlando", "Tampa", "Fort Lauderdale", "Miami",
  "NYC", "DC", "Philly", "Atlantis"];
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? +s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(2) : null; };
const stats = (xs) => ({ n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), max: xs.length ? +Math.max(...xs).toFixed(2) : null });

(async () => {
  const browser = await chromium.launch();
  const result = { label, base, seed: SEED, chromium: browser.version(), node: process.version, when: new Date().toISOString() };

  // Bundle loaded on "/"
  {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    const assets = new Set();
    page.on("response", (r) => { const u = r.url(); if (u.startsWith(base) && /\.(js|css|json)(\?|$)/.test(u)) assets.add(u); });
    await page.goto(base + "/"); await page.waitForSelector(".route-card"); await page.waitForTimeout(500);
    const rows = [];
    for (const u of assets) {
      const buf = Buffer.from(await (await fetch(u)).arrayBuffer());
      rows.push({ asset: u.replace(base, ""), raw: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length, brotli: zlib.brotliCompressSync(buf).length });
    }
    result.bundleOnSearch = { assets: rows, totals: rows.reduce((a, r) => ({ raw: a.raw + r.raw, gzip: a.gzip + r.gzip, brotli: a.brotli + r.brotli }), { raw: 0, gzip: 0, brotli: 0 }) };
    await ctx.close();
  }

  // Cold loads at CPU x1 and x4: time to first route card, long tasks, total blocking time, heap after load.
  result.coldLoad = {};
  for (const rate of [1, 4]) {
    const firstCard = [], longCount = [], longest = [], tbt = [], heap = [], dcl = [];
    for (let i = 0; i < COLD_LOADS; i++) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        window.__lt = [];
        try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: "longtask", buffered: true }); } catch {}
      });
      const cdp = await ctx.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      await cdp.send("Performance.enable");
      await page.goto(base + "/", { waitUntil: "commit" });
      await page.waitForSelector(".route-card", { state: "visible" });
      const t = await page.evaluate(() => performance.now());
      await page.waitForTimeout(1000);
      const m = await page.evaluate(() => ({ lt: window.__lt, dcl: performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ?? null }));
      await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
      const metrics = (await cdp.send("Performance.getMetrics")).metrics;
      firstCard.push(t); dcl.push(m.dcl ?? 0);
      longCount.push(m.lt.length); longest.push(m.lt.length ? Math.max(...m.lt) : 0); tbt.push(m.lt.reduce((a, d) => a + Math.max(0, d - 50), 0));
      heap.push(metrics.find((x) => x.name === "JSHeapUsedSize").value / 1048576);
      await ctx.close();
    }
    result.coldLoad[`cpu_x${rate}`] = { firstRouteCardMs: stats(firstCard), domContentLoadedMs: stats(dcl), longTaskCount: stats(longCount), longestTaskMs: stats(longest), totalBlockingMs: stats(tbt), heapAfterLoadMB: stats(heap) };
  }

  // Search latency over seeded cases: pass 1 (first time each pair in this page) and pass 2 (same sequence again).
  {
    const rand = mulberry32(SEED);
    const cases = [];
    while (cases.length < CASES) {
      const o = CITIES[Math.floor(rand() * CITIES.length)], d = CITIES[Math.floor(rand() * CITIES.length)];
      const prev = cases.at(-1);
      if (prev && prev[0] === o && prev[1] === d) continue;
      cases.push([o, d]);
    }
    result.searchCases = { seed: SEED, n: cases.length, first5: cases.slice(0, 5) };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Performance.enable");
    await page.goto(base + "/"); await page.waitForSelector(".route-card");
    const runPass = () => page.evaluate(async (cases) => {
      const setVal = (el, v) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new Event("input", { bubbles: true })); };
      const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const out = [];
      for (const [o, d] of cases) {
        setVal(document.querySelector("#origin"), o); setVal(document.querySelector("#destination"), d);
        await frame();
        const status = document.querySelector(".results-heading [role=status]");
        const before = status.textContent;
        const t0 = performance.now();
        document.querySelector(".search-button").click();
        let n = 0;
        while (status.textContent === before && n++ < 200) await new Promise((r) => setTimeout(r, 0));
        await frame();
        out.push(performance.now() - t0);
      }
      return out;
    }, cases);
    const p1 = await runPass();
    const p2 = await runPass();
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    const heapAfter = (await cdp.send("Performance.getMetrics")).metrics.find((x) => x.name === "JSHeapUsedSize").value / 1048576;
    result.search = { pass1_firstTimePairMs: stats(p1), pass2_repeatMs: stats(p2), heapAfter400SearchesMB: +heapAfter.toFixed(2),
      note: "Click-to-status-update plus two animation frames, in-page timing, CPU x1" };
    await ctx.close();
  }

  // Cold deep-link render: fresh context (no storage), navigation to Journey in-page Wallet link visible / Wallet ticket list.
  {
    const ids = ["regional-connection", "amtrak-connection", "east-boston--new-york--greyhound", "east-portland--miami--amtrak", "east-boston--stony-brook--flixbus", "east-miami--portland--greyhound"];
    const journey = [], wallet = [];
    for (const id of ids) for (let i = 0; i < 3; i++) {
      for (const kind of ["journey", "wallet"]) {
        const ctx = await browser.newContext(); const page = await ctx.newPage();
        const t0 = Date.now();
        await page.goto(`${base}/${kind}/${id}`, { waitUntil: "commit" });
        await page.waitForSelector(kind === "journey" ? `#main-content a[href="/wallet/${id}"]` : ".ol-ticket-list > li", { timeout: 15000 });
        (kind === "journey" ? journey : wallet).push(Date.now() - t0);
        await ctx.close();
      }
    }
    result.coldDeepLinkMs = { ids, journey: stats(journey), wallet: stats(wallet), note: "Wall-clock from goto to content visible, fresh context, CPU x1" };
  }

  result.autocomplete = "not applicable: this target has no app autocomplete (native datalist only)";
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ label, bundle: result.bundleOnSearch.totals, cold: result.coldLoad, search: result.search, deep: result.coldDeepLinkMs }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
