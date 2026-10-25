// RC1: measure text/icon contrast of the operator badges on the Search strip (light + dark, 320/1280).
// Usage: node qa/rc1-logo-contrast.cjs <baseUrl> <shotDir>
const { chromium } = require('playwright');
const fs = require('fs');
const [base, shots] = process.argv.slice(2); fs.mkdirSync(shots, { recursive: true });
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  const out = [];
  for (const scheme of ['light', 'dark']) for (const w of [320, 1280]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme })).newPage();
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    const rows = await p.evaluate(() => {
      // Convert any CSS colour (rgb, oklch, color-mix...) to sRGB via a 1x1 canvas.
      const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
      const parse = c => { if (!c || c === 'transparent') return { r: 0, g: 0, b: 0, a: 0 }; cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 }; };
      const lum = ({ r, g, b }) => { const f = x => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const bgOf = el => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) stack.push(c); if (c && c.a >= 0.99) break; } let bg = { r: 255, g: 255, b: 255 }; for (const c of stack.reverse()) bg = { r: c.r * c.a + bg.r * (1 - c.a), g: c.g * c.a + bg.g * (1 - c.a), b: c.b * c.a + bg.b * (1 - c.a) }; return bg; };
      const ratio = (fg, bg) => { const a = fg.a ?? 1; const m = { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a) }; const L1 = lum(m), L2 = lum(bg); return +(((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2)); };
      return [...document.querySelectorAll('.network-wordmark')].map(el => {
        const bg = bgOf(el); const cs = getComputedStyle(el); const svg = el.querySelector('svg');
        const iconColor = svg ? parse(getComputedStyle(svg).color) : null;
        const visibleLabel = [...el.childNodes].map(n => n.nodeType === 3 ? n.textContent : (n.getAttribute && n.getAttribute('aria-hidden') === 'true' && n.tagName !== 'svg' ? n.textContent : '')).join('').trim();
        return { label: visibleLabel, accessibleText: el.textContent.trim(), fontSize: cs.fontSize, fontWeight: cs.fontWeight, text: cs.color, bg: `rgb(${bg.r|0},${bg.g|0},${bg.b|0})`, textContrast: ratio(parse(cs.color), bg), iconContrast: iconColor ? ratio(iconColor, bg) : null, border: cs.borderColor };
      });
    });
    await p.locator('.network-wordmark').first().locator('xpath=..').screenshot({ path: `${shots}/rc1-logo-strip-${scheme}-${w}.png` }).catch(() => {});
    out.push({ scheme, width: w, rows });
    await p.context().close();
  }
  await b.close();
  for (const o of out) for (const r of o.rows) console.log(`${r.textContrast >= 4.5 ? 'PASS' : 'FAIL'} ${o.scheme} ${o.width}px ${r.label}: text ${r.textContrast}:1 (${r.fontSize}/${r.fontWeight}) icon ${r.iconContrast}:1 ${r.iconContrast !== null && r.iconContrast < 3 ? '(icon < 3:1)' : ''}`);
  fs.writeFileSync(`${shots}/rc1-logo-contrast.json`, JSON.stringify(out, null, 2));
})();
