// RC1 cross-browser feature pass: Search, rail map, Journey, Wallet, keyboard, console/network.
// Usage: node qa/rc1-cross-browser-features.cjs <baseURL> <shotDir> <chromium|firefox|webkit> <desktop|phone> [resultsJson]
// Phone profile: WebKit uses devices["iPhone 13"]; Chromium uses 390x844 isMobile+touch; Firefox uses
// 390x844 + touch (Playwright's Firefox has no isMobile emulation).
// Native date/time pickers are not opened: values are set with fill() and keyboard entry is recorded
// as information only, because each engine renders and automates native pickers differently.
const playwright = require("playwright");
const fs = require("node:fs");
const [base = "http://127.0.0.1:4188", shots = "qa-results/rc1-xb", engine = "chromium", profile = "desktop", out] = process.argv.slice(2);
fs.mkdirSync(shots, { recursive: true });
const tag = `${engine}-${profile}`;
const results = [];
const info = {};
const log = (area, name, ok, detail = "") => {
  results.push({ area, name, ok, detail: String(detail) });
  console.log(`${ok ? "PASS" : "FAIL"} [${tag}] ${area}: ${name}${detail ? " — " + detail : ""}`);
};
const note = (key, value) => {
  info[key] = value;
  console.log(`INFO [${tag}] ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
};
const shot = (page, name, opts = {}) => page.screenshot({ path: `${shots}/${tag}-${name}.png`, scale: "css", ...opts });
const flat = (s) => (s ?? "").replace(/\s+/g, " ").trim();

function contextOptions(width) {
  if (profile === "desktop") return { viewport: { width: 1280, height: 900 } };
  if (engine === "webkit" && !width) return { ...playwright.devices["iPhone 13"] };
  const viewport = { width: width ?? 390, height: 844 };
  return engine === "firefox" ? { viewport, hasTouch: true } : { viewport, isMobile: true, hasTouch: true };
}

const LIVE = /Live feed fetched|SEPTA observations retrieved/;
const UNAVAILABLE = /Live data unavailable|SEPTA observations unavailable/;
const LOADING = /Checking the official SEPTA feed|Refreshing SEPTA observations/;

(async () => {
  const browser = await playwright[engine].launch();
  note("browserVersion", `${engine} ${browser.version()}`);
  const problems = [];
  const watch = (page) => {
    page.on("pageerror", (e) => problems.push(`pageerror ${page.url()} ${e.message}`));
    page.on("console", (m) => {
      if (m.type() !== "error") return;
      if (m.location()?.url?.includes("/api/transit/septa/") || /septa/i.test(m.text())) return; // simulated outages
      problems.push(`console ${page.url()} ${m.text()}`);
    });
    page.on("requestfailed", (r) => {
      if (r.url().includes("/api/transit/septa/")) return;
      problems.push(`requestfailed ${r.url()} ${r.failure()?.errorText}`);
    });
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().startsWith(base) && !r.url().includes("/api/transit/septa/"))
        problems.push(`HTTP ${r.status()} ${r.url()}`);
    });
  };
  const section = async (area, fn) => {
    try { await fn(); } catch (e) { log(area, "section completed without exception", false, e.message.split("\n")[0]); }
  };
  const newPage = async (width, extra = {}) => {
    const ctx = await browser.newContext({ ...contextOptions(width), ...extra });
    const page = await ctx.newPage();
    watch(page);
    return { ctx, page };
  };
  const tap = async (locator) => (profile === "phone" && engine !== "firefox" ? locator.tap() : locator.click());

  // Probe the tab key: WebKit on macOS skips links on plain Tab unless "Press Tab to highlight each item" is on.
  let TAB = "Tab";
  {
    const { ctx, page } = await newPage();
    await page.goto(base + "/");
    await page.locator("#origin").waitFor();
    await page.waitForTimeout(300);
    await page.keyboard.press("Tab");
    const isLink = await page.evaluate(() => document.activeElement?.tagName === "A");
    if (!isLink && engine === "webkit") TAB = "Alt+Tab";
    note("tab key used for link walks", TAB);
    await ctx.close();
  }

  // ---------------- Search ----------------
  await section("Search", async () => {
    const { ctx, page } = await newPage();
    await page.goto(base + "/");
    const origin = page.locator("#origin");
    const dest = page.locator("#destination");
    await origin.waitFor();
    await shot(page, "search-top");

    // Typing + arrow + Enter
    await origin.click();
    await origin.fill("");
    await origin.pressSequentially("Bos", { delay: 30 });
    const list = page.locator("#origin-listbox");
    await list.waitFor({ timeout: 3000 });
    const firstOpt = flat(await list.locator("[role=option]").first().innerText());
    log("Search", "typing 'Bos' lists Boston first", /^Boston/.test(firstOpt), firstOpt);
    await shot(page, "autocomplete-open");
    await origin.press("ArrowDown");
    const active = await origin.getAttribute("aria-activedescendant");
    const sel = await list.locator("[aria-selected=true]").count();
    log("Search", "ArrowDown sets aria-activedescendant and highlights an option", !!active && sel === 1, active);
    await origin.press("Enter");
    log("Search", "Enter picks highlighted city and closes list",
      (await origin.inputValue()) === "Boston" && (await origin.getAttribute("aria-expanded")) === "false",
      `value=${await origin.inputValue()} expanded=${await origin.getAttribute("aria-expanded")}`);
    log("Search", "Enter on option does not submit the form", !/from=/.test(page.url()), page.url());

    // ArrowUp wraps to last
    await origin.fill("");
    await origin.pressSequentially("New", { delay: 20 });
    await origin.press("ArrowUp");
    const optCount = await list.locator("[role=option]").count();
    const lastSelected = await list.locator("[role=option]").nth(optCount - 1).getAttribute("aria-selected");
    log("Search", "ArrowUp from input wraps to last option", lastSelected === "true", `${optCount} options`);

    // Escape
    await origin.press("Escape");
    log("Search", "Escape closes list and keeps typed text",
      (await origin.getAttribute("aria-expanded")) === "false" && (await origin.inputValue()) === "New" &&
        (await page.locator("#origin-listbox").count()) === 0);

    // Mouse / touch pick
    await dest.click();
    await dest.fill("");
    await dest.pressSequentially("New", { delay: 20 });
    const ny = page.locator("#destination-listbox [role=option]", { hasText: "New York" }).first();
    await ny.waitFor({ timeout: 3000 });
    await tap(ny);
    await page.waitForTimeout(150);
    log("Search", `${profile === "phone" && engine !== "firefox" ? "tap" : "mouse"} pick fills the field and closes list`,
      (await dest.inputValue()) === "New York" && (await page.locator("#destination-listbox").count()) === 0,
      `value=${await dest.inputValue()}`);

    // Aliases
    for (const [alias, city] of [["Philly", "Philadelphia"], ["NYC", "New York"], ["DC", "Washington"], ["Long Island", "Stony Brook"]]) {
      await origin.fill("");
      await origin.pressSequentially(alias, { delay: 15 });
      await page.locator("#origin-listbox").waitFor({ timeout: 3000 });
      const t = flat(await page.locator("#origin-listbox [role=option]").first().innerText().catch(() => ""));
      log("Search", `alias '${alias}' suggests ${city}`, t.startsWith(city), t);
    }
    await origin.press("Escape");

    // Native date / time inputs
    const date = page.locator('input[name="departure-date"]');
    const time = page.locator('input[name="departure-time"]');
    note("dateInputType", await date.evaluate((el) => el.type));
    note("timeInputType", await time.evaluate((el) => el.type));
    log("Search", "date input default value reads back", (await date.inputValue()) === "2026-10-24", await date.inputValue());
    await date.fill("2026-11-03");
    await time.fill("14:30");
    log("Search", "date fill() reads back", (await date.inputValue()) === "2026-11-03", await date.inputValue());
    log("Search", "time fill() reads back", (await time.inputValue()) === "14:30", await time.inputValue());
    const dateBox = await date.boundingBox();
    const timeBox = await time.boundingBox();
    note("dateTimeBoxes", { date: dateBox && { w: Math.round(dateBox.width), h: Math.round(dateBox.height) }, time: timeBox && { w: Math.round(timeBox.width), h: Math.round(timeBox.height) } });
    const fieldOverflow = await page.evaluate(() => {
      const f = document.querySelector(".date-field");
      if (!f) return "no .date-field";
      const r = f.getBoundingClientRect();
      const bad = [...f.querySelectorAll("input")].filter((i) => { const b = i.getBoundingClientRect(); return b.right > r.right + 1 || b.left < r.left - 1; });
      return bad.length ? `${bad.length} input(s) overflow .date-field` : "";
    });
    log("Search", "date/time inputs stay inside their field", !fieldOverflow, fieldOverflow);
    await page.locator(".date-field").screenshot({ path: `${shots}/${tag}-date-time-field.png`, scale: "css" });
    // Keyboard entry into the native time control (information only; segment behaviour differs per engine).
    // Keyboard focus on the native date control (Tab from the destination field) for a visual focus check.
    await dest.focus();
    await page.keyboard.press("Escape");
    await page.keyboard.press("Tab");
    const dateFocus = await page.evaluate(() => { const el = document.activeElement; const cs = getComputedStyle(el); return { name: el.name, outline: `${cs.outlineStyle} ${cs.outlineWidth}`, focusVisible: el.matches(":focus-visible") }; });
    note("Tab into date input", dateFocus);
    await page.locator(".date-field").screenshot({ path: `${shots}/${tag}-date-field-keyboard-focus.png`, scale: "css" });
    await time.focus();
    await page.keyboard.type("0945AM");
    note("keyboardTimeEntry '0945' -> value", await time.inputValue());
    await time.fill("14:30");

    // Submit
    await origin.fill("Philadelphia");
    await origin.press("Escape");
    await dest.fill("Stony Brook");
    await dest.press("Escape");
    await page.locator(".search-button").click();
    await page.waitForURL(/date=2026-11-03/, { timeout: 5000 });
    const u = new URL(page.url());
    log("Search", "submit persists date and time in URL", u.searchParams.get("date") === "2026-11-03" && u.searchParams.get("time") === "14:30", u.search);
    await page.waitForTimeout(400);
    const status = flat(await page.locator(".results-heading p[role=status]").innerText());
    // Default origin/destination are omitted from the URL, so the status keeps its default sentence.
    log("Search", "results status present after submit", /Philadelphia to Stony Brook|sample connection/.test(status), status);
    const focusedResults = await page.evaluate(() => document.activeElement?.id);
    log("Search", "focus moves to results after submit", focusedResults === "routes", focusedResults);

    // Refresh
    await page.reload();
    await date.waitFor();
    log("Search", "refresh keeps date/time in inputs", (await date.inputValue()) === "2026-11-03" && (await time.inputValue()) === "14:30",
      `${await date.inputValue()} ${await time.inputValue()}`);

    // Second search for history
    await origin.fill("Boston");
    await origin.press("Escape");
    await dest.fill("New York");
    await dest.press("Escape");
    await page.locator(".search-button").click();
    await page.waitForURL(/from=Boston/);
    await page.waitForFunction(() => /Boston/.test(document.querySelector(".results-heading p[role=status]")?.textContent ?? ""), null, { timeout: 4000 }).catch(() => {});
    const s2 = flat(await page.locator(".results-heading p[role=status]").innerText());
    log("Search", "second search Boston -> New York", /Boston → New York/.test(s2), s2);
    await page.goBack();
    await page.waitForURL((url) => !/from=Boston/.test(url.toString()));
    await page.waitForTimeout(200);
    log("Search", "Back restores previous search inputs", (await origin.inputValue()) === "Philadelphia" && (await date.inputValue()) === "2026-11-03",
      `${await origin.inputValue()} ${await date.inputValue()}`);
    await page.goBack();
    await page.waitForTimeout(300);
    log("Search", "Back again returns to default form", (await date.inputValue()) === "2026-10-24" && !/date=/.test(page.url()), page.url());
    await page.goForward();
    await page.waitForTimeout(300);
    log("Search", "Forward re-applies date/time", (await date.inputValue()) === "2026-11-03" && (await time.inputValue()) === "14:30", page.url());

    // Filters & sort
    await page.goto(base + "/");
    await page.getByRole("button", { name: "Rail only" }).click();
    await page.waitForURL(/mode=rail/);
    await page.waitForTimeout(200);
    log("Search", "Rail only filter pressed + URL", (await page.getByRole("button", { name: "Rail only" }).getAttribute("aria-pressed")) === "true", page.url());
    await page.locator("#sort").selectOption("fastest");
    await page.waitForURL(/sort=fastest/);
    await page.locator(".transport-filters select").selectOption("LIRR");
    await page.waitForURL(/operator=LIRR/);
    await page.locator(".amtrak-toggle input").click();
    await page.waitForURL(/amtrak=0/);
    const nCards = await page.locator(".route-card").count();
    log("Search", "filters compose in URL", /mode=rail/.test(page.url()) && /sort=fastest/.test(page.url()) && /operator=LIRR/.test(page.url()), `${new URL(page.url()).search} → ${nCards} cards`);
    await page.reload();
    await page.locator("#sort").waitFor();
    log("Search", "refresh keeps sort/filter controls", (await page.locator("#sort").inputValue()) === "fastest" &&
      (await page.locator(".transport-filters select").inputValue()) === "LIRR" && !(await page.locator(".amtrak-toggle input").isChecked()));
    await page.goBack();
    await page.waitForTimeout(200);
    log("Search", "Back undoes last filter (Amtrak toggle)", await page.locator(".amtrak-toggle input").isChecked(), page.url());

    // Compare dialog
    await page.goto(base + "/");
    const checks = page.locator(".compare-route-check input[type=checkbox]");
    await checks.nth(0).check();
    await checks.nth(1).check();
    const action = page.locator(".compare-tray-action");
    await action.click();
    const dialog = page.locator("dialog.comparison-dialog[open]");
    await dialog.waitFor();
    log("Search", "Compare dialog opens (showModal)", await dialog.isVisible());
    log("Search", "focus moves into dialog", await page.evaluate(() => !!document.activeElement?.closest("dialog")),
      await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName));
    const dlgBox = await dialog.boundingBox();
    const vw = page.viewportSize().width;
    log("Search", "dialog fits viewport width", dlgBox && dlgBox.x >= 0 && dlgBox.x + dlgBox.width <= vw + 0.5, JSON.stringify(dlgBox && { x: Math.round(dlgBox.x), w: Math.round(dlgBox.width), vw }));
    await shot(page, "compare-dialog");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(250);
    log("Search", "Escape closes dialog", (await page.locator("dialog[open]").count()) === 0);
    log("Search", "focus returns to Compare button after Escape", await page.evaluate(() => document.activeElement?.classList.contains("compare-tray-action")),
      await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName));
    await action.click();
    await dialog.waitFor();
    await page.locator(".comparison-close").click();
    await page.waitForTimeout(250);
    log("Search", "Close button closes dialog and returns focus", (await page.locator("dialog[open]").count()) === 0 &&
      (await page.evaluate(() => document.activeElement?.classList.contains("compare-tray-action"))),
      await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName));
    // Tab inside the modal stays within the dialog / document
    await action.click();
    await dialog.waitFor();
    const inside = [];
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press("Tab");
      inside.push(await page.evaluate(() => (document.activeElement?.closest("dialog") ? "in" : document.activeElement?.tagName ?? "none")));
    }
    note("Tab sequence inside open dialog", inside.join(","));
    log("Search", "Tab while dialog open never focuses page content behind it", inside.every((x) => x === "in" || x === "BODY" || x === "none"), inside.join(","));
    await page.keyboard.press("Escape");
    await ctx.close();
  });

  // ---------------- Rail map ----------------
  await section("Map", async () => {
    const { ctx, page } = await newPage();
    await page.goto(base + "/");
    const map = page.locator(".passenger-rail-map");
    await map.waitFor();
    await map.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await map.screenshot({ path: `${shots}/${tag}-rail-map.png`, scale: "css" });
    const svgBox = await page.locator(".prm-art").boundingBox();
    log("Map", "SVG renders with size", svgBox && svgBox.width > 200 && svgBox.height > 100, JSON.stringify(svgBox && { w: Math.round(svgBox.width), h: Math.round(svgBox.height) }));
    const counts = await page.evaluate(() => ({
      routes: document.querySelectorAll(".prm-routes > g").length,
      stations: document.querySelectorAll(".prm-station").length,
      states: document.querySelectorAll(".prm-states path").length,
    }));
    log("Map", "8 routes, 26 stations, 49 state outlines", counts.routes === 8 && counts.stations === 26 && counts.states === 49, JSON.stringify(counts));
    // Zero-length round-capped strokes: measure the drawn marker box from the browser's own geometry.
    const dot = await page.evaluate(() => {
      const p = document.querySelector(".prm-station-dot");
      const cs = getComputedStyle(p);
      return { strokeWidth: cs.strokeWidth, linecap: cs.strokeLinecap, vector: cs.vectorEffect || p.getAttribute("vector-effect") };
    });
    note("station dot computed style", dot);
    const labels = await page.evaluate(() => {
      const frame = document.querySelector(".prm-frame").getBoundingClientRect();
      const ls = [...document.querySelectorAll(".prm-label")].filter((l) => getComputedStyle(l).display !== "none" && l.getBoundingClientRect().width > 0);
      const boxes = ls.map((l) => ({ t: l.textContent, r: l.getBoundingClientRect() }));
      const overlaps = [];
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r, b = boxes[j].r;
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlaps.push(`${boxes[i].t}/${boxes[j].t}`);
      }
      const outside = boxes.filter(({ r }) => r.left < frame.left - 1 || r.right > frame.right + 1 || r.top < frame.top - 1 || r.bottom > frame.bottom + 1).map((b) => b.t);
      return { visible: boxes.map((b) => b.t), overlaps, outside };
    });
    log("Map", "labels visible, no overlap, inside frame", labels.visible.length >= 6 && !labels.overlaps.length && !labels.outside.length, JSON.stringify(labels));
    // Details
    const details = page.locator("details.prm-details");
    const summary = details.locator("summary");
    await tap(summary);
    await page.waitForTimeout(200);
    log("Map", "details opens on click/tap", await details.evaluate((d) => d.open));
    const panel = details.locator(".prm-details-content");
    const scroll = await panel.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, oy: getComputedStyle(el).overflowY }));
    await panel.hover().catch(() => {});
    if (profile === "desktop") await page.mouse.wheel(0, 400);
    else await panel.evaluate((el) => el.scrollBy(0, 400));
    await page.waitForTimeout(300);
    const st = await panel.evaluate((el) => el.scrollTop);
    log("Map", "details panel is a bounded scrolling region and scrolls", scroll.sh > scroll.ch && st > 0, `${JSON.stringify(scroll)} scrollTop=${st}`);
    await panel.evaluate((el) => (el.scrollTop = 0));
    await details.screenshot({ path: `${shots}/${tag}-map-details-open.png`, scale: "css" });
    const panelOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log("Map", "no horizontal overflow with details open", panelOverflow <= 0, `${panelOverflow}px`);
    await tap(summary);
    await page.waitForTimeout(150);
    log("Map", "details closes on second click/tap", !(await details.evaluate((d) => d.open)));
    await summary.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
    const enterOpen = await details.evaluate((d) => d.open);
    await page.keyboard.press("Space");
    await page.waitForTimeout(100);
    const spaceClosed = !(await details.evaluate((d) => d.open));
    log("Map", "summary toggles with Enter then Space", enterOpen && spaceClosed, `enter→open=${enterOpen} space→closed=${spaceClosed}`);
    // Closed details: links must not be focusable / visible
    const closedLinks = await page.evaluate(() => [...document.querySelectorAll(".prm-details a")].filter((a) => a.getBoundingClientRect().height > 0 && a.checkVisibility?.() !== false).length);
    log("Map", "links inside closed details are not rendered", closedLinks === 0, `${closedLinks} rendered`);
    await ctx.close();

    // Narrow widths
    for (const width of profile === "phone" ? [320, 375, 390] : []) {
      const { ctx: c2, page: p2 } = await newPage(width);
      await p2.goto(base + "/");
      await p2.locator(".passenger-rail-map").waitFor();
      await p2.waitForTimeout(400);
      const o1 = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      await p2.locator("details.prm-details summary").click();
      await p2.waitForTimeout(200);
      const o2 = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      const wide = await p2.evaluate(() => [...document.querySelectorAll("body *")].filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1 && getComputedStyle(el).position !== "fixed" && el.getBoundingClientRect().width > 0).slice(0, 4).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ")[0]}`));
      log("Map", `${width}px: no horizontal overflow (details closed/open)`, o1 <= 0 && o2 <= 0, `closed ${o1}px, open ${o2}px ${wide.join(" ")}`);
      await p2.locator(".passenger-rail-map").screenshot({ path: `${shots}/${tag}-rail-map-${width}.png`, scale: "css" });
      await c2.close();
    }
  });

  // ---------------- Journey ----------------
  const journeyTimes = {};
  await section("Journey", async () => {
    for (const tz of ["America/New_York", "America/Los_Angeles"]) {
      const { ctx, page } = await newPage(undefined, { timezoneId: tz });
      await page.goto(base + "/journey/regional-connection");
      await page.locator("#timeline-title").waitFor();
      journeyTimes[tz] = await page.locator("#timeline-title").locator("xpath=ancestor::section[1]").locator("time").allInnerTexts();
      await ctx.close();
    }
    note("timeline times (New York tz)", journeyTimes["America/New_York"].join(" "));
    log("Journey", "timeline times identical in New York and Los Angeles time zones",
      JSON.stringify(journeyTimes["America/New_York"]) === JSON.stringify(journeyTimes["America/Los_Angeles"]) && journeyTimes["America/New_York"].length >= 8,
      journeyTimes["America/Los_Angeles"].join(" "));

    const { ctx, page } = await newPage();
    await page.goto(base + "/journey/regional-connection");
    await page.locator("#timeline-title").waitFor();
    await page.waitForTimeout(600);
    await shot(page, "journey", { fullPage: profile === "desktop" });

    // Simulate delay
    const sim = page.getByRole("button", { name: /Simulate delay/ });
    await sim.click();
    await page.waitForTimeout(300);
    const struck = await page.locator("time.line-through").count();
    log("Journey", "Simulate delay shows struck original arrival and Reset label",
      struck >= 1 && (await page.getByRole("button", { name: "Reset simulation" }).getAttribute("aria-pressed")) === "true", `${struck} struck times`);
    await page.locator("time.line-through").first().scrollIntoViewIfNeeded();
    await shot(page, "journey-delay");
    await page.getByRole("button", { name: "Reset simulation" }).click();
    log("Journey", "Reset simulation clears delay", (await page.locator("time.line-through").count()) === 0);

    // Trip details disclosure + inert
    const toggle = page.locator("button[aria-controls^=segment-details-]").first();
    const detailId = await toggle.getAttribute("aria-controls");
    const details = page.locator(`#${detailId}`);
    const inertSupport = await page.evaluate(() => "inert" in HTMLElement.prototype);
    note("HTMLElement.inert supported", inertSupport);
    const collapsed = await details.evaluate((d) => ({ inert: d.inert, h: Math.round(d.getBoundingClientRect().height), linkH: Math.round(d.querySelector("a")?.getBoundingClientRect().height ?? -1), visible: d.querySelector("a")?.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) }));
    log("Journey", "collapsed details are inert and take no height", collapsed.inert === true && collapsed.h <= 1, JSON.stringify(collapsed));
    await toggle.focus();
    await page.keyboard.press(TAB);
    let afterToggle = await page.evaluate(() => ({ inDetails: !!document.activeElement?.closest("[id^=segment-details-]"), text: (document.activeElement?.innerText || document.activeElement?.tagName || "").slice(0, 40) }));
    log("Journey", "Tab from collapsed toggle skips hidden 'Get tickets' link", !afterToggle.inDetails, afterToggle.text);
    const linkFocus = await details.evaluate((d) => { const a = d.querySelector("a"); a.focus(); return document.activeElement === a; });
    log("Journey", "programmatic focus() on collapsed link is refused (inert)", !linkFocus);
    await toggle.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const expanded = await details.evaluate((d) => ({ inert: d.inert, h: Math.round(d.getBoundingClientRect().height) }));
    log("Journey", "Enter expands details (aria-expanded, not inert, has height)",
      (await toggle.getAttribute("aria-expanded")) === "true" && !expanded.inert && expanded.h > 40, JSON.stringify(expanded));
    log("Journey", "focus stays on toggle after Enter", await toggle.evaluate((b) => document.activeElement === b));
    const ring = await toggle.evaluate((b) => { const cs = getComputedStyle(b); return { outline: cs.outlineStyle, shadow: cs.boxShadow }; });
    log("Journey", "toggle shows visible keyboard focus ring", ring.outline !== "none" || (ring.shadow && ring.shadow !== "none"), JSON.stringify(ring));
    await page.keyboard.press("Tab");
    const plainTab = await page.evaluate(() => (document.activeElement?.innerText || document.activeElement?.tagName || "").slice(0, 40));
    note("plain Tab after expanded toggle lands on", plainTab);
    await toggle.focus();
    await page.keyboard.press(TAB);
    afterToggle = await page.evaluate(() => ({ inDetails: !!document.activeElement?.closest("[id^=segment-details-]"), text: (document.activeElement?.innerText || "").slice(0, 40) }));
    log("Journey", `${TAB} from expanded toggle reaches 'Get tickets' link`, afterToggle.inDetails && /Get tickets/.test(afterToggle.text), afterToggle.text);
    await toggle.scrollIntoViewIfNeeded();
    await shot(page, "journey-details-open");
    // Collapse with focus inside details: click the toggle with the mouse (focus moves to toggle).
    await page.keyboard.press("Shift+" + TAB);
    await page.keyboard.press("Space");
    await page.waitForTimeout(400);
    const afterCollapse = await page.evaluate(() => document.activeElement?.getAttribute("aria-controls") ?? document.activeElement?.tagName);
    log("Journey", "Space collapses; focus remains on toggle", (await toggle.getAttribute("aria-expanded")) === "false" && afterCollapse === detailId, afterCollapse);
    const recollapsed = await details.evaluate((d) => Math.round(d.getBoundingClientRect().height));
    log("Journey", "details height returns to 0 after collapse animation", recollapsed <= 1, `${recollapsed}px`);

    // Demo controls
    const statusPill = page.locator("#demo-journey-title").locator("xpath=ancestor::section[1]");
    await page.getByRole("button", { name: "Start demo journey" }).click();
    let pill = flat(await statusPill.innerText());
    const step1 = /Step 1 of (\d+)/.exec(pill);
    await page.getByRole("button", { name: "Next step" }).click();
    pill = flat(await statusPill.innerText());
    const step2 = /Step 2 of/.test(pill);
    await page.getByRole("button", { name: "Next step" }).focus();
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(100);
    pill = flat(await statusPill.innerText());
    const backTo1 = /Step 1 of/.test(pill);
    const current = await page.locator("article[aria-label*='current manual demo step']").count();
    await shot(page, "journey-demo-step");
    await page.getByRole("button", { name: "Reset", exact: true }).click();
    const reset = /Ready to start/.test(flat(await statusPill.innerText()));
    log("Journey", "demo Start → Next → ArrowLeft → Reset", !!step1 && step2 && backTo1 && current === 1 && reset,
      `start=${!!step1} next=${step2} arrowLeft=${backTo1} currentCards=${current} reset=${reset}`);

    // Wallet link
    await page.getByRole("link", { name: /View ticket wallet/ }).click();
    await page.waitForURL("**/wallet/regional-connection");
    await page.locator(".oneline-wallet h1").waitFor();
    log("Journey", "View ticket wallet link navigates", true);
    await ctx.close();
  });

  // ---------------- Wallet ----------------
  await section("Wallet", async () => {
    const { ctx, page } = await newPage();
    await page.goto(base + "/");
    await page.locator('a.select-route[href="/journey/regional-connection"]').first().click();
    await page.waitForURL("**/journey/regional-connection");
    await page.locator('#main-content a[href="/wallet/regional-connection"]').first().click();
    await page.waitForURL("**/wallet/regional-connection");
    await page.locator(".ol-ticket-list > li").first().waitFor();
    const legs = await page.locator(".ol-ticket-list > li").count();
    log("Wallet", "4 tickets for regional-connection", legs === 4, String(legs));
    await page.waitForFunction((l) => { const t = document.querySelector(".ol-live")?.textContent; return !!t && !new RegExp(l).test(t); }, LOADING.source, { timeout: 12000 });
    const live = flat(await page.locator(".ol-live").innerText());
    log("Wallet", "real SEPTA panel settles to live or unavailable", LIVE.test(live) || UNAVAILABLE.test(live), live.slice(0, 90));
    await shot(page, "wallet", { fullPage: profile === "desktop" });
    const cb = page.locator(".ol-ticket-list input[type=checkbox]").first();
    await cb.check();
    log("Wallet", "checklist checkbox updates progress", (await page.locator("progress").getAttribute("value")) === "1");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    log("Wallet", "no horizontal overflow", overflow <= 0, `${overflow}px`);
    await page.goBack();
    await page.waitForURL("**/journey/regional-connection");
    await page.locator("#timeline-title").waitFor();
    log("Wallet", "Back returns to Journey", true);
    await page.goBack();
    await page.waitForURL((u) => u.pathname === "/");
    await page.locator("#origin").waitFor();
    log("Wallet", "Back again returns to Search", true);
    await page.goForward();
    await page.goForward();
    await page.waitForURL("**/wallet/regional-connection");
    await page.locator(".ol-ticket-list > li").first().waitFor();
    log("Wallet", "Forward twice returns to Wallet", true);
    // Simulated outage and success states
    for (const [label, handler, re] of [
      ["502", (r) => r.fulfill({ status: 502, contentType: "application/json", body: '{"error":"septa_unavailable"}' }), UNAVAILABLE],
      ["success", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ trainno: "9999", line: "QA Test Line", dest: "QA Terminal", nextstop: "QA Stop", late: 3 }]) }), /QA Test Line · Train 9999/],
    ]) {
      await page.route("**/api/transit/septa/trains", handler);
      await page.goto(base + "/wallet/regional-connection");
      await page.waitForFunction((l) => { const t = document.querySelector(".ol-live")?.textContent; return !!t && !new RegExp(l).test(t); }, LOADING.source, { timeout: 12000 });
      const t = flat(await page.locator(".ol-live").innerText());
      log("Wallet", `SEPTA ${label} state renders`, re.test(t), t.slice(0, 90));
      await page.locator(".ol-live").screenshot({ path: `${shots}/${tag}-septa-${label}.png`, scale: "css" });
      await page.unroute("**/api/transit/septa/trains");
    }
    await ctx.close();
  });

  // ---------------- Keyboard ----------------
  await section("Keyboard", async () => {
    const { ctx, page } = await newPage();
    await page.goto(base + "/");
    await page.locator("#origin").waitFor();
    await page.waitForTimeout(500);
    const describe = () => page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return { d: "BODY", ring: true };
      const cs = getComputedStyle(el);
      const ring = cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0 || (cs.boxShadow && cs.boxShadow !== "none");
      const name = (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.id || "").replace(/\s+/g, " ").trim().slice(0, 32);
      const kind = el.tagName === "INPUT" ? `[${el.type}${el.name ? " " + el.name : ""}]` : "";
      return { d: `${el.tagName.toLowerCase()}${kind}${el.id ? "#" + el.id : ""} "${name}"`, ring, outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}` };
    });
    const walk = async (key, n) => {
      const seq = [];
      for (let i = 0; i < n; i++) { await page.keyboard.press(key); seq.push(await describe()); }
      return seq;
    };
    const plain = await walk("Tab", 14);
    note("plain Tab sequence (first 14)", plain.map((s) => s.d));
    const plainHasLinks = plain.some((s) => s.d.startsWith("a"));
    note("plain Tab reaches links", plainHasLinks);
    log("Keyboard", "first Tab focuses Skip to content", /Skip to content/.test(plain[0].d) || (engine === "webkit" && TAB === "Alt+Tab"), plain[0].d);
    await page.goto(base + "/");
    await page.locator("#origin").waitFor();
    await page.waitForTimeout(400);
    const seq = await walk(TAB, 40);
    note(`${TAB} sequence (first 40)`, seq.map((s) => s.d));
    if (TAB !== "Tab") log("Keyboard", "Alt+Tab first stop is Skip to content", /Skip to content/.test(seq[0].d), seq[0].d);
    const noRing = seq.filter((s) => !s.ring).map((s) => `${s.d} (outline ${s.outline})`);
    log("Keyboard", "every focused control in first 40 stops has a visible outline/box-shadow", noRing.length === 0, noRing.slice(0, 6).join(" | "));
    // Skip link works
    await page.goto(base + "/");
    await page.waitForTimeout(400);
    await page.keyboard.press(TAB);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    const afterSkip = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    log("Keyboard", "skip link moves focus to main content", afterSkip === "main-content", afterSkip);
    // Journey: header Wallet link reachable from the top of the page
    await page.goto(base + "/journey/regional-connection");
    await page.locator("#timeline-title").waitFor();
    await page.waitForTimeout(400);
    let found = -1;
    const jseq = [];
    for (let i = 0; i < 40 && found < 0; i++) {
      await page.keyboard.press(TAB);
      const d = await describe();
      jseq.push(d.d);
      if (await page.evaluate(() => document.activeElement?.getAttribute("href") === "/wallet/regional-connection" && !!document.activeElement.closest("#main-content"))) found = i + 1;
    }
    log("Keyboard", "Journey in-page 'View ticket wallet' reachable from page top", found > 0, found > 0 ? `stop ${found}` : jseq.join(" | "));
    // Firefox/Chromium end-of-document behaviour after the last stop (information)
    await ctx.close();
  });

  await browser.close();
  log("Console", "no page errors, console errors, failed or 4xx/5xx same-origin requests", problems.length === 0, problems.slice(0, 6).join(" ; "));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n[${tag}] ${results.length - failed}/${results.length} checks passed`);
  if (out) fs.writeFileSync(out, JSON.stringify({ tag, results, info }, null, 2));
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
