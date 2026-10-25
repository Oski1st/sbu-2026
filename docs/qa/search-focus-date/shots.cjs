// Screenshot focus rings for specific controls. Usage: node shots.cjs <base> <outDir> [prefix]
const { chromium } = require("playwright");
const fs = require("node:fs");
const [base, out, prefix = ""] = [process.argv[2], process.argv[3], process.argv[4] || ""];
fs.mkdirSync(out, { recursive: true });
const CASES = [
  { name: "compare-tray-action", url: "/", compare: true, sel: ".compare-tray-action" },
  { name: "compare-tray-clear", url: "/", compare: true, sel: ".compare-tray-clear" },
  { name: "closing-banner-link", url: "/", sel: ".closing-banner > a" },
  { name: "share-trip-button", url: "/search?from=philadelphia&to=new-york", sel: ".share-trip-button" },
  { name: "nav-journey", url: "/", sel: '.site-header nav a[href="/journey"]' },
  { name: "nav-search-on-journey", url: "/journey/regional-connection", sel: '.site-header nav a[href="/"], .site-header nav a[href="/search"]' },
  { name: "filter-rail-only", url: "/", sel: ".transport-filters button:nth-child(2)" },
  { name: "nav-active-search", url: "/", sel: ".site-header nav a.active" },
  { name: "filter-all-pressed", url: "/", sel: '.transport-filters button[aria-pressed="true"]' },
  { name: "skip-link", url: "/", sel: ".skip-link" },
  { name: "brand-home", url: "/", sel: ".site-header a:first-of-type" },
  { name: "find-my-way", url: "/", sel: ".search-button" },
  { name: "swap", url: "/", sel: ".swap-button" },
  { name: "from", url: "/", sel: "#origin" },
  { name: "date", url: "/", sel: 'input[name="departure-date"]' },
  { name: "time", url: "/", sel: 'input[name="departure-time"]' },
  { name: "select-route", url: "/", sel: "a.select-route" },
  { name: "journey-wallet-cta", url: "/journey/regional-connection", sel: '#main-content a[href="/wallet/regional-connection"]' },
  { name: "wallet-ticket-link", url: "/wallet/regional-connection", sel: ".oneline-wallet a.ol-button" },
];
(async () => {
  const browser = await chromium.launch();
  for (const width of [1280, 390]) for (const c of CASES) {
    const page = await (await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 2 })).newPage();
    await page.goto(base + c.url); await page.waitForTimeout(1200);
    if (c.compare) { const k = page.locator(".compare-route-check input[type=checkbox]"); await k.nth(0).check(); await k.nth(1).check(); }
    const el = page.locator(c.sel).first();
    if (!(await el.count())) { console.log("MISSING", c.name); await page.close(); continue; }
    await el.scrollIntoViewIfNeeded().catch(() => {});
    // keyboard modality, then programmatic focus keeps :focus-visible
    await page.keyboard.press("Shift"); await el.focus(); await page.waitForTimeout(400);
    const fv = await el.evaluate((e) => e.matches(":focus-visible"));
    const b = await el.boundingBox(); const pad = 24;
    const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad), width: Math.min(width - Math.max(0, b.x - pad), b.width + 2 * pad), height: b.height + 2 * pad };
    await page.screenshot({ path: `${out}/${prefix}${c.name}-${width}.png`, clip });
    console.log(c.name, width, "fv=" + fv);
    await page.close();
  }
  await browser.close();
})();
