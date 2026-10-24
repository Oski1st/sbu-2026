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
  // Only rendered (visible) labels count; the map may keep hidden duplicate labels per breakpoint (P4-11).
  // Geography is checked on marker circles, since mobile labels may be offset from their markers.
  for (const width of [1280, 390, 320]) {
    const page = await newPage({ viewport: { width, height: 900 }, isMobile: width < 500, hasTouch: width < 500 });
    const external = [];
    page.on("request", (r) => { if (!r.url().startsWith(base) && !r.url().startsWith("data:")) external.push(r.url()); });
    await page.goto(base + "/");
    await page.waitForTimeout(600);
    const map = page.locator(".east-map");
    const info = await map.evaluate((m) => {
      const svg = m.querySelector("svg");
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== "none" && getComputedStyle(e).visibility !== "hidden"; };
      const box = m.getBoundingClientRect();
      const labels = [];
      for (const t of svg.querySelectorAll("text")) {
        if (!visible(t)) continue;
        const r = t.getBoundingClientRect();
        labels.push({ name: t.textContent.trim(), px: parseFloat(t.getAttribute("font-size") || getComputedStyle(t).fontSize) * scale, l: r.left, r: r.right, t: r.top, b: r.bottom, y: r.top + r.height / 2 });
      }
      // Marker for each city: the circle immediately before its (desktop) label, visible or not.
      const markers = {};
      for (const t of svg.querySelectorAll("text")) {
        const c = t.previousElementSibling;
        if (c?.tagName === "circle" && !markers[t.textContent.trim()]) {
          markers[t.textContent.trim()] = { cx: +c.getAttribute("cx"), cy: +c.getAttribute("cy") };
        }
      }
      const caption = m.querySelector(".map-scale"), legend = m.querySelector(".map-city-legend");
      // Is the legend inside the bottom fade of a mask-image (e.g. linear-gradient to bottom … black 91%, transparent)?
      let fade = null;
      if (legend && visible(legend)) {
        for (let e = legend.parentElement; e; e = e.parentElement) {
          const mask = getComputedStyle(e).maskImage || getComputedStyle(e).webkitMaskImage || "none";
          // Computed values drop the default "to bottom" direction, so a direction-less linear-gradient is vertical too.
          const vertical = /linear-gradient\(\s*(to bottom|180deg)/.test(mask) || /linear-gradient\(\s*(rgb|#|transparent|black|white)/.test(mask);
          if (mask !== "none" && vertical) {
            const stops = [...mask.matchAll(/(\d+(?:\.\d+)?)%/g)].map((x) => +x[1]);
            const solidEnd = stops.length ? Math.max(...stops) / 100 : 1;
            const r = e.getBoundingClientRect(), lr = legend.getBoundingClientRect();
            fade = { solidEndPx: Math.round(r.top + solidEnd * r.height), legendBottom: Math.round(lr.bottom) };
            break;
          }
        }
      }
      const vis = (e) => e && visible(e) ? e.textContent.trim() : "";
      return { labels, markers, box: { l: box.left, r: box.right, t: box.top, b: box.bottom }, aria: m.getAttribute("aria-label") ?? "",
        caption: vis(caption), legend: vis(legend), legendPx: legend && visible(legend) ? parseFloat(getComputedStyle(legend).fontSize) : null,
        legendBox: legend && visible(legend) ? (({ left: l, right: r, top: t, bottom: b }) => ({ l, r, t, b }))(legend.getBoundingClientRect()) : null, fade };
    });
    const M = info.markers;
    const order = ["Portland", "Boston", "New York", "Philadelphia", "Washington, DC", "Raleigh", "Charleston", "Orlando", "Miami"].filter((n) => M[n]);
    log("MAP", `${width}px: markers run north-up (${order.length})`, order.length >= 8 && order.every((n, i) => i === 0 || M[n].cy > M[order[i - 1]].cy), order.map((n) => `${n}@${M[n].cy}`).join(" "));
    log("MAP", `${width}px: Stony Brook marker east of New York marker`, M["Stony Brook"] && M["New York"] && M["Stony Brook"].cx > M["New York"].cx, M["Stony Brook"] ? `${M["Stony Brook"].cx} vs ${M["New York"]?.cx}` : "no Stony Brook marker");
    const cities = info.labels.filter((l) => !/OCEAN|EASTERN|Concept|^N$/.test(l.name));
    log("MAP", `${width}px: visible city labels`, cities.length >= 5, cities.map((l) => l.name).join(", "));
    // P4-11 sets 11px for phone widths; desktop keeps P4-09's 10px floor (it renders 10.6px).
    const floor = width < 500 ? 11 : 10;
    const small = cities.filter((l) => l.px < floor);
    log("MAP", `${width}px: every visible city label ≥${floor}px rendered`, small.length === 0, `${cities.map((l) => `${l.name} ${l.px.toFixed(1)}px`).join(", ")}`);
    const clipped = cities.filter((l) => l.l < info.box.l - 1 || l.r > info.box.r + 1 || l.t < info.box.t - 1 || l.b > info.box.b + 1);
    log("MAP", `${width}px: visible labels inside the map`, clipped.length === 0, clipped.map((l) => l.name).join(", "));
    const overlaps = [];
    for (let i = 0; i < cities.length; i++) for (let j = i + 1; j < cities.length; j++) {
      const a = cities[i], b = cities[j];
      // Glyph boxes include line padding; stacked labels may touch by a few px without ink overlapping.
      if (Math.min(a.r, b.r) - Math.max(a.l, b.l) > 4 && Math.min(a.b, b.b) - Math.max(a.t, b.t) > 4) overlaps.push(`${a.name}×${b.name}`);
    }
    log("MAP", `${width}px: visible labels don't overlap`, overlaps.length === 0, overlaps.join(", "));
    // Every marker is named in visible text: either its own visible label or the visible legend.
    const named = Object.keys(M).filter((n) => cities.some((l) => l.name === n) || info.legend.includes(n));
    log("MAP", `${width}px: every marker named in visible text (label or legend)`, named.length === Object.keys(M).length, `${named.length}/${Object.keys(M).length}` + (info.legend ? ` · legend ${info.legendPx}px` : ""));
    if (info.legend) {
      log("MAP", `${width}px: legend text ≥11px`, info.legendPx >= 11, `${info.legendPx}px`);
      const L = info.legendBox;
      const hits = cities.filter((c) => Math.min(c.r, L.r) - Math.max(c.l, L.l) > 4 && Math.min(c.b, L.b) - Math.max(c.t, L.t) > 4).map((c) => c.name);
      log("MAP", `${width}px: legend doesn't collide with city labels`, hits.length === 0, hits.join(", "));
      log("MAP", `${width}px: legend (with the 'unverified' disclosure) isn't in a mask fade`, !info.fade || info.fade.legendBottom <= info.fade.solidEndPx,
        info.fade ? `legend bottom ${info.fade.legendBottom}px vs fade starts ${info.fade.solidEndPx}px` : "no mask");
    }
    log("MAP", `${width}px: no horizontal page overflow`, (await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)) <= 0);
    const unverified = /unverified/i.test(info.caption + " " + info.legend);
    log("MAP", `${width}px: visible text says connections are unverified; aria-label says not verified services`, unverified && /not verified services or actual rail and road alignments/.test(info.aria), (info.caption || info.legend).slice(0, 70));
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
