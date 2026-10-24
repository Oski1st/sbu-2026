// P4-09 targeted checks: Search persistence and history (X2), multi-day duration (X3),
// coach guidance, guided Journey flows, keyboard, reduced motion and the geographic map.
// Usage: node qa/p4-09-check.cjs <baseURL> <shotDir>
const { chromium } = require("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const shots = process.argv[3] ?? "qa-results/p4-09";
require("node:fs").mkdirSync(shots, { recursive: true });
const results = [];
const log = (id, name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? " — " + detail : ""}`);
};
const flat = (s) => s.replace(/\s+/g, " ").trim();
const cardIds = (page) => page.locator(".route-card a.select-route").evaluateAll((as) => as.map((a) => a.getAttribute("href").replace("/journey/", "")));
const qs = (page) => Object.fromEntries(new URL(page.url()).searchParams);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${page.url()} ${e.message}`));
    page.on("console", (m) => m.type() === "error" && !m.location()?.url?.includes("/api/transit/septa/") && errors.push(`${page.url()} ${m.text()}`));
    return page;
  };

  // X2: search criteria persist in the URL, survive refresh, and follow Back/Forward.
  {
    const page = await newPage();
    await page.goto(base + "/");
    await page.locator("#origin").fill("Boston");
    await page.locator("#destination").fill("New York");
    await page.locator(".search-button").click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Bus only", exact: true }).click();
    await page.waitForTimeout(150);
    await page.locator(".transport-filters select").selectOption("GREYHOUND");
    await page.waitForTimeout(150);
    await page.locator("#sort").selectOption("fastest");
    await page.waitForTimeout(200);
    const q = qs(page);
    log("X2", "URL holds from/to/mode/operator/sort", q.from === "Boston" && q.to === "New York" && q.mode === "bus" && q.operator === "GREYHOUND" && q.sort === "fastest", JSON.stringify(q));
    const before = await cardIds(page);
    await page.reload();
    await page.waitForTimeout(400);
    const after = await cardIds(page);
    const pressed = await page.getByRole("button", { name: "Bus only", exact: true }).getAttribute("aria-pressed");
    const op = await page.locator(".transport-filters select").inputValue();
    const sort = await page.locator("#sort").inputValue();
    const formOrigin = await page.locator("#origin").inputValue();
    log("X2", "Refresh keeps results, filters, sort and form values",
      JSON.stringify(before) === JSON.stringify(after) && after.length === 1 && pressed === "true" && op === "GREYHOUND" && sort === "fastest" && formOrigin === "Boston",
      `${after.join(",")} · bus=${pressed} op=${op} sort=${sort} from=${formOrigin}`);
    await page.goBack();
    await page.waitForTimeout(300);
    const back1 = qs(page);
    log("X2", "Back undoes the last filter (sort)", back1.sort === undefined && back1.operator === "GREYHOUND" && (await page.locator("#sort").inputValue()) === "recommended", JSON.stringify(back1));
    await page.goBack();
    await page.waitForTimeout(300);
    const back2 = qs(page);
    const back2ids = await cardIds(page);
    log("X2", "Back again removes the operator filter and shows both coaches", back2.operator === undefined && back2.mode === "bus" && back2ids.length === 2, `${JSON.stringify(back2)} ${back2ids.join(",")}`);
    await page.goForward();
    await page.goForward();
    await page.waitForTimeout(300);
    const fwd = qs(page);
    log("X2", "Forward twice restores operator and sort", fwd.operator === "GREYHOUND" && fwd.sort === "fastest" && (await cardIds(page)).length === 1, JSON.stringify(fwd));
    const shared = page.url();
    await page.context().close();
    const fresh = await newPage();
    await fresh.goto(shared);
    await fresh.waitForTimeout(400);
    log("X2", "Shared search URL opens the same filtered results in a fresh browser", JSON.stringify(await cardIds(fresh)) === JSON.stringify(after), shared.replace(base, ""));
    await fresh.goto(base + "/?from=Boston&to=New%20York&mode=evil&operator=NOPE&sort=zzz&amtrak=maybe");
    await fresh.waitForTimeout(400);
    const ids = await cardIds(fresh);
    log("X2", "Malformed query values fall back to safe defaults", ids.length === 3 && (await fresh.locator("#sort").inputValue()) === "recommended", ids.join(","));
    await fresh.goto(base + "/?from=" + "A".repeat(500) + "&to=Boston");
    await fresh.waitForTimeout(300);
    const status = flat(await fresh.locator(".results-heading [role=status]").innerText());
    log("X2", "Very long city input is bounded and shows the unsupported-city state", /0 sample connections/.test(status) && status.length < 260, `${status.length} chars`);
    await fresh.goto(base + "/");
    await fresh.waitForTimeout(300);
    log("X2", "Plain / still shows the original demo", JSON.stringify(await cardIds(fresh)) === JSON.stringify(["regional-connection", "amtrak-connection"]));
    await fresh.context().close();
  }

  // X3: readable multi-day duration.
  {
    const page = await newPage();
    for (const [id, expect] of [["east-portland--miami--amtrak", /33h 30m|1d 9h 30m|1 day/], ["regional-connection", /5h 15m/], ["east-boston--stony-brook--greyhound", /8h 35m/]]) {
      await page.goto(`${base}/journey/${id}`);
      await page.locator(`#main-content a[href="/wallet/${id}"]`).first().waitFor();
      const header = flat(await page.locator("#main-content header").first().innerText());
      const total = (header.match(/[^·]{0,20}total/) ?? [""])[0].trim();
      log("X3", `${id}: total duration readable`, expect.test(total) && !/\d{3,} min/.test(header), total);
    }
    await page.context().close();
  }

  // Coach guidance on transfers.
  {
    const page = await newPage();
    await page.goto(`${base}/journey/east-stony-brook--boston--greyhound`);
    await page.locator('#main-content a[href="/wallet/east-stony-brook--boston--greyhound"]').first().waitFor();
    let t = flat(await page.locator("#main-content").innerText());
    log("COACH", "LIRR → coach transfer uses operator boarding guidance, not platform boards", /Boarding location: check official operator details/.test(t) && !/Platform: check live station boards/.test(t), (t.match(/Transfer at[^.]{0,160}/) ?? [""])[0]);
    await page.goto(`${base}/journey/east-boston--stony-brook--greyhound`);
    await page.locator('#main-content a[href="/wallet/east-boston--stony-brook--greyhound"]').first().waitFor();
    t = flat(await page.locator("#main-content").innerText());
    log("COACH", "Coach → LIRR transfer keeps platform guidance for the rail leg", /Platform: check live station boards/.test(t));
    await page.getByRole("button", { name: "Simulate delay" }).first().click();
    await page.waitForTimeout(300);
    t = flat(await page.locator("#main-content").innerText());
    log("COACH", "Simulated coach delay points to operator/terminal info and stays labelled simulated", /official operator details or terminal information|boarding location and service updates/.test(t) && /simulat/i.test(t));
    await page.context().close();
  }

  // Guided flows: bus-only, mixed, reverse, overnight. Mouse to the end, keyboard back and forward.
  for (const [kind, id] of [["bus-only", "east-boston--new-york--greyhound"], ["mixed", "east-boston--stony-brook--flixbus"], ["reverse", "east-stony-brook--boston--greyhound"], ["overnight", "east-portland--miami--amtrak"]]) {
    const page = await newPage();
    await page.goto(`${base}/journey/${id}`);
    await page.locator(`#main-content a[href="/wallet/${id}"]`).first().waitFor();
    const live = page.locator('[aria-live="polite"][aria-atomic="true"]').first();
    await page.getByRole("button", { name: "Start demo journey" }).click();
    const seen = [flat(await live.innerText())];
    const next = page.getByRole("button", { name: "Next step" });
    for (let i = 0; i < 20 && (await next.isEnabled()); i++) {
      await next.click();
      seen.push(flat(await live.innerText()));
    }
    const distinct = new Set(seen).size;
    const last = seen.at(-1);
    // One step per leg plus one per transfer: 2 × legs − 1.
    const legs = await page.locator(`#main-content a[href="/wallet/${id}"]`).first().evaluate(() => document.querySelectorAll("#main-content [aria-expanded]").length);
    const expected = 2 * legs - 1;
    log("GUIDED", `${kind} (${id}): steps through to the end`, distinct === expected && !(await next.isEnabled()), `${distinct} steps (expected ${expected} for ${legs} legs); last: ${last.slice(0, 80)}`);
    if (expected === 1) {
      log("GUIDED", `${kind}: single-leg journey has Next step disabled from the start`, !(await next.isEnabled()));
      await page.getByRole("button", { name: "Reset" }).click();
      log("GUIDED", `${kind}: Reset returns to the start prompt`, /Choose Start demo journey/.test(flat(await live.innerText())));
      await page.context().close();
      continue;
    }
    await next.focus().catch(() => {});
    await page.getByRole("button", { name: "Previous step" }).focus();
    await page.keyboard.press("ArrowLeft");
    const afterLeft = flat(await live.innerText());
    await page.keyboard.press("ArrowRight");
    const afterRight = flat(await live.innerText());
    log("GUIDED", `${kind}: ArrowLeft / ArrowRight move between steps`, afterLeft !== last && afterRight === last, afterLeft.slice(0, 60));
    if (kind === "overnight") log("GUIDED", "overnight: walkthrough reaches the final leg into Miami", /to Miami/.test(last), last.slice(0, 90));
    await page.getByRole("button", { name: "Reset" }).click();
    log("GUIDED", `${kind}: Reset returns to the start prompt`, /Choose Start demo journey/.test(flat(await live.innerText())));
    await page.context().close();
  }

  // Reduced motion
  {
    const page = await newPage({ reducedMotion: "reduce" });
    for (const path of ["/", "/journey/east-portland--miami--amtrak", "/wallet/east-portland--miami--amtrak"]) {
      await page.goto(base + path);
      await page.waitForTimeout(600);
      const moving = await page.evaluate(() => [...document.querySelectorAll("body *")].filter((e) => {
        const cs = getComputedStyle(e);
        const dur = (v) => Math.max(...v.split(",").map((x) => parseFloat(x) || 0));
        return (cs.animationName !== "none" && dur(cs.animationDuration) > 0.01 && cs.animationIterationCount !== "0") || dur(cs.transitionDuration) > 0.01;
      }).map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}`));
      log("MOTION", `reduced motion: no animations/transitions on ${path}`, moving.length === 0, moving.slice(0, 5).join(", ") + (moving.length > 5 ? ` …(+${moving.length - 5})` : ""));
    }
    await page.goto(`${base}/journey/east-portland--miami--amtrak`);
    await page.getByRole("button", { name: "Start demo journey" }).click();
    log("MOTION", "reduced motion: guided demo still works", /Step|Portland|Depart/i.test(flat(await page.locator('[aria-live="polite"][aria-atomic="true"]').first().innerText())));
    await page.context().close();
  }

  // Map: geography, labels, honesty, no external requests.
  for (const width of [1280, 390, 320]) {
    const page = await newPage({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 });
    const external = [];
    page.on("request", (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) external.push(r.url()); });
    await page.goto(base + "/");
    await page.waitForTimeout(600);
    const map = page.locator(".east-map");
    const info = await map.evaluate((m) => {
      const labels = {};
      for (const t of m.querySelectorAll("svg text")) { const b = t.getBoundingClientRect(); labels[t.textContent.trim()] = { x: b.left + b.width / 2, y: b.top + b.height / 2, l: b.left, r: b.right, t: b.top, b: b.bottom }; }
      const box = m.getBoundingClientRect();
      return { labels, box: { l: box.left, r: box.right, t: box.top, b: box.bottom }, aria: m.getAttribute("aria-label"), caption: m.querySelector(".map-scale")?.textContent ?? "" };
    });
    const L = info.labels;
    const order = ["Portland", "Boston", "New York", "Philadelphia", "Washington, DC", "Richmond", "Charlotte", "Savannah", "Jacksonville", "Orlando", "Miami"].filter((n) => L[n]);
    const northUp = order.every((n, i) => i === 0 || L[n].y > L[order[i - 1]].y);
    log("MAP", `${width}px: cities run north-up (${order.length} labelled)`, order.length >= 6 && northUp, order.map((n) => `${n}@${Math.round(L[n].y)}`).join(" "));
    log("MAP", `${width}px: Stony Brook is east of New York`, L["Stony Brook"] && L["New York"] && L["Stony Brook"].x > L["New York"].x, L["Stony Brook"] ? `${Math.round(L["Stony Brook"].x)} vs ${Math.round(L["New York"]?.x)}` : "no Stony Brook label");
    const cityNames = Object.keys(L).filter((n) => !/OCEAN|EASTERN|Concept|^N$/.test(n));
    const clipped = cityNames.filter((n) => L[n].l < info.box.l - 1 || L[n].r > info.box.r + 1 || L[n].t < info.box.t - 1 || L[n].b > info.box.b + 1);
    log("MAP", `${width}px: city labels inside the map`, clipped.length === 0, clipped.join(", "));
    const overlaps = [];
    for (let i = 0; i < cityNames.length; i++) for (let j = i + 1; j < cityNames.length; j++) {
      const a = L[cityNames[i]], b = L[cityNames[j]];
      if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 1 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 1) overlaps.push(`${cityNames[i]}×${cityNames[j]}`);
    }
    log("MAP", `${width}px: city labels don't overlap`, overlaps.length === 0, overlaps.join(", "));
    const sizes = await map.evaluate((m) => {
      const svg = m.querySelector("svg");
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      const city = [...svg.querySelectorAll("text")].find((t) => t.textContent.trim() === "Boston");
      return { city: parseFloat(city.getAttribute("font-size") ?? city.getAttribute("fontSize") ?? 11) * scale, caption: parseFloat(getComputedStyle(m.querySelector(".map-scale")).fontSize) };
    });
    // 10px is a lenient floor for short map labels; body text guidance is 12px or more.
    log("MAP", `${width}px: city labels readable (≥10px rendered)`, sizes.city >= 10, `city ${sizes.city.toFixed(1)}px, caption ${sizes.caption.toFixed(1)}px`);
    log("MAP", `${width}px: no horizontal page overflow`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
    log("MAP", `${width}px: connections labelled unverified concepts`, /not verified services or actual rail and road alignments/.test(info.aria) && /Connections unverified/.test(info.caption) && L["Concept connections"] !== undefined, info.caption);
    log("MAP", `${width}px: no external network requests`, external.length === 0, external.slice(0, 3).join(", "));
    await map.screenshot({ path: `${shots}/map-${width}.png` });
    await page.context().close();
  }

  await browser.close();
  log("ERR", "No page or console errors", errors.length === 0, errors.slice(0, 4).join(" ; "));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} P4-09 checks passed`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
