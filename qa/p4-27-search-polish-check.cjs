// P4-27: recheck of the #29 Search polish follow-up (S1 compact date/time layout, S2 suggestion ranking).
// Usage: node qa/p4-27-search-polish-check.cjs <baseURL> <checkout-dir> [screenshotDir]
// S2 compares the rendered listbox against an independent implementation of the stated rule:
// exact (id/name/"name, state"/alias) < name-or-alias prefix < word-start < substring, catalogue order for ties, limit 8 applied after ranking.
const { chromium } = require("playwright");
const fs = require("node:fs");
const [base, checkout, shots] = [process.argv[2] || "http://127.0.0.1:4173", process.argv[3], process.argv[4]];
if (shots) fs.mkdirSync(shots, { recursive: true });
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

// Independent catalogue model, read from source text (not from the app's ranking code).
const src = fs.readFileSync(`${checkout}/src/data/eastCoast.ts`, "utf8");
const cities = [...src.slice(src.indexOf("export const cities")).matchAll(/\["([a-z-]+)", "([^"]+)", "([A-Z]{2})"\]/g)].map((m) => ({ id: m[1], name: m[2], state: m[3] }));
const aliases = { "new-york": ["NYC", "New York City"], philadelphia: ["Philly"], washington: ["DC", "Washington DC", "Washington D C"], portland: ["Portland Maine"], "stony-brook": ["Long Island"] };
const norm = (v) => v.toLowerCase().trim().replace(/[.,]/g, "").replace(/\s+/g, " ");
function expected(q) {
  const query = norm(q);
  if (!query) return cities.slice(0, 8).map((c) => c.name);
  return cities.map((c, order) => {
    const al = aliases[c.id] || [];
    const exact = [c.id, c.name, `${c.name}, ${c.state}`, ...al].map(norm);
    const searchable = [...exact, norm(c.state)];
    const rank = exact.includes(query) ? 0 : [c.name, ...al].map(norm).some((t) => t.startsWith(query)) ? 1
      : searchable.some((t) => (" " + t.replace(/-/g, " ")).includes(" " + query)) ? 2
      : searchable.some((t) => t.includes(query)) ? 3 : 4;
    return { name: c.name, order, rank };
  }).filter((e) => e.rank < 4).sort((a, b) => a.rank - b.rank || a.order - b.order).slice(0, 8).map((e) => e.name);
}

(async () => {
  check("catalogue model parsed 24 cities", cities.length === 24, cities.length);
  const browser = await chromium.launch();
  const errors = [];
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/"); await page.waitForSelector(".route-card");
  const listed = async (q) => { await page.fill("#origin", ""); await page.focus("#origin"); await page.keyboard.type(q); const n = await page.$$eval("#origin-listbox [role=option] span:first-child", (s) => s.map((x) => x.textContent)); await page.keyboard.press("Escape"); return n; };

  // S2 named cases from the finding
  const ch = await listed("ch");
  check("S2a 'ch': Charlotte and Charleston rank before Richmond", ch.indexOf("Charlotte") < ch.indexOf("Richmond") && ch.indexOf("Charleston") < ch.indexOf("Richmond"), ch.join(", "));
  const or = await listed("or");
  check("S2b 'or': Orlando listed first (prefix)", or[0] === "Orlando", or.join(", "));
  const ba = await listed("ba");
  check("S2c 'ba': Baltimore (prefix) before Albany (substring)", ba.indexOf("Baltimore") === 0 && ba.indexOf("Albany") > 0, ba.join(", "));
  const nyc = await listed("nyc");
  check("S2d alias exact 'nyc' → New York first", nyc[0] === "New York", nyc.join(", "));
  const li = await listed("long");
  check("S2e alias prefix 'long' (Long Island) → Stony Brook first", li[0] === "Stony Brook", li.join(", "));
  const a = await listed("a");
  check("S2f limit after ranking: 'a' still lists prefix match Albany first within 8", a[0] === "Albany" && a.length <= 8, a.join(", "));
  const neu = await listed("new");
  const nh = neu.indexOf("New Haven"), ny = neu.indexOf("New York");
  check("S2g stable tie: 'new' prefix matches keep catalogue order", nh >= 0 && ny >= 0 && (cities.findIndex((c) => c.name === "New Haven") < cities.findIndex((c) => c.name === "New York")) === (nh < ny), neu.join(", "));
  // S2 broad: every rendered list equals the independent model
  const queries = ["", "a", "b", "c", "ch", "or", "an", "ba", "port", "st", "new", "ny", "nyc", "dc", "phil", "philly", "long", "fort", "ra", "sa", "on", "ville", "m", "zz"];
  const mism = [];
  for (const q of queries) { const got = await listed(q); const exp = expected(q); if (JSON.stringify(got) !== JSON.stringify(exp)) mism.push(`${q}: got [${got}] expected [${exp}]`); }
  check(`S2h ${queries.length} queries match the independent ranking model exactly`, mism.length === 0, mism.slice(0, 4).join(" | "));
  const zz = await listed("zz");
  check("S2i no-match 'zz' → empty list", zz.length === 0);

  // S1 layout at 320 / 360 / 361 / 375 / 390
  for (const w of [320, 360, 361, 375, 390]) {
    const p = await (await browser.newContext({ viewport: { width: w, height: 800 }, isMobile: true, hasTouch: true, locale: "en-US" })).newPage();
    await p.goto(base + "/?date=2026-10-24&time=08:00"); await p.waitForSelector(".route-card");
    const d = await p.locator('input[name="departure-date"]').boundingBox();
    const t = await p.locator('input[name="departure-time"]').boundingBox();
    const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    const stacked = t.y > d.y + d.height - 1;
    if (w <= 360) check(`S1 ${w}px: date and time stacked, each ≥136px (values fully visible; 136px is the narrowest width seen unclipped), within viewport, no page overflow`, stacked && d.width >= 136 && t.width >= 136 && d.x + d.width <= w && !overflow, `date ${d.width.toFixed(0)}px time ${t.width.toFixed(0)}px`);
    else check(`S1 ${w}px: side-by-side layout retained with each input ≥136px (values fully visible), within viewport`, !stacked && d.width >= 136 && t.width >= 136 && t.x + t.width <= w && !overflow, `date ${d.width.toFixed(0)}px time ${t.width.toFixed(0)}px`);
    if (shots) await p.locator(".date-field").screenshot({ path: `${shots}/p4-27-datetime-${w}.png` });
    await p.context().close();
  }
  check("no page errors", errors.length === 0, errors.join(" | "));
  await browser.close();
  console.log(`\n${pass}/${pass + fail} P4-27 checks passed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
