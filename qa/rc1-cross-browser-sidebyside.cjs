// Builds side-by-side Chromium | Firefox | WebKit images from rc1-cross-browser-features.cjs screenshots.
// Usage: node qa/rc1-cross-browser-sidebyside.cjs <shotDir> <outDir> [name ...]
// Each output is <outDir>/compare-<profile>-<name>.png; images are rendered in a Chromium page.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const [shots, outDir, ...only] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const engines = ["chromium", "firefox", "webkit"];
(async () => {
  const names = new Set();
  for (const f of fs.readdirSync(shots)) {
    const m = /^(chromium|firefox|webkit)-(desktop|phone)-(.+)\.png$/.exec(f);
    if (m) names.add(`${m[2]}|${m[3]}`);
  }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 2400, height: 400 } });
  for (const key of [...names].sort()) {
    const [profile, name] = key.split("|");
    if (only.length && !only.includes(name)) continue;
    const cells = engines.map((e) => {
      const file = path.resolve(shots, `${e}-${profile}-${name}.png`);
      const src = fs.existsSync(file) ? `data:image/png;base64,${fs.readFileSync(file).toString("base64")}` : "";
      return `<figure><figcaption>${e} · ${profile}</figcaption>${src ? `<img src="${src}">` : "<p>missing</p>"}</figure>`;
    });
    const maxW = profile === "phone" ? 420 : 820;
    await page.setContent(`<style>body{margin:0;font:14px system-ui;background:#fff}main{display:flex;gap:12px;padding:8px;align-items:flex-start}
      figure{margin:0;width:${maxW}px}figcaption{font-weight:700;padding:4px 0}img{max-width:100%;border:1px solid #999}</style><main>${cells.join("")}</main>`);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await page.locator("main").screenshot({ path: path.join(outDir, `compare-${profile}-${name}.png`) });
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
