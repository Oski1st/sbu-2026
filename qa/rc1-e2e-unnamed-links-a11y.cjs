// RC1: confirm e2e-check's mobile "unnamed <a>" failures are links inside the map's CLOSED <details>
// (not rendered, not in the accessibility tree), and that they have accessible names once opened.
// Usage: node qa/rc1-e2e-unnamed-links-a11y.cjs <baseUrl>
const { chromium } = require('playwright');
const base = process.argv[2];
(async () => {
  const b = await chromium.launch({ channel: 'chrome' });
  let ok = true;
  for (const w of [320, 390]) {
    const p = await (await b.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true })).newPage();
    await p.goto(base + '/', { waitUntil: 'networkidle' });
    // Same predicate as e2e-check.cjs unlabelledOrClipped(): non-zero box, not hidden, empty aria-label/innerText/title.
    const info = await p.evaluate(() => [...document.querySelectorAll('body button, body a[href], body [role=button]')].filter(el => { const r = el.getBoundingClientRect(); if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return false; if (el.closest('.sr-only, .ol-sr-only')) return false; return !(el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || '').trim(); }).map(a => { const d = a.closest('details'); return { href: a.getAttribute('href'), inDetails: !!d, detailsOpen: d ? d.open : null, summary: d?.querySelector('summary')?.textContent.trim().slice(0, 50), rendered: !!a.innerText, text: a.textContent.trim().slice(0, 40), aria: a.getAttribute('aria-label') }; }));
    const closedSnap = await p.locator('body').ariaSnapshot();
    const inTreeClosed = info.filter(i => i.text && closedSnap.includes(i.text.replace(/\s*↗$/, '').slice(0, 20)));
    // open the details that contain them and check accessible names via role query
    await p.evaluate(() => document.querySelectorAll('details').forEach(d => { if (d.querySelector('a[href*="amtrak.com"]')) d.open = true; }));
    await p.waitForTimeout(200);
    const named = [];
    for (const i of info) { const loc = p.locator(`a[href="${i.href}"]`).first(); named.push({ href: i.href, accessibleName: await loc.evaluate(a => a.textContent.trim() || a.getAttribute('aria-label') || '').catch(() => null), visibleNow: await loc.isVisible() }); }
    const allClosed = info.length > 0 && info.every(i => i.inDetails && i.detailsOpen === false);
    const allNamedWhenOpen = named.every(n => n.accessibleName && n.visibleNow);
    ok = ok && allClosed && allNamedWhenOpen && inTreeClosed.length === 0;
    console.log(JSON.stringify({ width: w, harnessUnnamed: info.length, allInsideClosedDetails: allClosed, presentInAriaSnapshotWhileClosed: inTreeClosed.length, allNamedAndVisibleWhenOpened: allNamedWhenOpen, summary: info[0]?.summary, sample: named.slice(0, 3) }));
    await p.context().close();
  }
  await b.close();
  console.log(ok ? 'PASS false positive confirmed' : 'FAIL not a pure false positive');
})();
