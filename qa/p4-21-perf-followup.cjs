// P4-21 pre-specified CPU x4 cold-load follow-up: readiness vs combined, 50 loads per build, interleaved.
// Usage: node qa/p4-21-perf-followup.cjs <readinessURL> <combinedURL> <out.json>
// The per-load measurement is copied unchanged from the qa/p4-16-perf.cjs cold-load section (P4-16 / P4-18 protocol).
// Every scheduled load is recorded and counted; failures and timeouts rank as +Infinity (worst). No trimming, no early stop.
const { chromium } = require("playwright");
const fs = require("node:fs");
const os = require("node:os");
const [readinessURL, combinedURL, out] = [process.argv[2], process.argv[3], process.argv[4]];
if (!readinessURL || !combinedURL || !out) { console.error("usage: node qa/p4-21-perf-followup.cjs <readinessURL> <combinedURL> <out.json>"); process.exit(2); }

const SEED = 20261024;
const LOADS_PER_BUILD = 50;
const CPU_RATE = 4;
const VIEWPORT = { width: 1280, height: 900 };
const THRESHOLDS = { totalBlockingMs: 50, firstRouteCardMs: 300 }; // proposed p95 budgets, not accepted budgets
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// Nearest-rank percentile: value at rank ceil(p/100 * n) of the ascending sample (p95 of 50 = rank 48, p50 = rank 25).
const rank = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.ceil((p / 100) * s.length) - 1] : null; };
const round = (v) => (v === null || !Number.isFinite(v) ? v === Infinity ? "Infinity" : v : +v.toFixed(2));

// Schedule: 50 pairs; in each pair a seeded coin flip decides which build loads first.
const rand = mulberry32(SEED);
const builds = { readiness: readinessURL, combined: combinedURL };
const schedule = [];
for (let pair = 0; pair < LOADS_PER_BUILD; pair++) {
  const order = rand() < 0.5 ? ["readiness", "combined"] : ["combined", "readiness"];
  for (const build of order) schedule.push({ seq: schedule.length, pair, build });
}

async function coldLoad(browser, base) {
  // Unchanged from qa/p4-16-perf.cjs: fresh context, CDP CPU throttling, long-task observer, first .route-card visible, GC, heap.
  const ctx = await browser.newContext({ viewport: VIEWPORT });
  try {
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      window.__lt = [];
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: "longtask", buffered: true }); } catch {}
    });
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_RATE });
    await cdp.send("Performance.enable");
    await page.goto(base + "/", { waitUntil: "commit" });
    await page.waitForSelector(".route-card", { state: "visible" });
    const t = await page.evaluate(() => performance.now());
    await page.waitForTimeout(1000);
    const m = await page.evaluate(() => ({ lt: window.__lt, dcl: performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ?? null }));
    await cdp.send("HeapProfiler.collectGarbage").catch(() => {});
    const metrics = (await cdp.send("Performance.getMetrics")).metrics;
    return {
      firstRouteCardMs: t, domContentLoadedMs: m.dcl ?? 0, longTaskCount: m.lt.length,
      longestTaskMs: m.lt.length ? Math.max(...m.lt) : 0, totalBlockingMs: m.lt.reduce((a, d) => a + Math.max(0, d - 50), 0),
      heapAfterLoadMB: metrics.find((x) => x.name === "JSHeapUsedSize").value / 1048576, longTasks: m.lt,
    };
  } finally { await ctx.close(); }
}

(async () => {
  const browser = await chromium.launch();
  const result = {
    task: "P4-21", seed: SEED, loadsPerBuild: LOADS_PER_BUILD, cpuRate: CPU_RATE, viewport: VIEWPORT, thresholdsProposed: THRESHOLDS,
    percentile: "nearest-rank: p50 = rank 25 of 50, p95 = rank 48 of 50; failed loads rank as +Infinity",
    builds, chromium: browser.version(), node: process.version, cpu: os.cpus()[0]?.model, cores: os.cpus().length,
    loadAvgBefore: os.loadavg(), startedAt: new Date().toISOString(), schedule: schedule.map((s) => `${s.pair}:${s.build}`),
  };

  // Pre-step kept from the existing harness order: one unscored load per build to record the served assets (build identity).
  result.assets = {};
  for (const [name, base] of Object.entries(builds)) {
    const ctx = await browser.newContext(); const page = await ctx.newPage(); const assets = new Set();
    page.on("response", (r) => { const u = r.url(); if (u.startsWith(base) && /\.(js|css)(\?|$)/.test(u)) assets.add(u.replace(base, "")); });
    await page.goto(base + "/"); await page.waitForSelector(".route-card"); await page.waitForTimeout(500);
    result.assets[name] = [...assets].sort(); await ctx.close();
  }

  result.loads = [];
  for (const s of schedule) {
    const at = new Date().toISOString();
    try {
      const r = await coldLoad(browser, builds[s.build]);
      result.loads.push({ ...s, at, ok: true, ...r });
    } catch (e) {
      result.loads.push({ ...s, at, ok: false, error: String(e && e.message || e).slice(0, 300) });
    }
    if ((s.seq + 1) % 10 === 0) console.log(`${s.seq + 1} / ${schedule.length}`);
  }
  result.loadAvgAfter = os.loadavg();
  result.finishedAt = new Date().toISOString();

  result.summary = {};
  for (const name of Object.keys(builds)) {
    const rows = result.loads.filter((l) => l.build === name);
    const failures = rows.filter((l) => !l.ok);
    const metric = (k) => rows.map((l) => (l.ok ? l[k] : Infinity));
    const sum = { scheduled: rows.length, completed: rows.length - failures.length, failures: failures.length, failureMessages: failures.map((f) => f.error) };
    for (const k of ["firstRouteCardMs", "totalBlockingMs", "longestTaskMs", "longTaskCount", "domContentLoadedMs", "heapAfterLoadMB"]) {
      const xs = metric(k);
      sum[k] = { p50: round(rank(xs, 50)), p95: round(rank(xs, 95)), max: round(Math.max(...xs)), min: round(Math.min(...xs)), sorted: [...xs].sort((a, b) => a - b).map(round) };
    }
    sum.exceedances = {
      totalBlockingOver50: metric("totalBlockingMs").filter((v) => v > THRESHOLDS.totalBlockingMs).length,
      firstRouteCardOver300: metric("firstRouteCardMs").filter((v) => v > THRESHOLDS.firstRouteCardMs).length,
    };
    sum.p95MeetsProposed = {
      totalBlocking: rank(metric("totalBlockingMs"), 95) <= THRESHOLDS.totalBlockingMs,
      firstRouteCard: rank(metric("firstRouteCardMs"), 95) <= THRESHOLDS.firstRouteCardMs,
    };
    result.summary[name] = sum;
  }
  await browser.close();
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  const brief = Object.fromEntries(Object.entries(result.summary).map(([k, v]) => [k, {
    scheduled: v.scheduled, failures: v.failures, tbt: [v.totalBlockingMs.p50, v.totalBlockingMs.p95, v.totalBlockingMs.max],
    firstCard: [v.firstRouteCardMs.p50, v.firstRouteCardMs.p95, v.firstRouteCardMs.max], exceed: v.exceedances, meets: v.p95MeetsProposed }]));
  console.log(JSON.stringify({ loadAvgBefore: result.loadAvgBefore, loadAvgAfter: result.loadAvgAfter, assets: result.assets, brief }, null, 1));
})().catch((e) => { console.error(e); process.exit(1); });
