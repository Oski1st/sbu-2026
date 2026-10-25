// P4-25: browser checks for the Search integration candidate (PR #29): city combobox and date/time planning preferences.
// Usage: node qa/p4-25-search-check.cjs <baseURL> [screenshotDir]
// Chromium via Playwright; no geolocation permission is granted or requested.
const { chromium, devices } = require("playwright");
const fs = require("node:fs");
const base = process.argv[2] || "http://127.0.0.1:4173";
const shots = process.argv[3];
if (shots) fs.mkdirSync(shots, { recursive: true });
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

async function open(page, path = "/") { await page.goto(base + path); await page.waitForSelector(".route-card, .results-heading", { timeout: 20000 }); }
const listbox = (id) => `#${id}-listbox`;
const options = (page, id) => page.locator(`${listbox(id)} [role=option]`);
const statusText = (page) => page.locator(".results-heading [role=status]").innerText();
async function cardSummary(page) { return page.$$eval(".route-card", (cs) => cs.map((c) => c.innerText.replace(/\s+/g, " ").trim())); }
async function submit(page) { const before = await statusText(page); await page.click(".search-button"); await page.waitForFunction((b) => document.querySelector(".results-heading [role=status]")?.textContent !== b || true, before); await page.waitForTimeout(150); }

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const geoCalls = [];
  await page.exposeFunction("__geoCall", (n) => geoCalls.push(n));
  await page.addInitScript(() => {
    for (const k of ["getCurrentPosition", "watchPosition"]) {
      try { const orig = navigator.geolocation[k].bind(navigator.geolocation); navigator.geolocation[k] = (...a) => { window.__geoCall(k); return orig(...a); }; } catch {}
    }
  });
  await open(page);

  // --- A. Combobox semantics
  for (const id of ["origin", "destination"]) {
    const a = await page.$eval(`#${id}`, (el) => ({ role: el.getAttribute("role"), ac: el.getAttribute("aria-autocomplete"), controls: el.getAttribute("aria-controls"),
      expanded: el.getAttribute("aria-expanded"), label: el.labels?.[0]?.innerText.trim(), required: el.required, value: el.value }));
    check(`A1 ${id}: role=combobox, aria-autocomplete=list, aria-controls=${id}-listbox, collapsed, labelled, required`,
      a.role === "combobox" && a.ac === "list" && a.controls === `${id}-listbox` && a.expanded === "false" && !!a.label && a.required, JSON.stringify(a));
  }
  check("A2 defaults Philadelphia → Stony Brook", (await page.inputValue("#origin")) === "Philadelphia" && (await page.inputValue("#destination")) === "Stony Brook");

  // --- B. Keyboard: arrows, Enter, Escape
  await page.fill("#origin", "");
  await page.focus("#origin");
  await page.keyboard.type("bos");
  check("B1 typing opens the listbox and filters (bos → Boston)", (await page.getAttribute("#origin", "aria-expanded")) === "true" && (await options(page, "origin").count()) >= 1 && (await options(page, "origin").first().innerText()).includes("Boston"));
  await page.keyboard.press("ArrowDown");
  const active = await page.getAttribute("#origin", "aria-activedescendant");
  check("B2 ArrowDown sets aria-activedescendant to an option id with aria-selected=true", !!active && (await page.getAttribute(`#${active}`, "aria-selected")) === "true", active);
  await page.keyboard.press("Enter");
  check("B3 Enter selects the active option and closes the list (no submit)", (await page.inputValue("#origin")) === "Boston" && (await page.getAttribute("#origin", "aria-expanded")) === "false");
  await page.fill("#destination", "");
  await page.focus("#destination");
  await page.keyboard.type("n");
  await page.keyboard.press("ArrowUp");
  const n = await options(page, "destination").count();
  const lastId = await options(page, "destination").nth(n - 1).getAttribute("id");
  check("B4 ArrowUp from no selection wraps to the last option", (await page.getAttribute("#destination", "aria-activedescendant")) === lastId, `${n} options`);
  await page.keyboard.press("Escape");
  check("B5 Escape closes the list and keeps typed text", (await page.getAttribute("#destination", "aria-expanded")) === "false" && (await page.inputValue("#destination")) === "n");
  await page.fill("#destination", "New York City");
  check("B6 alias 'New York City' is accepted as supported (no amber warning)", (await page.locator(".location-autocomplete").nth(1).locator(".text-amber-800").count()) === 0);
  await page.keyboard.press("Escape");
  await submit(page);
  check("B7 Enter-less submit Boston → NYC alias shows results", (await page.locator(".route-card").count()) > 0, await statusText(page));
  check("B8 URL carries from/to after submit", /from=Boston/.test(page.url()) && /to=New(\+|%20)York(\+|%20)City/.test(page.url()), page.url());

  // --- C. No-match and manual unsupported input
  await page.fill("#origin", "Atlantis");
  check("C1 no-match: status says no supported cities; visible no-match note", (await page.locator("#origin-status").innerText()).includes("No supported sample cities") && (await page.locator(".location-autocomplete").first().innerText()).includes("No supported sample cities match"));
  await page.keyboard.press("Escape");
  check("C2 after Escape the 'not yet a supported sample city' hint shows; manual text kept", (await page.locator(".location-autocomplete").first().innerText()).includes("not yet a supported sample city") && (await page.inputValue("#origin")) === "Atlantis");
  await submit(page);
  check("C3 unsupported manual submit gives honest no-route feedback, no crash", (await page.locator(".route-card").count()) === 0 && /no|unsupported|not/i.test(await page.locator("main").innerText()), (await statusText(page)).slice(0, 120));

  // --- D. Pointer selection keeps focus; mouse click on option
  await page.fill("#origin", "");
  await page.focus("#origin");
  await page.keyboard.type("phil");
  await options(page, "origin").first().click();
  check("D1 mouse click selects Philadelphia; focus stays on input", (await page.inputValue("#origin")) === "Philadelphia" && (await page.evaluate(() => document.activeElement?.id)) === "origin");

  // --- E. Date/time preferences in URL, refresh, share, malformed values, unchanged sample times
  await open(page, "/");
  const baselineCards = await cardSummary(page);
  await page.fill('input[name="departure-date"]', "2026-11-03");
  await page.fill('input[name="departure-time"]', "17:45");
  await submit(page);
  check("E1 submit writes date and time to the URL", /date=2026-11-03/.test(page.url()) && /time=17(%3A|:)45/.test(page.url()), page.url());
  const prefCards = await cardSummary(page);
  check("E2 sample itinerary cards are unchanged by date/time preferences", JSON.stringify(prefCards) === JSON.stringify(baselineCards), `${prefCards.length} cards`);
  const shareUrl = page.url();
  await page.reload(); await page.waitForSelector(".route-card");
  check("E3 refresh restores date and time inputs", (await page.inputValue('input[name="departure-date"]')) === "2026-11-03" && (await page.inputValue('input[name="departure-time"]')) === "17:45");
  const fresh = await browser.newContext(); const fp = await fresh.newPage(); await fp.goto(shareUrl); await fp.waitForSelector(".route-card");
  check("E4 shared URL in a fresh browser restores preferences", (await fp.inputValue('input[name="departure-date"]')) === "2026-11-03" && (await fp.inputValue('input[name="departure-time"]')) === "17:45");
  for (const [q, d, t] of [["date=2026-02-30&time=25:00", "2026-10-24", "08:00"], ["date=abc&time=7:5", "2026-10-24", "08:00"], ["date=2028-02-29&time=23:59", "2028-02-29", "23:59"]]) {
    await fp.goto(`${base}/?${q}`); await fp.waitForSelector(".route-card");
    check(`E5 malformed/edge URL '${q}' → ${d} ${t}`, (await fp.inputValue('input[name="departure-date"]')) === d && (await fp.inputValue('input[name="departure-time"]')) === t);
  }
  await fresh.close();

  // --- F. Back/forward when only the preference differs
  await open(page, "/");
  await page.fill('input[name="departure-time"]', "06:15"); await submit(page);
  await page.fill('input[name="departure-time"]', "21:30"); await submit(page);
  await page.goBack(); await page.waitForTimeout(300);
  check("F1 Back restores the previous time (06:15) in the form", (await page.inputValue('input[name="departure-time"]')) === "06:15", page.url());
  await page.goForward(); await page.waitForTimeout(300);
  check("F2 Forward restores 21:30", (await page.inputValue('input[name="departure-time"]')) === "21:30", page.url());

  // --- G. Corridor shortcut keeps preferences; swap button
  const corridor = page.locator(".corridor-pick").first();
  if (await corridor.count()) {
    await corridor.click(); await page.waitForTimeout(300);
    check("G1 corridor shortcut keeps the date/time preference in the URL", /time=21(%3A|:)30/.test(page.url()), page.url());
  } else check("G1 corridor shortcut present", false);
  const [o0, d0] = [await page.inputValue("#origin"), await page.inputValue("#destination")];
  const swapBtn = page.locator(".search-form > button[type=button]");
  if (await swapBtn.count()) { await swapBtn.first().click(); check("G2 swap button exchanges origin and destination", (await page.inputValue("#origin")) === d0 && (await page.inputValue("#destination")) === o0, `${o0}/${d0}`); }
  else check("G2 swap button present", false);

  // --- H. Filters/Compare still present after integration
  check("H1 filters and Compare controls still render", (await page.locator("select, [role=radiogroup], fieldset").count()) > 0 && /compare/i.test(await page.locator("main").innerText()));

  // --- I. Small screens: 320 and 390 px, list open
  for (const w of [320, 390]) {
    const mc = await browser.newContext({ viewport: { width: w, height: 760 }, hasTouch: true, isMobile: true });
    const mp = await mc.newPage(); await open(mp);
    await mp.tap("#origin"); await mp.fill("#origin", "");
    await mp.keyboard.type("ba");
    const box = await mp.locator(listbox("origin")).boundingBox();
    const overflow = await mp.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`I1 ${w}px: open listbox within viewport, no page overflow`, !!box && box.x >= 0 && box.x + box.width <= w + 0.5 && !overflow, JSON.stringify(box));
    const optH = await mp.locator(`${listbox("origin")} [role=option]`).first().boundingBox();
    check(`I2 ${w}px: option tap target ≥ 40px tall`, !!optH && optH.height >= 40, optH && optH.height.toFixed(1));
    const firstName = (await mp.locator(`${listbox("origin")} [role=option] span`).first().innerText()).trim();
    await mp.locator(`${listbox("origin")} [role=option]`).first().tap();
    check(`I3 ${w}px: touch tap selects the tapped city ("ba" lists ${firstName} first)`, (await mp.inputValue("#origin")) === firstName && (await mp.getAttribute("#origin", "aria-expanded")) === "false", await mp.inputValue("#origin"));
    const dateH = await mp.locator('input[name="departure-date"]').boundingBox();
    check(`I4 ${w}px: date/time inputs ≥ 44px tall and inside viewport`, !!dateH && dateH.height >= 43.5 && dateH.x + dateH.width <= w + 0.5, dateH && JSON.stringify(dateH));
    if (shots) await mp.screenshot({ path: `${shots}/p4-25-search-${w}.png`, fullPage: false });
    await mc.close();
  }

  // --- J. Focus visibility and privacy
  await open(page, "/");
  await page.focus("#origin");
  const ring = await page.$eval("#origin", (el) => { const s = getComputedStyle(el); return s.boxShadow !== "none" || s.outlineStyle !== "none"; });
  check("J1 focused combobox shows a visible focus indicator", ring);
  check("J2 no geolocation call anywhere in the session", geoCalls.length === 0, JSON.stringify(geoCalls));
  check("J3 no page or console errors", errors.length === 0, errors.slice(0, 3).join(" | "));
  if (shots) await page.screenshot({ path: `${shots}/p4-25-search-1280.png` });

  await browser.close();
  console.log(`\n${pass}/${pass + fail} P4-25 checks passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
