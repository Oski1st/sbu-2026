// OneLine combined-state QA run. Usage: node qa.cjs <baseURL> <shotDir>
const { chromium } = require("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const shots = process.argv[3] ?? ".";
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};

(async () => {
  // HTTP-level checks
  for (const p of ["/", "/search", "/journey/regional-connection", "/wallet/amtrak-connection", "/journey/bogus"]) {
    const r = await fetch(base + p, { headers: { accept: "text/html" } });
    log(`HTTP deep link ${p}`, r.status === 200, String(r.status));
  }
  const septa = await fetch(base + "/api/transit/septa/trains");
  const body = await septa.text();
  let count = "n/a";
  try { count = JSON.parse(body).length; } catch {}
  log("SEPTA proxy GET", [200, 502, 504].includes(septa.status),
    `status ${septa.status}, cache-control ${septa.headers.get("cache-control")}, records ${count}`);
  const q = await fetch(base + "/api/transit/septa/trains?x=1");
  log("SEPTA proxy rejects query string", q.status >= 400, String(q.status));
  const post = await fetch(base + "/api/transit/septa/trains", { method: "POST" });
  log("SEPTA proxy rejects POST", post.status >= 400, String(post.status));
  const asset = await fetch(base + "/assets/missing.js");
  log("Missing asset is 404, not SPA HTML", asset.status === 404, String(asset.status));
  const bad = await fetch(base + "/journey/%E0%A4%A", { headers: { accept: "text/html" } });
  log("Malformed percent-encoding returns 400 (not a crash)", bad.status === 400, String(bad.status));
  const unknownApi = await fetch(base + "/api/nope", { headers: { accept: "text/html" } });
  log("Unknown /api path is 404", unknownApi.status === 404, String(unknownApi.status));

  const browser = await chromium.launch();
  const errors = [];
  const watch = (page) => {
    page.on("pageerror", (e) => errors.push(`${page.url()} pageerror ${e.message}`));
    page.on("console", (m) => m.type() === "error" && errors.push(`${page.url()} console ${m.text()}`));
  };

  for (const [tripId, legs, agencies] of [
    ["regional-connection", 4, ["SEPTA", "NJ TRANSIT", "LIRR"]],
    ["amtrak-connection", 3, ["Amtrak", "LIRR"]],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + "/");
    const card = page.locator(`a.select-route[href="/journey/${tripId}"]`);
    log(`[${tripId}] route card on Search`, (await card.count()) === 1);
    await card.click();
    await page.waitForURL(`**/journey/${tripId}`);
    await page.locator("h1").first().waitFor();
    const jText = await page.locator("#main-content").innerText();
    log(`[${tripId}] Journey renders`, /Philadelphia/.test(jText) && /Stony Brook/.test(jText));
    log(`[${tripId}] Journey has in-page Wallet CTA`,
      (await page.locator(`#main-content a[href="/wallet/${tripId}"]`).count()) > 0);
    const nestedMain = await page.locator("main main").count();
    log(`[${tripId}] Journey: no nested <main>`, nestedMain === 0, `${nestedMain} nested`);
    await page.screenshot({ path: `${shots}/${tripId}-journey-desktop.png`, fullPage: true });
    await page.reload();
    await page.locator("h1").first().waitFor();
    log(`[${tripId}] Journey survives refresh`, /Stony Brook/.test(await page.locator("#main-content").innerText()));

    await page.getByRole("link", { name: "Wallet" }).first().click();
    await page.waitForURL(`**/wallet/${tripId}`);
    await page.locator(".oneline-wallet h1").waitFor();
    const legCount = await page.locator(".ol-ticket-list > li").count();
    log(`[${tripId}] Wallet leg count`, legCount === legs, `${legCount} (expected ${legs})`);
    const wText = await page.locator(".oneline-wallet").innerText();
    log(`[${tripId}] Wallet agencies`, agencies.every((a) => wText.includes(a)), agencies.join(", "));
    const hasSepta = (await page.locator("#ol-live-heading").count()) > 0;
    log(`[${tripId}] SEPTA panel only when trip has SEPTA`, hasSepta === agencies.includes("SEPTA"));
    if (hasSepta) {
      await page.waitForFunction(() => !document.body.innerText.includes("Checking the official SEPTA feed"), null, { timeout: 10000 });
      const live = await page.locator(".ol-live").innerText();
      log(`[${tripId}] SEPTA panel state`, /Live feed fetched|Live data unavailable/.test(live),
        live.replace(/\s+/g," ").slice(0,160));
      log(`[${tripId}] live data labelled as not replacing sample times`,
        /remain simulated|unavailable/i.test(live));
    }
    await page.screenshot({ path: `${shots}/${tripId}-wallet-desktop.png`, fullPage: true });
    await page.reload();
    await page.locator(".oneline-wallet h1").waitFor();
    log(`[${tripId}] Wallet survives refresh`, (await page.locator(".ol-ticket-list > li").count()) === legs);
    await ctx.close();
  }

  // Invalid IDs
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    watch(page);
    for (const p of ["/journey/bogus", "/wallet/bogus", "/wallet"]) {
      await page.goto(base + p);
      await page.waitForTimeout(400);
      const t = await page.locator("#main-content").innerText();
      log(`Invalid/missing ID ${p}`, /not found|Choose|choose/i.test(t), t.split("\n").find(Boolean));
    }
    await page.goto(base + "/journey/bogus");
    await page.screenshot({ path: `${shots}/invalid-journey.png` });
    await ctx.close();
  }

  // Mobile layouts
  for (const width of [390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    watch(page);
    for (const p of ["/", "/journey/regional-connection", "/wallet/regional-connection", "/journey/amtrak-connection", "/wallet/amtrak-connection"]) {
      await page.goto(base + p);
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      log(`Mobile ${width}px ${p} no horizontal overflow`, overflow <= 0, `overflow ${overflow}px`);
      const slug = p === "/" ? "search" : p.slice(1).replace("/", "-");
      await page.screenshot({ path: `${shots}/mobile-${width}-${slug}.png`, fullPage: true });
    }
    await ctx.close();
  }

  // Keyboard navigation
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + "/");
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
    log("Keyboard: first Tab is skip link", /Skip to content/.test(first ?? ""), first);
    let reached = false;
    for (let i = 0; i < 60 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.activeElement?.getAttribute("href") === "/journey/regional-connection");
    }
    log("Keyboard: reach 'Choose this route' by Tab", reached);
    if (reached) {
      const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      log("Keyboard: visible focus outline on route CTA", ring !== "none", ring);
      await page.keyboard.press("Enter");
      await page.waitForURL("**/journey/regional-connection");
      const focused = await page.evaluate(() => document.activeElement?.id);
      log("Keyboard: focus moves to main after navigation", focused === "main-content", focused);
      const buttons = page.locator("#main-content button");
      const n = await buttons.count();
      let expandable = false;
      for (let i = 0; i < n; i++) {
        const b = buttons.nth(i);
        if ((await b.getAttribute("aria-expanded")) !== null) {
          await b.focus();
          await page.keyboard.press("Enter");
          expandable = (await b.getAttribute("aria-expanded")) === "true";
          break;
        }
      }
      log("Keyboard: Journey segment expands with Enter (aria-expanded)", expandable);
      await page.goto(base + "/wallet/regional-connection");
      await page.locator(".ol-ticket-list > li").first().waitFor();
      const cb = page.locator(".ol-ticket-list input[type=checkbox], .ol-ticket-list button").first();
      await cb.focus();
      await page.keyboard.press("Space");
      const progress = await page.locator("progress").getAttribute("value");
      log("Keyboard: Wallet checklist toggles with Space", progress === "1", `progress ${progress}`);
    }
    await ctx.close();
  }

  await browser.close();
  log("No page errors / console errors", errors.length === 0, errors.slice(0, 5).join(" ; "));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
})().catch((e) => { console.error(e); process.exit(1); });
