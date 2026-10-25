#!/usr/bin/env node
/*
 * OneLine "real rider" site walkthrough (QA only, no app changes).
 *
 * Usage:
 *   BASE_URL=http://127.0.0.1:4183 TARGET=candidate node qa/site-walkthrough-check.cjs
 *   BASE_URL=https://oneline-sbu-2026.onrender.com TARGET=production node qa/site-walkthrough-check.cjs
 *
 * Optional: OUT_DIR (screenshots, default docs/qa/site-walkthrough),
 *           CHECK_EXTERNAL=1 to probe external link HTTP status (one GET each, sequential).
 * Writes <OUT_DIR>/<TARGET>-results.json and prints a PASS/FAIL/INFO log.
 * Sequential and gentle: one browser, one page at a time, no load testing.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = (process.env.BASE_URL || "http://127.0.0.1:4183").replace(/\/$/, "");
const TARGET = process.env.TARGET || "candidate";
const OUT = process.env.OUT_DIR || "docs/qa/site-walkthrough";
const CHECK_EXTERNAL = process.env.CHECK_EXTERNAL === "1";
fs.mkdirSync(OUT, { recursive: true });

const results = [];
const consoleErrors = [];
const failedRequests = [];
const thirdParty = new Set();
const externalLinks = new Map(); // href -> {target, rel, page}

function record(status, id, detail = "") {
  results.push({ status, id, detail });
  console.log(`${status.padEnd(4)} ${id}${detail ? " — " + detail : ""}`);
}
const pass = (id, d) => record("PASS", id, d);
const fail = (id, d) => record("FAIL", id, d);
const info = (id, d) => record("INFO", id, d);
const check = (cond, id, okDetail = "", badDetail = "") =>
  cond ? pass(id, okDetail) : fail(id, badDetail || okDetail);
const shot = async (page, name, fullPage = false) => {
  const file = path.join(OUT, `${TARGET}-${name}.png`);
  await page.screenshot({ path: file, fullPage });
  return file;
};

function instrument(page, label) {
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(`[${label}] ${m.text()}`);
  });
  page.on("pageerror", (e) => consoleErrors.push(`[${label}] pageerror ${e.message}`));
  page.on("requestfailed", (r) => {
    const err = r.failure()?.errorText || "";
    // Aborted fetches on navigation are expected (AbortController cleanup).
    if (!/ERR_ABORTED/.test(err)) failedRequests.push(`[${label}] ${r.method()} ${r.url()} ${err}`);
  });
  page.on("response", (r) => {
    if (r.url().startsWith(BASE) && r.status() >= 400)
      failedRequests.push(`[${label}] HTTP ${r.status()} ${r.url()}`);
  });
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(BASE) && !u.startsWith("data:") && !u.startsWith("blob:")) thirdParty.add(u);
  });
}

async function collectLinks(page, label) {
  const links = await page.$$eval("a[href]", (as) =>
    as.map((a) => ({ href: a.href, target: a.target, rel: a.rel, text: (a.textContent || "").trim().slice(0, 50) })),
  );
  for (const l of links) {
    if (/^https?:/.test(l.href) && !l.href.startsWith(BASE) && !externalLinks.has(l.href))
      externalLinks.set(l.href, { ...l, page: label });
  }
  return links;
}

async function overflowX(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function clippedText(page) {
  // Text-bearing leaf elements whose content is wider than their box (visible clipping).
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (!el.offsetParent && cs.position !== "fixed") continue;
      if (el.closest("details:not([open])")) continue;
      const clips = ["hidden", "clip"].includes(cs.overflowX) || el.tagName === "INPUT";
      if (clips && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0) {
        const t = (el.value || el.textContent || "").trim().slice(0, 40);
        if (t && !el.classList.contains("sr-only") && !/sr-only/.test(el.className)) out.push(`${el.tagName}.${String(el.className).split(" ")[0]} "${t}" (${el.scrollWidth}>${el.clientWidth})`);
      }
    }
    return out.slice(0, 12);
  });
}

async function resultCount(page) {
  return page.locator("a", { hasText: "Choose this route" }).count();
}
async function statusText(page) {
  return (await page.locator("#results-title ~ p, .results-heading p").first().textContent().catch(() => ""))?.trim();
}
async function hasAutocomplete(page) {
  return (await page.locator('#origin[role="combobox"]').count()) > 0;
}
async function fillCity(page, field, text) {
  const input = page.locator(`#${field}`);
  await input.click();
  await input.fill("");
  await input.type(text, { delay: 25 });
}
async function submit(page) {
  await page.getByRole("button", { name: /Find my way/ }).click();
  await page.waitForTimeout(500);
}
async function plan(page, from, to) {
  await fillCity(page, "origin", from);
  await page.keyboard.press("Escape");
  await fillCity(page, "destination", to);
  await page.keyboard.press("Escape");
  await submit(page);
  return resultCount(page);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await ctx.newPage();
  instrument(page, "main");

  // ---------- 0. Wake a sleeping free-tier host (Render shows a 503 "Application loading" page) ----------
  const wakeStart = Date.now();
  let wakeStatus = 0;
  for (let i = 0; i < 24; i++) {
    try {
      const r = await fetch(BASE + "/", { headers: { Accept: "text/html" } });
      wakeStatus = r.status;
      if (r.status === 200) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 10000));
  }
  info("wake.cold-start-ms", `${Date.now() - wakeStart} (final status ${wakeStatus})`);

  // ---------- 1. Cold landing ----------
  const t0 = Date.now();
  const resp = await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 180000 });
  info("home.load-ms", String(Date.now() - t0));
  check(resp.status() === 200, "home.http-200", `status ${resp.status()}`);
  const assets = await page.$$eval("script[src],link[rel=stylesheet]", (els) => els.map((e) => e.getAttribute("src") || e.getAttribute("href")));
  info("home.assets", assets.join(", "));
  check(/OneLine/.test(await page.title()), "home.title", await page.title());
  check(await page.locator("h1").first().isVisible(), "home.h1-visible", (await page.locator("h1").first().innerText()).replace(/\n/g, " "));
  const imgs = await page.$$eval("img", (is) => is.filter((i) => i.complete && i.naturalWidth === 0).map((i) => i.src));
  check(imgs.length === 0, "home.no-broken-images", imgs.join(", "));
  await shot(page, "01-home-desktop", true);
  await collectLinks(page, "home");
  const auto = await hasAutocomplete(page);
  info("feature.autocomplete", String(auto));
  const hasDate = (await page.locator('input[type="date"]').count()) > 0;
  info("feature.date-time-inputs", String(hasDate));
  const hasCorridors = (await page.locator(".corridor-pick").count()) > 0;
  info("feature.corridor-shortcuts", String(hasCorridors));

  // ---------- 2. Default search ----------
  check((await resultCount(page)) === 2, "search.default-two-routes", `${await resultCount(page)} routes shown before submit`);
  await submit(page);
  check((await resultCount(page)) === 2, "search.default-submit", `${await resultCount(page)} routes after Find my way`);
  const focusedAfterSubmit = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  info("search.focus-after-submit", focusedAfterSubmit);

  // ---------- 3. Autocomplete by mouse and keyboard ----------
  if (auto) {
    await fillCity(page, "origin", "Bos");
    const opts = page.locator("#origin-listbox [role=option]");
    await opts.first().waitFor({ timeout: 3000 }).catch(() => {});
    const optTexts = await opts.allInnerTexts();
    info("auto.bos-suggestions", optTexts.map((t) => t.replace(/\n/g, " ")).join(" | "));
    await shot(page, "02-autocomplete-bos");
    const bostonOpt = opts.filter({ hasText: "Boston" }).first();
    if (await bostonOpt.count()) {
      await bostonOpt.click();
      check((await page.inputValue("#origin")).startsWith("Boston"), "auto.mouse-pick", await page.inputValue("#origin"));
    } else fail("auto.mouse-pick", "no Boston option for 'Bos'");
    check((await page.locator("#origin-listbox").count()) === 0, "auto.list-closes-after-pick");
    await fillCity(page, "destination", "New Y");
    await page.keyboard.press("ArrowDown");
    const active = await page.getAttribute("#destination", "aria-activedescendant");
    check(!!active, "auto.keyboard-arrowdown-activedescendant", String(active));
    await page.keyboard.press("Enter");
    const dv = await page.inputValue("#destination");
    check(/New York/.test(dv), "auto.keyboard-enter-pick", dv);
    const formUrlBefore = page.url();
    await submit(page);
    const n = await resultCount(page);
    check(n > 0, "plan.boston-new-york", `${n} routes; "${await statusText(page)}"`);
    check(/from=/.test(page.url()), "plan.url-updated", page.url().replace(BASE, ""));
    info("plan.url-before", formUrlBefore.replace(BASE, ""));
    await shot(page, "03-boston-new-york", false);
    // Escape closes list
    await fillCity(page, "origin", "Ph");
    await page.keyboard.press("Escape");
    check((await page.locator("#origin-listbox").count()) === 0, "auto.escape-closes");
    // Keyboard wrap ArrowUp
    await page.keyboard.press("ArrowUp");
    info("auto.arrowup-from-closed", String(await page.getAttribute("#origin", "aria-activedescendant")));
    await page.keyboard.press("Escape");
  } else {
    info("auto.skipped", "no combobox on this target");
    const n = await plan(page, "Boston", "New York");
    record(n > 0 ? "PASS" : "FAIL", "plan.boston-new-york", `${n} routes; "${await statusText(page)}"`);
    await shot(page, "03-boston-new-york", true);
  }

  // ---------- 4. Aliases, misspellings, unsupported, same city ----------
  const scenarios = [
    ["plan.alias-nyc-dc", "NYC", "DC", (n) => n > 0],
    ["plan.nyc-washington-full", "New York", "Washington", (n) => n > 0],
    ["plan.alias-philly-stony", "Philly", "Stony Brook", (n) => n === 2],
    ["plan.case-insensitive", "philadelphia", "stony brook", (n) => n === 2],
    ["plan.misspelling-bostn", "Bostn", "New York", null],
    ["plan.misspelling-philadelpia", "Philadelpia", "Stony Brook", null],
    ["plan.unsupported-chicago", "Chicago", "New York", (n) => n === 0],
    ["plan.same-city", "Boston", "Boston", (n) => n === 0],
    ["plan.reverse-stony-philly", "Stony Brook", "Philadelphia", null],
    ["plan.raleigh-charlotte", "Raleigh", "Charlotte", (n) => n > 0],
    ["plan.orlando-miami", "Orlando", "Miami", (n) => n > 0],
    ["plan.whitespace", "  Boston  ", "  New York ", (n) => n > 0],
  ];
  for (const [id, from, to, ok] of scenarios) {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const n = await plan(page, from, to);
    const st = await statusText(page);
    const empty = (await page.locator(".empty-state").innerText().catch(() => "")).replace(/\n/g, " ");
    const detail = `${n} routes; status "${st}"${empty ? `; empty-state "${empty}"` : ""}`;
    if (ok) check(ok(n), id, detail);
    else info(id, detail);
    if (/chicago|same-city|bostn/.test(id)) await shot(page, `04-${id.replace("plan.", "")}`);
  }
  // Empty-state recovery button
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await plan(page, "Chicago", "New York");
  const showDemo = page.getByRole("button", { name: /Show demo routes/ });
  if (await showDemo.count()) {
    await showDemo.click();
    await page.waitForTimeout(300);
    check((await resultCount(page)) === 2 && (await page.inputValue("#origin")) === "Philadelphia", "plan.empty-state-show-demo", `${await resultCount(page)} routes, origin=${await page.inputValue("#origin")}`);
  } else info("plan.empty-state-show-demo", "no recovery button");

  // ---------- 5. Swap ----------
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Swap origin and destination/ }).click();
  check((await page.inputValue("#origin")) === "Stony Brook" && (await page.inputValue("#destination")) === "Philadelphia", "search.swap", `${await page.inputValue("#origin")} / ${await page.inputValue("#destination")}`);
  await submit(page);
  info("search.swap-submit", `${await resultCount(page)} routes; "${await statusText(page)}"`);
  // Empty field submit
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.fill("#origin", "");
  await submit(page);
  const validity = await page.$eval("#origin", (e) => e.validationMessage);
  check(!!validity, "search.empty-origin-blocked", `validationMessage="${validity}"`);

  // ---------- 6. Date / time preferences ----------
  if (hasDate) {
    await page.goto(BASE + "/", { waitUntil: "networkidle" });
    const defDate = await page.inputValue('input[type="date"]');
    const today = new Date().toLocaleDateString("en-CA");
    record(defDate >= today ? "PASS" : "FAIL", "date.default-not-in-past", `default ${defDate}, today ${today}`);
    const minAttr = await page.getAttribute('input[type="date"]', "min");
    info("date.min-attribute", String(minAttr));
    await page.fill('input[type="date"]', "2026-11-02");
    await page.fill('input[type="time"]', "14:30");
    await submit(page);
    check(/date=2026-11-02/.test(page.url()) && /time=14%3A30|time=14:30/.test(page.url()), "date.saved-in-url", page.url().replace(BASE, ""));
    await page.reload({ waitUntil: "networkidle" });
    check((await page.inputValue('input[type="date"]')) === "2026-11-02" && (await page.inputValue('input[type="time"]')) === "14:30", "date.persists-on-reload");
    const firstTime = await page.locator(".route-card, article").first().innerText().catch(() => "");
    info("date.result-times-after-14:30-pref", (firstTime.match(/\d{1,2}:\d{2} [AP]M/g) || []).join(" -> "));
    await page.goto(BASE + "/?date=2026-02-30&time=25:99", { waitUntil: "networkidle" });
    info("date.malformed-url", `${await page.inputValue('input[type="date"]')} ${await page.inputValue('input[type="time"]')}`);
    await page.goto(BASE + "/?date=2020-01-01", { waitUntil: "networkidle" });
    info("date.past-date-url-accepted", await page.inputValue('input[type="date"]'));
  } else info("date.skipped", "no date/time inputs on this target");

  // ---------- 7. Filters & sort ----------
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const sortOptions = await page.locator("#sort option").allInnerTexts();
  info("sort.options", sortOptions.join(" | "));
  async function cardSummaries() {
    return page.$$eval("a", (as) =>
      as.filter((a) => /Choose this route/.test(a.textContent)).map((a) => {
        const card = a.closest("article") || a.parentElement.parentElement.parentElement;
        const t = card.innerText;
        const price = Number((t.match(/\$(\d+)/) || [])[1]);
        const dur = t.match(/(\d+)h\s*(\d+)?m?/);
        return { id: a.getAttribute("href"), price, minutes: dur ? Number(dur[1]) * 60 + Number(dur[2] || 0) : NaN };
      }),
    );
  }
  await page.selectOption("#sort", "fastest");
  await page.waitForTimeout(200);
  let cs = await cardSummaries();
  check(cs.every((c, i) => i === 0 || cs[i - 1].minutes <= c.minutes), "sort.fastest-order", JSON.stringify(cs));
  check(/sort=fastest/.test(page.url()), "sort.in-url", page.url().replace(BASE, ""));
  await page.selectOption("#sort", "fare");
  await page.waitForTimeout(200);
  cs = await cardSummaries();
  check(cs.every((c, i) => i === 0 || cs[i - 1].price <= c.price), "sort.fare-order", JSON.stringify(cs));
  await page.selectOption("#sort", "recommended");
  const amtrak = page.getByLabel("Include Amtrak");
  await amtrak.click(); // controlled by URL state; updates after a router transition
  await page.waitForTimeout(400);
  cs = await cardSummaries();
  check(cs.length === 1 && !/amtrak/.test(cs[0].id), "filter.exclude-amtrak", JSON.stringify(cs.map((c) => c.id)));
  await amtrak.click();
  await page.waitForTimeout(400);
  if (await page.getByRole("button", { name: "Bus only" }).count()) {
    await page.getByRole("button", { name: "Bus only" }).click();
    await page.waitForTimeout(200);
    const bn = await resultCount(page);
    const bodyEmpty = (await page.locator(".empty-state").innerText().catch(() => "")).replace(/\n/g, " ");
    info("filter.bus-only-philly", `${bn} routes ${bodyEmpty}`);
    await page.getByRole("button", { name: "Rail only" }).click();
    await page.waitForTimeout(200);
    check((await resultCount(page)) === 2, "filter.rail-only-philly", `${await resultCount(page)}`);
    check((await page.getByRole("button", { name: "Rail only" }).getAttribute("aria-pressed")) === "true", "filter.aria-pressed");
    await page.getByRole("button", { name: "All transport" }).click();
    // Operator filter on a richer corridor
    await page.goto(BASE + "/?from=Boston&to=New+York", { waitUntil: "networkidle" });
    const all = await resultCount(page);
    const opSelect = page.locator(".transport-filters select");
    const opValues = await opSelect.locator("option").evaluateAll((os) => os.map((o) => o.value));
    const opCounts = [];
    for (const v of opValues) {
      await opSelect.selectOption(v);
      await page.waitForTimeout(150);
      opCounts.push(`${v}=${await resultCount(page)}`);
    }
    info("filter.operator-counts-boston-ny", `all=${all} ${opCounts.join(" ")}`);
    await opSelect.selectOption("all");
    for (const m of ["Rail only", "Bus only", "Rail + bus"]) {
      await page.getByRole("button", { name: m, exact: true }).click();
      await page.waitForTimeout(150);
      opCounts.push(`${m}=${await resultCount(page)}`);
    }
    info("filter.mode-counts-boston-ny", opCounts.slice(-3).join(" "));
    await shot(page, "05-filters-boston-ny");
    // Filters survive reload / back
    await page.reload({ waitUntil: "networkidle" });
    check(/mode=mixed/.test(page.url()) && (await page.getByRole("button", { name: "Rail + bus" }).getAttribute("aria-pressed")) === "true", "filter.persist-reload", page.url().replace(BASE, ""));
    // New search resets?
    await plan(page, "New York", "Washington");
    info("filter.after-new-search", `${page.url().replace(BASE, "")} -> ${await resultCount(page)} routes`);
  } else info("filter.mode-skipped", "no mode filters on this target");

  // ---------- 8. Compare ----------
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const cmpBtn = page.getByRole("button", { name: /Compare (two|both) options/ });
  await cmpBtn.click();
  const dlg = page.locator("dialog[open]");
  check(await dlg.isVisible(), "compare.shortcut-opens-dialog");
  await shot(page, "06-compare-dialog");
  const dlgText = (await dlg.innerText()).replace(/\n+/g, " ");
  info("compare.dialog-text", dlgText.slice(0, 400));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check((await page.locator("dialog[open]").count()) === 0, "compare.escape-closes");
  const focusBack = await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 40));
  info("compare.focus-after-close", focusBack);
  // checkbox flow
  const boxes = page.locator('input[type=checkbox][aria-label^="Compare"]');
  await boxes.nth(0).check();
  const tray = page.locator(".compare-tray");
  info("compare.tray-after-one", (await tray.innerText().catch(() => "none")).replace(/\n/g, " "));
  await boxes.nth(1).check();
  const trayBtn = page.getByRole("button", { name: /Compare routes/ });
  if (await trayBtn.count()) {
    check(await trayBtn.isEnabled(), "compare.tray-enabled-with-two");
    await trayBtn.click();
    check(await page.locator("dialog[open]").isVisible(), "compare.tray-opens-dialog");
    // Choose route from dialog if present
    const choose = page.locator("dialog[open] a");
    info("compare.dialog-links", (await choose.allInnerTexts()).join(" | "));
    await page.getByRole("button", { name: "Close route comparison" }).click();
    check((await page.locator("dialog[open]").count()) === 0, "compare.close-button");
    await page.getByRole("button", { name: "Clear comparison" }).click();
    check((await page.locator(".compare-tray").count()) === 0, "compare.clear");
  } else info("compare.tray", "no tray on this target");
  // Backdrop click
  await cmpBtn.click();
  await page.mouse.click(5, 5);
  await page.waitForTimeout(200);
  check((await page.locator("dialog[open]").count()) === 0, "compare.backdrop-click-closes");

  // ---------- 9. Corridor shortcuts ----------
  if (hasCorridors) {
    const picks = page.locator(".corridor-pick");
    const nPicks = await picks.count();
    for (let i = 0; i < nPicks; i++) {
      await page.goto(BASE + "/?mode=bus", { waitUntil: "networkidle" });
      const label = (await picks.nth(i).innerText()).replace(/\n/g, " ");
      await picks.nth(i).click();
      await page.waitForTimeout(700);
      const n = await resultCount(page);
      const inView = await page.locator("#routes").evaluate((el) => {
        const r = el.getBoundingClientRect();
        return r.top < innerHeight && r.bottom > 0;
      });
      check(n > 0 && inView, `corridor.${i + 1}`, `${label} -> ${n} routes, results in view=${inView}, url ${page.url().replace(BASE, "")}`);
    }
    await shot(page, "07-corridor-last");
    await page.locator(".coverage-details summary").click();
    check(await page.locator(".coverage-details[open]").count() === 1, "corridor.coverage-details-open");
  }

  // ---------- 10. Route card details / share ----------
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const det = page.getByRole("button", { name: "View route details" }).first();
  await det.click();
  await page.waitForTimeout(200);
  const exp = await det.getAttribute("aria-expanded");
  const detName = await page.locator("button[aria-expanded]").first().innerText();
  info("card.details-expanded", `aria-expanded=${exp} label now "${detName}"`);
  await shot(page, "08-card-details");
  await page.locator("button[aria-expanded=true]").first().click();
  check((await page.locator(".route-list button[aria-expanded=true]").count()) === 0, "card.details-collapse");
  const share = page.locator(".share-trip-button").first();
  if (await share.count()) {
    await share.click();
    await page.waitForTimeout(300);
    const fb = (await page.locator(".share-feedback").first().innerText().catch(() => "")).replace(/\n/g, " ");
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR " + e.message));
    check(/\/journey\//.test(clip), "card.share-copies-link", `clipboard=${clip} feedback="${fb}"`);
    await page.locator(".share-dismiss").first().click().catch(() => {});
  } else {
    const legacyShare = page.getByRole("button", { name: /Share/ }).first();
    if (await legacyShare.count()) {
      await legacyShare.click();
      await page.waitForTimeout(300);
      const clip = await page.evaluate(() => navigator.clipboard.readText().catch((e) => "ERR " + e.message));
      info("card.share-legacy", `clipboard=${clip}`);
    }
  }

  // ---------- 11. Closing CTA ----------
  await page.getByRole("link", { name: /Back to search|Let.s go somewhere/ }).click();
  await page.waitForTimeout(500);
  const ctaFocus = await page.evaluate(() => ({ y: scrollY, active: document.activeElement?.id || document.activeElement?.tagName }));
  info("cta.lets-go-somewhere", `scrollY=${ctaFocus.y} focus=${ctaFocus.active} url=${page.url().replace(BASE, "")}`);

  // ---------- 12. Journey ----------
  for (const [label, url] of [["philly-scenic", "/"], ["boston-ny", "/?from=Boston&to=New+York"]]) {
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    const choose = page.getByRole("link", { name: /Choose this route/ }).first();
    const href = await choose.getAttribute("href");
    await choose.click();
    await page.waitForURL(/\/journey\//);
    await page.waitForLoadState("networkidle");
    await page.locator("#timeline-title, h1:has-text('not found')").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500); // scroll-to-top is smooth; give it time to settle
    check(page.url().endsWith(href), `journey.${label}.navigates`, href);
    check(/Your journey/.test(await page.title()), `journey.${label}.title`, await page.title());
    const h1 = (await page.locator("h1").first().innerText()).replace(/\n/g, " ");
    info(`journey.${label}.h1`, h1);
    const scrollTop = await page.evaluate(() => scrollY);
    check(scrollTop === 0, `journey.${label}.starts-at-top`, `scrollY=${scrollTop}`);
    const times = (await page.locator("main").innerText()).match(/\d{1,2}:\d{2}\s?[AP]M/g) || [];
    info(`journey.${label}.times`, times.slice(0, 12).join(" "));
    await shot(page, `09-journey-${label}`, true);
    await collectLinks(page, "journey");
    // Trip details toggles
    const toggles = page.locator("main button[aria-expanded]");
    const nt = await toggles.count();
    if (nt) {
      await toggles.first().click();
      check((await toggles.first().getAttribute("aria-expanded")) === "true", `journey.${label}.details-expand`, `${nt} toggles; label "${(await toggles.first().innerText()).trim()}"`);
      await shot(page, `10-journey-${label}-details`);
      await toggles.first().click();
      check((await toggles.first().getAttribute("aria-expanded")) === "false", `journey.${label}.details-collapse`);
    } else fail(`journey.${label}.details-expand`, "no aria-expanded toggles");
    // Demo controls
    const start = page.getByRole("button", { name: "Start demo journey" });
    if (await start.count()) {
      const prev = page.getByRole("button", { name: "Previous step" });
      const next = page.getByRole("button", { name: "Next step" });
      check((await prev.isDisabled()) && (await next.isDisabled()), `journey.${label}.demo-disabled-before-start`);
      await start.click();
      const steps = [];
      const statusLoc = page.locator("[aria-labelledby=demo-journey-title] span.rounded-full").first();
      steps.push(await statusLoc.innerText());
      let guard = 0;
      while (!(await next.isDisabled()) && guard++ < 20) {
        await next.click();
        steps.push(await statusLoc.innerText());
      }
      info(`journey.${label}.demo-steps`, steps.join(" > "));
      check(guard < 20 && /Step (\d+) of \1/.test(steps.at(-1)), `journey.${label}.demo-reaches-end`, steps.at(-1));
      await shot(page, `11-journey-${label}-demo-end`);
      if (await prev.isEnabled()) {
        await prev.click();
        check(/Step/.test(await statusLoc.innerText()), `journey.${label}.demo-previous`, await statusLoc.innerText());
      } else info(`journey.${label}.demo-previous`, "Previous disabled: single-step journey");
      // Arrow-key shortcut
      await next.focus();
      await page.keyboard.press("ArrowRight");
      info(`journey.${label}.demo-arrowright`, await statusLoc.innerText());
      await page.getByRole("button", { name: "Reset", exact: true }).click();
      check((await statusLoc.innerText()) === "Ready to start", `journey.${label}.demo-reset`, await statusLoc.innerText());
    } else info(`journey.${label}.demo`, "no demo controls");
    // Delay
    const delay = page.getByRole("button", { name: "Simulate delay" });
    if (await delay.count()) {
      await delay.click();
      await page.waitForTimeout(300);
      const rec = (await page.locator("main [aria-live=polite]").nth(1).innerText().catch(() => "")).replace(/\n/g, " ");
      info(`journey.${label}.delay-recovery`, rec.slice(0, 300) || "(no recovery text)");
      check((await page.getByRole("button", { name: "Reset simulation" }).count()) === 1, `journey.${label}.delay-toggle`);
      await shot(page, `12-journey-${label}-delay`, true);
      await page.getByRole("button", { name: "Reset simulation" }).click();
    }
    // Wallet link
    await page.getByRole("link", { name: /View ticket wallet/ }).click();
    await page.waitForURL(/\/wallet\//);
    check(page.url().includes(href.replace("/journey/", "/wallet/")), `journey.${label}.wallet-link`, page.url().replace(BASE, ""));
    // ---------- 13. Wallet ----------
    await page.waitForLoadState("networkidle");
    await page.locator(".oneline-wallet h1").waitFor({ timeout: 15000 });
    await page.waitForTimeout(300);
    check(/Your wallet/.test(await page.title()), `wallet.${label}.title`, await page.title());
    const tickets = await page.locator(".ol-ticket-list > li").count();
    info(`wallet.${label}.tickets`, String(tickets));
    const walletLinks = await collectLinks(page, "wallet");
    const ext = walletLinks.filter((l) => /^https?:/.test(l.href) && !l.href.startsWith(BASE));
    const badRel = ext.filter((l) => l.target !== "_blank" || !/noopener|noreferrer/.test(l.rel));
    check(badRel.length === 0, `wallet.${label}.external-links-new-tab`, `${ext.length} external; bad: ${badRel.map((l) => l.href).join(", ")}`);
    const live = page.locator(".ol-live");
    if (await live.count()) {
      await page.waitForFunction(() => !/Refreshing SEPTA/.test(document.querySelector(".ol-feed-summary")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
      const s1 = await page.locator(".ol-feed-summary").innerText();
      info(`wallet.${label}.septa-feed`, s1);
      await shot(page, `13-wallet-${label}`, true);
      await page.getByRole("button", { name: "Refresh feed" }).click();
      const during = await page.locator(".ol-feed-summary").innerText();
      await page.waitForFunction(() => !/Refreshing SEPTA/.test(document.querySelector(".ol-feed-summary")?.textContent || ""), null, { timeout: 20000 }).catch(() => {});
      check(/Refreshing|retrieved|unavailable|no active/.test(during + (await page.locator(".ol-feed-summary").innerText())), `wallet.${label}.septa-refresh`, `during="${during}" after="${await page.locator(".ol-feed-summary").innerText()}"`);
    } else {
      info(`wallet.${label}.septa-feed`, "no SEPTA panel (no SEPTA leg)");
      await shot(page, `13-wallet-${label}`, true);
    }
    const cb = page.locator(".ol-ticket-list input[type=checkbox]").first();
    if (await cb.count()) {
      await cb.check();
      info(`wallet.${label}.checklist`, await page.locator(".ol-progress [role=status]").innerText());
    }
    // Back navigation
    await page.goBack();
    await page.waitForURL(/\/journey\//);
    check(page.url().endsWith(href), `wallet.${label}.browser-back`, page.url().replace(BASE, ""));
    await page.goForward();
    await page.waitForURL(/\/wallet\//);
    pass(`wallet.${label}.browser-forward`);
  }

  // ---------- 14. Header nav after selection ----------
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Choose this route/ }).nth(1).click();
  await page.waitForURL(/\/journey\//);
  await page.locator("header nav").getByRole("link", { name: "Search" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
  const navJourneyHref = await page.locator("header nav").getByRole("link", { name: "Journey" }).getAttribute("href");
  const navWalletHref = await page.locator("header nav").getByRole("link", { name: "Wallet" }).getAttribute("href");
  check(/\/journey\/./.test(navJourneyHref) && /\/wallet\/./.test(navWalletHref), "nav.remembers-selected-trip", `${navJourneyHref} ${navWalletHref}`);
  await page.locator("header nav").getByRole("link", { name: "Wallet" }).click();
  await page.waitForURL(/\/wallet/);
  await page.locator(".oneline-wallet h1, main h1").first().waitFor();
  await page.waitForTimeout(500);
  check(/Your wallet/.test(await page.title()), "nav.wallet-tab", await page.title());
  await page.locator("header nav").getByRole("link", { name: "Journey" }).click();
  await page.waitForURL(/\/journey/);
  await page.waitForTimeout(500);
  check(/Your journey/.test(await page.title()), "nav.journey-tab", await page.title());
  await page.getByRole("link", { name: "OneLine home" }).first().click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
  pass("nav.logo-home");

  // ---------- 15. Refresh + deep links in fresh contexts ----------
  const fresh = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const fp = await fresh.newPage();
  instrument(fp, "fresh");
  const deep = [
    ["/", 200, /OneLine/, /Different lines/],
    ["/journey/regional-connection", 200, /Your journey/, /Philadelphia/],
    ["/journey/amtrak-connection", 200, /Your journey/, /Stony Brook/],
    ["/wallet/regional-connection", 200, /Your wallet/, /Every ticket/],
    ["/journey/east-boston--new-york--amtrak", 200, /Your journey/, /Boston/],
    ["/wallet/east-boston--new-york--greyhound", 200, /Your wallet/, null],
    ["/journey", 200, /Your journey/, null],
    ["/wallet", 200, /Your wallet/, null],
    ["/journey/does-not-exist", 200, null, /not found/i],
    ["/wallet/does-not-exist", 200, null, /not found/i],
    ["/journey/%E0%A4%A", 200, null, null],
    ["/some/random/path", 200, null, /off the line|not found/i],
    ["/?from=Boston&to=New%20York&sort=fastest&mode=rail", 200, null, null],
  ];
  for (const [p, code, titleRe, bodyRe] of deep) {
    const r = await fp.goto(BASE + p, { waitUntil: "networkidle" });
    const title = await fp.title();
    const body = (await fp.locator("body").innerText()).replace(/\n+/g, " ");
    const h1 = (await fp.locator("h1").first().innerText().catch(() => "(no h1)")).replace(/\n/g, " ");
    const ok = r.status() === code && (!titleRe || titleRe.test(title)) && (!bodyRe || bodyRe.test(body));
    record(ok ? "PASS" : "FAIL", `deeplink.${p}`, `HTTP ${r.status()} title "${title}" h1 "${h1}"`);
    await fp.reload({ waitUntil: "networkidle" });
    const h1b = (await fp.locator("h1").first().innerText().catch(() => "(no h1)")).replace(/\n/g, " ");
    check(h1b === h1, `refresh.${p}`, `h1 after reload "${h1b}"`);
  }
  await fp.goto(BASE + "/some/random/path", { waitUntil: "networkidle" });
  await shot(fp, "14-404");
  await fp.goto(BASE + "/journey/does-not-exist", { waitUntil: "networkidle" });
  await shot(fp, "15-journey-invalid");
  await fp.goto(BASE + "/wallet", { waitUntil: "networkidle" });
  await shot(fp, "16-wallet-no-selection");
  // Static/edge responses
  for (const p of ["/assets/does-not-exist.js", "/api/unknown", "/.env", "/favicon.ico"]) {
    const r = await fp.request.get(BASE + p);
    info(`http.${p}`, String(r.status()));
  }
  await fresh.close();

  // Back/forward through search history
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await plan(page, "Boston", "New York");
  await plan(page, "Raleigh", "Charlotte");
  const urlAfterSecond = page.url().replace(BASE, "");
  await page.goBack();
  await page.waitForTimeout(800);
  const backOrigin = (await page.locator("#origin").count()) ? await page.inputValue("#origin") : "(no search form)";
  check(backOrigin.startsWith("Boston"), "history.back-restores-previous-search", `after 2nd search url ${urlAfterSecond}; Back -> url ${page.url().replace(BASE, "")}, origin field "${backOrigin}"`);
  await page.goForward();
  await page.waitForTimeout(800);
  const fwdOrigin = (await page.locator("#origin").count()) ? await page.inputValue("#origin") : "(no search form)";
  check(fwdOrigin.startsWith("Raleigh"), "history.forward", `${page.url().replace(BASE, "")} origin "${fwdOrigin}"`);

  // ---------- 16. Responsive ----------
  for (const width of [320, 375, 390, 1280]) {
    const rc = await browser.newContext({ viewport: { width, height: 800 }, isMobile: width < 800, hasTouch: width < 800, deviceScaleFactor: 1 });
    const rp = await rc.newPage();
    instrument(rp, `w${width}`);
    for (const [name, p] of [["home", "/"], ["journey", "/journey/regional-connection"], ["wallet", "/wallet/regional-connection"], ["results-bny", "/?from=Boston&to=New+York"]]) {
      await rp.goto(BASE + p, { waitUntil: "networkidle" });
      await rp.waitForTimeout(300);
      const ox = await overflowX(rp);
      check(ox <= 0, `responsive.${width}.${name}.no-horizontal-scroll`, `overflow ${ox}px`);
      const clipped = await clippedText(rp);
      if (clipped.length) info(`responsive.${width}.${name}.clipped`, clipped.join("; "));
      if (width !== 1280 || name !== "home") await shot(rp, `20-w${width}-${name}`, true);
    }
    // Mobile: autocomplete list fits on screen
    if (width < 800) {
      await rp.goto(BASE + "/", { waitUntil: "networkidle" });
      if (await hasAutocomplete(rp)) {
        await rp.locator("#destination").click();
        await rp.locator("#destination").fill("");
        await rp.locator("#destination").type("N", { delay: 20 });
        const box = await rp.locator("#destination-listbox").boundingBox().catch(() => null);
        check(!!box && box.x >= 0 && box.x + box.width <= width + 1, `responsive.${width}.autocomplete-fits`, JSON.stringify(box));
        await shot(rp, `21-w${width}-autocomplete`);
      }
      // compare dialog fits
      await rp.goto(BASE + "/", { waitUntil: "networkidle" });
      await rp.getByRole("button", { name: /Compare (two|both) options/ }).click();
      const db = await rp.locator("dialog[open]").boundingBox();
      check(!!db && db.x >= 0 && db.x + db.width <= width + 1, `responsive.${width}.compare-dialog-fits`, JSON.stringify(db));
      await shot(rp, `22-w${width}-compare`);
    }
    await rc.close();
  }

  // ---------- 17. Keyboard-only ----------
  const kc = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const kp = await kc.newPage();
  instrument(kp, "keyboard");
  await kp.goto(BASE + "/", { waitUntil: "networkidle" });
  const stops = [];
  for (let i = 0; i < 45; i++) {
    await kp.keyboard.press("Tab");
    await kp.waitForTimeout(350); // smooth scrolling
    const s = await kp.evaluate(() => {
      const e = document.activeElement;
      if (!e || e === document.body) return null;
      const cs = getComputedStyle(e);
      const visible = (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== "none");
      const r = e.getBoundingClientRect();
      return { name: (e.getAttribute("aria-label") || e.textContent || e.id || e.tagName).trim().replace(/\s+/g, " ").slice(0, 32), visible, onscreen: r.bottom > 0 && r.top < innerHeight && r.width > 0 };
    });
    stops.push(s);
  }
  check(stops[0] && /Skip to content/.test(stops[0].name), "keyboard.first-stop-skip-link", stops[0]?.name);
  const noRing = stops.filter((s) => s && !s.visible).map((s) => s.name);
  check(noRing.length === 0, "keyboard.focus-visible-all-stops", noRing.length ? `no outline/box-shadow on: ${[...new Set(noRing)].join(" | ")}` : `${stops.length} stops`);
  const offscreen = stops.filter((s) => s && !s.onscreen).map((s) => s.name);
  check(offscreen.length === 0, "keyboard.focused-element-scrolled-into-view", offscreen.join(" | "));
  info("keyboard.tab-order", stops.map((s) => s?.name).join(" > "));
  // Skip link works
  await kp.goto(BASE + "/", { waitUntil: "networkidle" });
  await kp.keyboard.press("Tab");
  await kp.keyboard.press("Enter");
  const afterSkip = await kp.evaluate(() => document.activeElement?.id);
  check(afterSkip === "main-content", "keyboard.skip-link-moves-focus", afterSkip);
  // Keyboard trip: plan + choose + journey via Enter
  await kp.goto(BASE + "/", { waitUntil: "networkidle" });
  await kp.locator("#origin").focus();
  await kp.keyboard.press("ControlOrMeta+A");
  await kp.keyboard.type("Bost");
  await kp.keyboard.press("ArrowDown");
  await kp.keyboard.press("Enter");
  await kp.keyboard.press("Tab"); // swap
  await kp.keyboard.press("Tab"); // destination
  await kp.keyboard.press("ControlOrMeta+A");
  await kp.keyboard.type("Wash");
  await kp.keyboard.press("ArrowDown");
  await kp.keyboard.press("Enter");
  await kp.keyboard.press("Enter"); // submit form
  await kp.waitForTimeout(600);
  const kn = await resultCount(kp);
  check(kn > 0, "keyboard.plan-trip-without-mouse", `${kn} routes; url ${kp.url().replace(BASE, "")}; origin "${await kp.inputValue("#origin")}" dest "${await kp.inputValue("#destination")}"`);
  if (!kn) await kp.goto(BASE + "/", { waitUntil: "networkidle" });
  await kp.getByRole("link", { name: /Choose this route/ }).first().focus();
  await kp.keyboard.press("Enter");
  await kp.waitForURL(/\/journey\//).catch(() => {});
  const jf = await kp.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
  info("keyboard.focus-after-route-change", jf);
  await kp.keyboard.press("Shift+Tab");
  info("keyboard.shift-tab-from-main", await kp.evaluate(() => (document.activeElement?.textContent || "").trim().slice(0, 30)));
  await kc.close();

  // ---------- 18. Content sanity ----------
  const cc = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const cp = await cc.newPage();
  const texts = {};
  for (const p of ["/", "/?from=Boston&to=New+York", "/journey/regional-connection", "/journey/east-boston--new-york--amtrak", "/wallet/regional-connection", "/wallet/east-new-york--washington--flixbus"]) {
    await cp.goto(BASE + p, { waitUntil: "networkidle" });
    await cp.locator("details").evaluateAll((ds) => ds.forEach((d) => (d.open = true)));
    texts[p] = await cp.locator("body").innerText();
    await collectLinks(cp, p);
  }
  const patterns = [
    [/lorem|ipsum|TODO|FIXME|placeholder text|\bundefined\b|\bNaN\b|\[object/i, "placeholder/bug text"],
    [/real[- ]time|live (arrivals|tracking|schedules?|times)|guarantee[sd]?\b|book now|buy tickets? here/i, "over-claim wording"],
    [/\bteh\b|recieve|seperate|occured|untill|wich\b|accomodat/i, "typo"],
  ];
  for (const [p, t] of Object.entries(texts)) {
    for (const [re, what] of patterns) {
      const g = new RegExp(re.source, "gi");
      const hits = [...t.matchAll(g)].map((m) => t.slice(Math.max(0, m.index - 40), m.index + 50).replace(/\n/g, " "));
      if (hits.length) info(`content.${what}.${p}`, hits.slice(0, 4).join(" || "));
    }
  }
  const unlabeledLinks = await cp.$$eval("a", (as) => as.filter((a) => !(a.getAttribute("aria-label") || a.textContent.trim())).map((a) => a.href));
  check(unlabeledLinks.length === 0, "content.links-have-names", unlabeledLinks.join(", "));
  await cc.close();

  // ---------- 19. External links ----------
  const ext = [...externalLinks.values()];
  const badTarget = ext.filter((l) => l.target !== "_blank" || !/noopener|noreferrer/.test(l.rel));
  check(badTarget.length === 0, "links.external-new-tab-with-rel", `${ext.length} unique external links; bad: ${badTarget.map((l) => `${l.href} (${l.page})`).join(", ")}`);
  if (CHECK_EXTERNAL) {
    for (const l of ext) {
      let status = "ERR";
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        const r = await fetch(l.href, { method: "GET", redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36", Accept: "text/html,*/*" } });
        clearTimeout(timer);
        status = String(r.status) + (r.redirected ? ` -> ${r.url}` : "");
        r.body?.cancel?.();
      } catch (e) {
        status = "ERR " + (e.cause?.code || e.name);
      }
      const okStatus = /^(2|3)\d\d/.test(status);
      record(okStatus ? "PASS" : /^(403|429)/.test(status) ? "INFO" : "FAIL", `links.http.${l.href}`, status);
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  // ---------- 20. Aggregates ----------
  check(consoleErrors.length === 0, "runtime.console-errors", consoleErrors.slice(0, 10).join(" || "));
  check(failedRequests.length === 0, "runtime.failed-requests", failedRequests.slice(0, 10).join(" || "));
  const tp = [...thirdParty];
  info("runtime.third-party-requests", tp.length ? tp.join(", ") : "none");

  await browser.close();
  const summary = {
    target: TARGET,
    base: BASE,
    at: new Date().toISOString(),
    passed: results.filter((r) => r.status === "PASS").length,
    failed: results.filter((r) => r.status === "FAIL").length,
    info: results.filter((r) => r.status === "INFO").length,
  };
  fs.writeFileSync(path.join(OUT, `${TARGET}-results.json`), JSON.stringify({ summary, results, consoleErrors, failedRequests, thirdParty: tp }, null, 2));
  console.log(`\nSUMMARY ${JSON.stringify(summary)}`);
})().catch((e) => {
  console.error("SCRIPT ERROR", e);
  process.exit(2);
});
