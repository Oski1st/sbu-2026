// Quick Amtrak handoff check (time-limited run). Usage: node p5-amtrak-handoff-quick.mjs <worktree> <baseURL> <outDir>
import { createRequire } from 'node:module';
const [wt, base, out] = process.argv.slice(2);
const pw = createRequire(wt + '/package.json')('playwright');
const browser = await pw.chromium.launch({ channel: 'chrome', headless: false });
const results = [];
for (const path of ['/journey/amtrak-connection', '/wallet/amtrak-connection']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  const page = await ctx.newPage();
  await page.goto(base + path); await page.waitForSelector('h1');
  const btn = page.getByRole('button', { name: /view trip details/i }).first();
  if (await btn.count()) { await btn.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400); }
  const link = page.locator('a[href*="amtrak.com"]:visible').first();
  const r = { path, linkCount: await page.locator('a[href*="amtrak.com"]').count() };
  if (r.linkCount) {
    await link.scrollIntoViewIfNeeded();
    r.href = await link.getAttribute('href');
    r.name = await link.evaluate(el => el.getAttribute('aria-label') || el.innerText);
    r.nameHasNewTab = /\(opens in a new tab\)/.test(r.name);
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 8000 }).catch(() => null), link.click({ timeout: 5000 }).catch(e => { r.clickError = e.message.split('\n').filter(l => /intercepts/.test(l))[0] || e.message.split('\n')[0]; })]);
    await page.waitForTimeout(800);
    r.clipboard = await page.evaluate(() => navigator.clipboard.readText()).catch(e => 'ERR ' + e.message);
    r.feedback = await page.getByText(/^Copied$/).first().isVisible().catch(() => false);
    r.popupHost = popup ? new URL(popup.url()).host : null;
    const shot = `${out}/amtrak-${path.split('/')[1]}-chrome-1280.png`;
    await page.screenshot({ path: shot }); r.shot = shot.split('/').pop();
    if (popup) await popup.close();
  }
  results.push(r); await ctx.close();
}
console.log(JSON.stringify(results, null, 2));
await browser.close();
