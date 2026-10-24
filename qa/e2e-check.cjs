// OneLine end-to-end QA run against a running server (pnpm build && pnpm start).
// Usage: node qa/e2e-check.cjs <baseURL> <shotDir>
// Install Chromium once with pnpm exec playwright install chromium.
const { chromium } = require("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const shots = process.argv[3] ?? "qa-results/screenshots";
require("node:fs").mkdirSync(shots, { recursive: true });
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};
const settled = (page) =>
  page.waitForFunction(
    () => !document.querySelector(".ol-live")?.textContent?.includes("Checking the official SEPTA feed"),
    null,
    { timeout: 10000 },
  );
const flat = (s) => s.replace(/\s+/g, " ").trim();

// Buttons and links in the given scope with no accessible name, or whose text is clipped.
async function unlabelledOrClipped(page, scope = "body") {
  return page.evaluate((scope) => {
    const bad = [];
    for (const el of document.querySelectorAll(`${scope} button, ${scope} a[href], ${scope} [role=button]`)) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden") continue;
      if (el.closest(".sr-only, .ol-sr-only")) continue;
      const name = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("title") || "").trim();
      if (!name) bad.push(`unnamed <${el.tagName.toLowerCase()}> ${el.outerHTML.slice(0, 80)}`);
      else if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflow !== "visible")
        bad.push(`clipped "${name.slice(0, 40)}"`);
      else if (r.right > window.innerWidth + 1) bad.push(`off-screen "${name.slice(0, 40)}"`);
    }
    return bad;
  }, scope);
}

// Shell contract (README "Shared shell contract"): exactly one <main>, never nested.
const landmarks = (page) =>
  page.evaluate(() => ({ mains: document.querySelectorAll("main").length, nested: document.querySelectorAll("main main").length }));
// Page-level navigation drawn under the site header (finding 4).
const pageNav = (page) =>
  page.evaluate(() => {
    const found = [];
    const content = document.getElementById("main-content");
    if (!content) return found;
    for (const nav of content.querySelectorAll("nav")) found.push(nav.getAttribute("aria-label") || "nav");
    for (const a of content.querySelectorAll("a")) if (/^\W*Search routes$/.test(a.innerText.trim())) found.push(`"${a.innerText.trim()}" link`);
    return found;
  });

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
    page.on("console", (m) => {
      // Simulated SEPTA failures log an expected "Failed to load resource" for the proxy URL.
      if (m.type() !== "error" || m.location()?.url?.includes("/api/transit/septa/")) return;
      errors.push(`${page.url()} console ${m.text()}`);
    });
  };

  // Search → Compare → Journey → Wallet, once per trip, choosing the route from the Compare dialog.
  for (const [tripId, legs, agencies] of [
    ["regional-connection", 4, ["SEPTA", "NJ TRANSIT", "LIRR"]],
    ["amtrak-connection", 3, ["Amtrak", "LIRR"]],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + "/");
    const sl = await landmarks(page);
    log(`[${tripId}] Search: exactly one <main>, none nested`, sl.mains === 1 && sl.nested === 0, JSON.stringify(sl));
    log(`[${tripId}] route card on Search`,
      (await page.locator(`.route-card a.select-route[href="/journey/${tripId}"], a.select-route[href="/journey/${tripId}"]`).count()) >= 1);

    const checks = page.locator(".compare-route-check input[type=checkbox]");
    const nChecks = await checks.count();
    for (let i = 0; i < nChecks; i++) await checks.nth(i).check();
    const tray = page.locator(".compare-tray");
    log(`[${tripId}] Compare tray shows 2 of 2`, /2 of 2 routes selected/.test(await tray.innerText()));
    await page.locator(".compare-tray-action").click();
    const dialog = page.locator("dialog.comparison-dialog[open]");
    await dialog.waitFor();
    const dText = flat(await dialog.innerText());
    log(`[${tripId}] Compare dialog labels sample data`, /sample data/i.test(dText), dText.slice(0, 110));
    log(`[${tripId}] Compare dialog buttons named`, (await unlabelledOrClipped(page, "dialog.comparison-dialog")).length === 0,
      (await unlabelledOrClipped(page, "dialog.comparison-dialog")).join("; "));
    if (tripId === "regional-connection")
      await page.screenshot({ path: `${shots}/compare-dialog-desktop.png` });
    await dialog.locator(`a.select-route[href="/journey/${tripId}"]`).click();
    await page.waitForURL(`**/journey/${tripId}`);
    // React keeps Search on screen while the lazy Journey chunk loads, so wait for Journey-only content.
    await page.locator(`#main-content a[href="/wallet/${tripId}"]`).first().waitFor();
    log(`[${tripId}] Compare dialog closes after choosing`, (await page.locator("dialog[open]").count()) === 0);
    const jText = await page.locator("#main-content").innerText();
    log(`[${tripId}] Journey renders`, /Philadelphia/.test(jText) && /Stony Brook/.test(jText));
    const jl = await landmarks(page);
    log(`[${tripId}] Journey: exactly one <main>, none nested`, jl.mains === 1 && jl.nested === 0, JSON.stringify(jl));
    const jNav = await pageNav(page);
    log(`[${tripId}] Journey: no duplicate page navigation`, jNav.length === 0, jNav.join(", "));
    await page.screenshot({ path: `${shots}/${tripId}-journey-desktop.png`, fullPage: true });
    await page.reload();
    await page.locator(`#main-content a[href="/wallet/${tripId}"]`).first().waitFor();
    log(`[${tripId}] Journey survives refresh`, /Stony Brook/.test(await page.locator("#main-content").innerText()));

    const cta = page.locator(`#main-content a[href="/wallet/${tripId}"]`);
    log(`[${tripId}] Journey has in-page Wallet link`, (await cta.count()) > 0,
      (await cta.count()) ? flat(await cta.first().innerText()) : "");
    await cta.first().click();
    await page.waitForURL(`**/wallet/${tripId}`);
    await page.locator(".oneline-wallet h1").waitFor();
    const wl = await landmarks(page);
    log(`[${tripId}] Wallet: exactly one <main>, none nested`, wl.mains === 1 && wl.nested === 0, JSON.stringify(wl));
    const wNav = await pageNav(page);
    log(`[${tripId}] Wallet: no duplicate page navigation`, wNav.length === 0, wNav.join(", "));
    const legCount = await page.locator(".ol-ticket-list > li").count();
    log(`[${tripId}] Wallet leg count`, legCount === legs, `${legCount} (expected ${legs})`);
    const wText = await page.locator(".oneline-wallet").innerText();
    log(`[${tripId}] Wallet agencies`, agencies.every((a) => wText.includes(a)), agencies.join(", "));
    const footer = flat(await page.locator("footer").last().innerText());
    log(`[${tripId}] Footer does not deny live data`, !/No live arrival data/i.test(footer), footer.slice(-80));
    const hasSepta = (await page.locator("#ol-live-heading").count()) > 0;
    log(`[${tripId}] SEPTA panel only when trip has SEPTA`, hasSepta === agencies.includes("SEPTA"));
    if (hasSepta) {
      await settled(page);
      const live = flat(await page.locator(".ol-live").innerText());
      log(`[${tripId}] real SEPTA panel state`, /Live feed fetched|Live data unavailable/.test(live), live.slice(0, 160));
    }
    await page.screenshot({ path: `${shots}/${tripId}-wallet-desktop.png`, fullPage: true });
    await page.reload();
    await page.locator(".oneline-wallet h1").waitFor();
    log(`[${tripId}] Wallet survives refresh`, (await page.locator(".ol-ticket-list > li").count()) === legs);
    await ctx.close();
  }

  // Compare: refresh resets the dialog cleanly; Escape closes it and returns focus.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + "/");
    const checks = page.locator(".compare-route-check input[type=checkbox]");
    await checks.nth(0).focus();
    await page.keyboard.press("Space");
    log("Compare: checkbox toggles with Space", await checks.nth(0).isChecked());
    log("Compare: tray asks for a second route", /Select one more route/.test(await page.locator(".compare-tray").innerText()));
    log("Compare: action disabled with 1 route", await page.locator(".compare-tray-action").isDisabled());
    await checks.nth(1).check();
    await page.locator(".compare-tray-action").focus();
    await page.keyboard.press("Enter");
    await page.locator("dialog.comparison-dialog[open]").waitFor();
    const inDialog = await page.evaluate(() => !!document.activeElement?.closest("dialog"));
    log("Compare: focus moves into dialog", inDialog);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    log("Compare: Escape closes dialog", (await page.locator("dialog[open]").count()) === 0);
    const back = await page.evaluate(() => document.activeElement?.className ?? "");
    log("Compare: focus returns to Compare button", /compare-tray-action/.test(back), back);
    await page.locator(".compare-tray-action").click();
    await page.reload();
    await page.waitForTimeout(400);
    log("Compare: refresh resets dialog and tray without errors",
      (await page.locator("dialog[open]").count()) === 0 && (await page.locator(".compare-tray").count()) === 0);
    await ctx.close();
  }

  // Invalid IDs
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    watch(page);
    for (const p of ["/journey/bogus", "/wallet/bogus", "/wallet", "/journey", "/journey/regional-connection%20x", "/nowhere"]) {
      await page.goto(base + p);
      await page.waitForTimeout(400);
      const t = await page.locator("#main-content").innerText();
      log(`Invalid/missing ID ${p}`, /not found|Choose|choose|off the line/i.test(t), t.split("\n").find(Boolean));
      const il = await landmarks(page);
      log(`Invalid/missing ID ${p}: exactly one <main>`, il.mains === 1 && il.nested === 0, JSON.stringify(il));
      await page.reload();
      await page.waitForTimeout(300);
      log(`Invalid/missing ID ${p} survives refresh`, /not found|Choose|choose|off the line/i.test(await page.locator("#main-content").innerText()));
    }
    await page.goto(base + "/journey/bogus");
    await page.screenshot({ path: `${shots}/invalid-journey.png` });
    await page.goto(base + "/wallet/bogus");
    await page.screenshot({ path: `${shots}/invalid-wallet.png` });
    await ctx.close();
  }

  // Mobile layouts and visible button text
  for (const width of [390, 320]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    watch(page);
    for (const p of ["/", "/journey/regional-connection", "/wallet/regional-connection", "/journey/amtrak-connection", "/wallet/amtrak-connection"]) {
      await page.goto(base + p);
      await page.waitForTimeout(700);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      log(`Mobile ${width}px ${p} no horizontal overflow`, overflow <= 0, `overflow ${overflow}px`);
      const badButtons = await unlabelledOrClipped(page);
      log(`Mobile ${width}px ${p} buttons/links named and unclipped`, badButtons.length === 0, badButtons.slice(0, 4).join("; "));
      const slug = p === "/" ? "search" : p.slice(1).replace("/", "-");
      await page.screenshot({ path: `${shots}/mobile-${width}-${slug}.png`, fullPage: true });
    }
    // Compare dialog on a phone
    await page.goto(base + "/");
    const checks = page.locator(".compare-route-check input[type=checkbox]");
    for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).check();
    await page.locator(".compare-tray-action").click();
    await page.locator("dialog.comparison-dialog[open]").waitFor();
    await page.waitForTimeout(300);
    const dlg = await page.evaluate(() => {
      const d = document.querySelector("dialog[open]").getBoundingClientRect();
      return { left: d.left, right: d.right, vw: window.innerWidth };
    });
    log(`Mobile ${width}px Compare dialog fits viewport`, dlg.left >= 0 && dlg.right <= dlg.vw, JSON.stringify(dlg));
    const dBad = await unlabelledOrClipped(page, "dialog.comparison-dialog");
    log(`Mobile ${width}px Compare dialog buttons named and unclipped`, dBad.length === 0, dBad.slice(0, 4).join("; "));
    await page.screenshot({ path: `${shots}/mobile-${width}-compare.png` });
    await ctx.close();
  }

  // Keyboard navigation
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    watch(page);
    await page.goto(base + "/");
    await page.waitForTimeout(800);
    await page.keyboard.press("Tab");
    const first = await page.evaluate(() => document.activeElement?.textContent?.trim());
    log("Keyboard: first Tab is skip link", /Skip to content/.test(first ?? ""), first);
    let reached = false;
    for (let i = 0; i < 80 && !reached; i++) {
      await page.keyboard.press("Tab");
      reached = await page.evaluate(() => document.activeElement?.getAttribute("href") === "/journey/regional-connection");
    }
    log("Keyboard: reach 'Choose this route' by Tab", reached);
    if (reached) {
      const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      log("Keyboard: visible focus outline on route CTA", ring !== "none", ring);
      await page.keyboard.press("Enter");
      await page.waitForURL("**/journey/regional-connection");
      await page.locator("#main-content h1").first().waitFor();
      await page.waitForTimeout(500);
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
      let walletLink = false;
      for (let i = 0; i < 120 && !walletLink; i++) {
        await page.keyboard.press("Tab");
        walletLink = await page.evaluate(() => document.activeElement?.getAttribute("href") === "/wallet/regional-connection"
          && !!document.activeElement.closest("#main-content"));
      }
      log("Keyboard: reach in-page Wallet link by Tab", walletLink);
      if (walletLink) {
        await page.keyboard.press("Enter");
        await page.waitForURL("**/wallet/regional-connection");
      } else await page.goto(base + "/wallet/regional-connection");
      await page.locator(".ol-ticket-list > li").first().waitFor();
      const cb = page.locator(".ol-ticket-list input[type=checkbox], .ol-ticket-list button").first();
      await cb.focus();
      await page.keyboard.press("Space");
      const progress = await page.locator("progress").getAttribute("value");
      log("Keyboard: Wallet checklist toggles with Space", progress === "1", `progress ${progress}`);
    }
    await ctx.close();
  }

  // SEPTA states as seen by the browser. Proxy responses are simulated so each state is deterministic.
  const sampleTrain = JSON.stringify([{ trainno: "9999", line: "QA Test Line", dest: "QA Terminal", nextstop: "QA Stop", late: 3 }]);
  const walletTimes = async (page) =>
    page.locator(".ol-ticket-list").innerText().then((t) => (t.match(/\d{1,2}:\d{2}\s?[AP]M/g) ?? []).join(","));
  let baselineTimes = null;
  for (const [label, handler, expected] of [
    ["502 upstream failure", (r) => r.fulfill({ status: 502, contentType: "application/json", body: "{\"error\":\"septa_unavailable\"}" }), /Live data unavailable/],
    ["504 timeout", (r) => r.fulfill({ status: 504, contentType: "application/json", body: "{\"error\":\"septa_timeout\"}" }), /Live data unavailable/],
    ["network error", (r) => r.abort(), /Live data unavailable/],
    ["malformed rows", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[{\"trainno\":1}]" }), /Live data unavailable/],
    ["empty feed", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "[]" }), /no active trains/],
    ["success", (r) => r.fulfill({ status: 200, contentType: "application/json", body: sampleTrain }), /Live feed fetched.*QA Test Line · Train 9999/],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    watch(page);
    await page.route("**/api/transit/septa/trains", handler);
    await page.goto(base + "/wallet/regional-connection");
    await page.locator(".ol-live").waitFor();
    await settled(page);
    const live = flat(await page.locator(".ol-live").innerText());
    const showsTrains = /Train \d/.test(live);
    log(`SEPTA browser state: ${label}`, expected.test(live) && (label === "success" || !showsTrains), live.slice(0, 140));
    const times = await walletTimes(page);
    if (baselineTimes === null) baselineTimes = times;
    log(`SEPTA ${label}: sample itinerary times unchanged`, times === baselineTimes && times.length > 0, times);
    if (label === "success")
      log("SEPTA success: labelled agency-wide, not matched to journey", /not matched to your journey.*remain simulated/.test(live));
    await page.screenshot({ path: `${shots}/septa-${label.replace(/\W+/g, "-")}.png`, fullPage: true });
    await ctx.close();
  }

  // Stale: a live snapshot expires after 60 s, including when the tab regains focus.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    watch(page);
    await page.clock.install();
    await page.route("**/api/transit/septa/trains", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: sampleTrain }));
    await page.goto(base + "/wallet/regional-connection");
    await page.locator(".ol-live").waitFor();
    await page.clock.runFor(1000);
    await settled(page);
    log("SEPTA stale: fresh snapshot lists trains", /Live feed fetched/.test(await page.locator(".ol-live").innerText()));
    await page.clock.runFor(61000);
    await page.waitForTimeout(100);
    const stale = flat(await page.locator(".ol-live").innerText());
    log("SEPTA stale: expires after 60 s and hides trains",
      /Snapshot expired · refresh to check/.test(stale) && !/Train 9999/.test(stale), stale.slice(0, 140));
    await page.screenshot({ path: `${shots}/septa-stale.png`, fullPage: true });
    await page.getByRole("button", { name: "Refresh" }).click();
    let restored = "";
    for (let i = 0; i < 20 && !/Live feed fetched.*Train 9999/.test(restored); i++) {
      await page.clock.runFor(250);
      await page.waitForTimeout(100);
      restored = flat(await page.locator(".ol-live").innerText());
    }
    log("SEPTA stale: Refresh restores a fresh snapshot", /Live feed fetched.*Train 9999/.test(restored), restored.slice(0, 100));
    await ctx.close();
  }

  await browser.close();
  log("No page errors / console errors", errors.length === 0, errors.slice(0, 5).join(" ; "));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });

