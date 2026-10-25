// Click-through for every operator's ticket link (feat/purchase-links).
// Usage: node qa/purchase-links-click.cjs http://127.0.0.1:4204 [screenshot-dir]
// Every non-local request (amtrak.com included) is answered by a local stand-in page,
// so no operator site is ever contacted; the assertion is on the URL each link opens.
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const base = (process.argv[2] || "http://127.0.0.1:4204").replace(/\/$/, "");
const shots = process.argv[3];
const DATE = "2026-11-12";
const results = [];
const log = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`); };
const amtrak = (from, to, date) => `https://www.amtrak.com/tickets/departure.html?from_ticketing_stop_time_id=%5B%22${from}%22%5D&to_ticketing_stop_time_id=%5B%22${to}%22%5D&service_date=%5B%22${date}%22%5D`;
const flix = (shop, from, to, date) => `https://${shop}/search?departureCity=${from}&arrivalCity=${to}&rideDate=${date.split("-").reverse().join(".")}&adult=1`;
const CITY = { philadelphia: "fd509c08-0a3e-4a44-b933-79f4a9db13da", newYork: "c0a47c54-53ea-46dc-984b-b764fc0b2fa9", boston: "eeff627f-2fda-4e75-8468-783d47955b3a" };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const external = [];
  await context.route((url) => !url.href.startsWith(base), (route) => {
    external.push(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>Operator stand-in</title><p>Local stand-in page</p>" });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  async function open(link, name, expected) {
    const anchor = await link.evaluate((a) => ({ target: a.target, rel: a.rel, href: a.href, name: a.textContent.replace(/\s+/g, " ").trim() }));
    const [popup] = await Promise.all([context.waitForEvent("page"), link.click()]);
    await popup.waitForLoadState("domcontentloaded");
    const opened = popup.url();
    const ok = opened === expected && anchor.target === "_blank" && /noreferrer/.test(anchor.rel) && anchor.name.includes("(opens in a new tab)");
    log(name, ok, ok ? opened : `opened ${opened}; expected ${expected}; target=${anchor.target} rel=${anchor.rel}`);
    await popup.close();
    return anchor;
  }
  const routeCard = (title) => page.locator(".route-card").filter({ has: page.getByRole("heading", { name: title }) });

  // 1. Search (?date=) → RouteCard details: SEPTA trip planner, NJ TRANSIT, LIRR, Amtrak.
  await page.goto(`${base}/?from=Philadelphia&to=Stony%20Brook&date=${DATE}`);
  let card = routeCard("The scenic connection");
  await card.getByRole("button", { name: "View route details" }).click();
  if (shots) await card.screenshot({ path: path.join(shots, "search-regional-details-1280.png") });
  const septaHref = await card.locator("a[data-purchase-kind]").nth(0).getAttribute("href");
  log("Search · SEPTA link is the plan.septa.org planner for the Search date", septaHref.startsWith("https://plan.septa.org/#/?") && septaHref.includes(`date=${DATE}`), septaHref);
  await open(card.locator("a[data-purchase-kind]").nth(0), "Search · SEPTA click opens that planner URL", septaHref);
  await open(card.locator("a[data-purchase-kind]").nth(1), "Search · NJ TRANSIT → exact WebTicketing purchase", "https://webtickets.njtransit.com/?origin=180&destination=0");
  await open(card.locator("a[data-purchase-kind]").nth(2), "Search · LIRR → official TrainTime page", "https://www.mta.info/traintime");
  card = routeCard("The express connection");
  await card.getByRole("button", { name: "View route details" }).click();
  await open(card.locator("a[data-purchase-kind]").nth(0), "Search · Amtrak → non-expiring From/To/Date link", amtrak("PHL", "NYP", DATE));

  // 2. Choose the Amtrak route → Journey keeps the Search date (remembered in this tab).
  await card.getByRole("link", { name: /Choose this route/ }).click();
  await page.waitForURL("**/journey/amtrak-connection");
  await page.getByRole("heading", { name: "Journey timeline" }).waitFor();
  const journeyLinks = page.locator("main a[data-purchase-kind]");
  log("Journey · one visible ticket link per segment, none inert or hidden", await journeyLinks.count() === 3 &&
    (await page.locator("[inert] a, [aria-hidden='true'] a").count()) === 0, `${await journeyLinks.count()} links`);
  const journeyAmtrak = await open(journeyLinks.nth(0), "Journey · Amtrak uses the Search date", amtrak("PHL", "NYP", DATE));
  log("Journey · Amtrak label names the trip and date", journeyAmtrak.name.startsWith("Open Philadelphia, 30th Street → New York Penn Station on Amtrak (Nov 12)"), journeyAmtrak.name);
  if (shots) await page.screenshot({ path: path.join(shots, "journey-amtrak-1280.png"), fullPage: true });

  // 3. Clipboard: granted → copied; denied (+ legacy copy refused) → visible read-only field.
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
  await open(journeyLinks.nth(0), "Journey · Amtrak click with clipboard allowed", amtrak("PHL", "NYP", DATE));
  await page.bringToFront();
  const status = page.locator(".amtrak-handoff-status").first();
  await status.filter({ hasText: "Copied" }).waitFor({ timeout: 3000 }).catch(() => {});
  const copied = await page.evaluate(() => navigator.clipboard.readText()).catch((error) => `read failed: ${error.message}`);
  log("Clipboard allowed · trip details copied with the Search date", /Thu, Nov 12, 2026/.test(copied) && /Philadelphia, 30th Street → New York Penn Station/.test(copied) && (await status.textContent()) === "Copied", copied);
  await page.reload();
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
    document.execCommand = () => false;
  });
  await open(page.locator("main a[data-purchase-kind]").nth(0), "Journey · Amtrak click with clipboard denied still opens the link", amtrak("PHL", "NYP", DATE));
  await page.bringToFront();
  const field = page.locator(".amtrak-handoff-field input").first();
  await field.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
  const manual = await page.evaluate(() => {
    const input = document.querySelector(".amtrak-handoff-field input");
    return input && { visible: !!(input.offsetWidth && input.offsetHeight), focused: document.activeElement === input, tabIndex: input.tabIndex,
      hidden: input.getAttribute("aria-hidden"), value: input.value, selected: input.selectionEnd - input.selectionStart,
      status: document.querySelector(".amtrak-handoff-status")?.textContent };
  });
  log("Clipboard denied · visible, focused, selected read-only field with the trip details", !!manual && manual.visible && manual.focused && manual.tabIndex === 0 &&
    manual.hidden === null && /Thu, Nov 12, 2026/.test(manual.value) && manual.selected === manual.value.length && /press Ctrl\+C/.test(manual.status), JSON.stringify(manual));
  if (shots) await page.screenshot({ path: path.join(shots, "journey-amtrak-clipboard-denied-1280.png") });

  // 4. Wallet (via the Journey CTA) keeps the date; LIRR names are distinct.
  await page.goto(`${base}/journey/amtrak-connection`);
  await page.locator('#main-content a[href="/wallet/amtrak-connection"]').first().click();
  await page.waitForURL("**/wallet/amtrak-connection");
  await page.locator(".ol-ticket-list").waitFor();
  const wallet = page.locator(".ol-ticket-list a[data-purchase-kind]");
  await open(wallet.nth(0), "Wallet · Amtrak uses the Search date", amtrak("PHL", "NYP", DATE));
  const lirrNames = await Promise.all([1, 2].map((i) => wallet.nth(i).evaluate((a) => a.textContent.replace(/\s+/g, " ").trim())));
  log("Wallet · the two LIRR links have distinct names with their stations", lirrNames[0] !== lirrNames[1] && lirrNames[0].includes("New York Penn Station to Huntington") && lirrNames[1].includes("Huntington to Stony Brook"), lirrNames.join(" | "));
  await open(wallet.nth(1), "Wallet · LIRR → official TrainTime page", "https://www.mta.info/traintime");
  if (shots) await page.screenshot({ path: path.join(shots, "wallet-amtrak-1280.png"), fullPage: true });

  // 5. FlixBus and Greyhound from Search, then Journey and Wallet.
  await page.goto(`${base}/?from=Philadelphia&to=New%20York&date=${DATE}`);
  card = routeCard("FlixBus coach concept");
  await card.getByRole("button", { name: "View route details" }).click();
  await open(card.locator("a[data-purchase-kind]").nth(0), "Search · FlixBus → exact shop search", flix("shop.flixbus.com", CITY.philadelphia, CITY.newYork, DATE));
  await card.getByRole("link", { name: /Choose this route/ }).click();
  await page.waitForURL("**/journey/east-philadelphia--new-york--flixbus");
  await page.getByRole("heading", { name: "Journey timeline" }).waitFor();
  await open(page.locator("main a[data-purchase-kind]").nth(0), "Journey · FlixBus uses the Search date", flix("shop.flixbus.com", CITY.philadelphia, CITY.newYork, DATE));
  await page.goto(`${base}/?from=Boston&to=New%20York&date=${DATE}`);
  card = routeCard("Greyhound coach concept");
  await card.getByRole("button", { name: "View route details" }).click();
  await open(card.locator("a[data-purchase-kind]").nth(0), "Search · Greyhound → exact shop search", flix("shop.greyhound.com", CITY.boston, CITY.newYork, DATE));
  await card.getByRole("link", { name: /Choose this route/ }).click();
  await page.waitForURL("**/journey/east-boston--new-york--greyhound");
  await page.locator('#main-content a[href="/wallet/east-boston--new-york--greyhound"]').first().click();
  await page.waitForURL("**/wallet/east-boston--new-york--greyhound");
  await page.locator(".ol-ticket-list").waitFor();
  await open(page.locator(".ol-ticket-list a[data-purchase-kind]").nth(0), "Wallet · Greyhound uses the Search date", flix("shop.greyhound.com", CITY.boston, CITY.newYork, DATE));

  // 6. Homepage fallback: a FlixBus city without a Flix id (Trenton) opens flixbus.com.
  await page.goto(`${base}/?from=Trenton&to=New%20York&date=${DATE}`);
  card = routeCard("FlixBus coach concept");
  await card.getByRole("button", { name: "View route details" }).click();
  await open(card.locator("a[data-purchase-kind]").nth(0), "Search · FlixBus without a Flix city id → homepage", "https://www.flixbus.com/");

  // 7. ?date= on a deep link wins over the remembered Search date.
  await page.goto(`${base}/wallet/regional-connection?date=2026-12-01`);
  const njt = page.locator(".ol-ticket-list a[data-purchase-kind]").nth(1);
  await open(njt, "Wallet ?date= · NJ TRANSIT WebTicketing", "https://webtickets.njtransit.com/?origin=180&destination=0");
  const septaWallet = await page.locator(".ol-ticket-list a[data-purchase-kind]").nth(0).getAttribute("href");
  log("Wallet ?date= · SEPTA planner uses 2026-12-01", septaWallet.includes("date=2026-12-01"), septaWallet);

  // 8. Mobile layout snapshots for review.
  if (shots) for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`${base}/journey/regional-connection`);
    await page.getByRole("heading", { name: "Journey timeline" }).waitFor();
    await page.screenshot({ path: path.join(shots, `journey-regional-${width}.png`), fullPage: true });
    await page.goto(`${base}/wallet/regional-connection`);
    await page.locator(".ol-ticket-list").waitFor();
    await page.screenshot({ path: path.join(shots, `wallet-regional-${width}.png`), fullPage: true });
  }

  const realAmtrak = external.filter((url) => /amtrak\.com/.test(url));
  log("amtrak.com only ever reached the local stand-in", realAmtrak.length > 0, `${realAmtrak.length} stand-in responses`);
  log("No page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} checks passed`);
  if (shots) fs.writeFileSync(path.join(shots, "external-requests.txt"), external.join("\n"));
  process.exit(passed === results.length ? 0 : 1);
})().catch((error) => { console.error(error); process.exit(1); });
