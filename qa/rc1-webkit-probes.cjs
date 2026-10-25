// Isolated probes behind the RC1 WebKit findings (no OneLine code involved in probe 1).
// Usage: node qa/rc1-webkit-probes.cjs [baseURL]
// 1. Does preventDefault() on pointerdown suppress the click after a touch tap? (per engine)
// 2. Collapsed Journey "Get tickets" links: rect, innerText, inert, checkVisibility (per engine, phone).
// 3. Compare dialog: where focus lands after a mouse-opened dialog closes (per engine).
const playwright = require("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4188";
const html = `<!doctype html><meta name=viewport content="width=device-width"><input id=i value=New>
<ul><li id=a style="padding:20px">pointerdown prevented</li><li id=b style="padding:20px">mousedown prevented</li><li id=c style="padding:20px">no prevent</li></ul>
<script>window.log=[];a.addEventListener('pointerdown',e=>e.preventDefault());b.addEventListener('mousedown',e=>e.preventDefault());
for(const el of [a,b,c]) el.addEventListener('click',()=>log.push('click '+el.id));
i.addEventListener('blur',()=>log.push('blur'));</script>`;
const phone = (e) => e === "webkit" ? { ...playwright.devices["iPhone 13"] }
  : e === "chromium" ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }
  : { viewport: { width: 390, height: 844 }, hasTouch: true };
(async () => {
  for (const e of ["chromium", "firefox", "webkit"]) {
    const b = await playwright[e].launch();
    const ctx = await b.newContext(phone(e));
    const p = await ctx.newPage();
    await p.setContent(html);
    for (const id of ["a", "b", "c"]) {
      await p.evaluate(() => { window.log = []; document.getElementById("i").focus(); });
      await p.locator("#" + id).tap();
      await p.waitForTimeout(200);
      console.log(`probe1 ${e} tap li#${id} (${id === "a" ? "pointerdown prevented" : id === "b" ? "mousedown prevented" : "no prevent"}): ${JSON.stringify(await p.evaluate(() => window.log))}`);
    }
    await p.goto(base + "/journey/regional-connection");
    await p.locator("#timeline-title").waitFor();
    await p.waitForTimeout(600);
    console.log(`probe2 ${e} collapsed links: ${JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("[id^=segment-details-] a")].slice(0, 2).map((a) => {
      const r = a.getBoundingClientRect();
      return { h: Math.round(r.height), w: Math.round(r.width), innerText: a.innerText.slice(0, 20), inert: a.closest("[inert]") !== null, visible: a.checkVisibility({ opacityProperty: true }) };
    })))}`);
    await ctx.close();
    const d = await b.newPage({ viewport: { width: 1280, height: 900 } });
    await d.goto(base + "/");
    const checks = d.locator(".compare-route-check input[type=checkbox]");
    await checks.nth(0).check(); await checks.nth(1).check();
    await d.locator(".compare-tray-action").click();
    await d.locator("dialog[open]").waitFor();
    await d.keyboard.press("Escape"); await d.waitForTimeout(250);
    const mouse = await d.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`.slice(0, 60));
    await d.locator(".compare-tray-action").focus();
    await d.keyboard.press("Enter");
    await d.locator("dialog[open]").waitFor();
    await d.keyboard.press("Escape"); await d.waitForTimeout(250);
    const kbd = await d.evaluate(() => `${document.activeElement?.tagName}.${document.activeElement?.className}`.slice(0, 60));
    console.log(`probe3 ${e} focus after close: mouse-opened → ${mouse}; keyboard-opened → ${kbd}`);
    await b.close();
  }
})().catch((err) => { console.error(err); process.exit(1); });
