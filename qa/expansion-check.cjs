// East Coast expansion checks (docs/qa-expansion-plan.md sections B–F).
// Usage: node qa/expansion-check.cjs <baseURL> <shotDir>
const { chromium } = require("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const shots = process.argv[3] ?? "qa-results/expansion";
require("node:fs").mkdirSync(shots, { recursive: true });
const results = [];
const log = (id, name, ok, detail = "") => {
  results.push({ id, name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${name}${detail ? " — " + detail : ""}`);
};
const flat = (s) => s.replace(/\s+/g, " ").trim();
const OPERATOR_DOMAINS = {
  greyhound: ["greyhound.com"], flixbus: ["flixbus.com"], amtrak: ["amtrak.com"],
  lirr: ["mta.info"], septa: ["septa.org", "septakey.org"], njtransit: ["njtransit.com"],
};
const allowed = (host) => Object.values(OPERATOR_DOMAINS).flat().some((d) => host === d || host.endsWith("." + d));
const LIVE_CLAIM = /real[- ]time|book now|live (arrival|price|fare|inventory|seat|departure)s?|guaranteed/i;
// A live claim counts only when its clause isn't negated ("does not … show live arrivals" is fine).
const liveClaims = (text) =>
  [...text.matchAll(new RegExp(LIVE_CLAIM.source, "gi"))]
    .filter((m) => !/\b(not|no|never|without|n't|isn't|aren't)\b[^.;:]*$/i.test(text.slice(Math.max(0, m.index - 100), m.index)))
    .map((m) => text.slice(Math.max(0, m.index - 40), m.index + m[0].length));

async function search(page, origin, destination) {
  await page.locator("#origin").fill(origin);
  await page.locator("#destination").fill(destination);
  await page.locator(".search-button").click();
  await page.waitForFunction(() => /sample connection|sample connections/.test(document.querySelector("#results-title")?.closest("section")?.querySelector("[role=status]")?.textContent ?? ""));
  await page.waitForTimeout(150);
  return {
    status: flat(await page.locator(".results-heading [role=status]").innerText()),
    ids: await page.locator(".route-card a.select-route").evaluateAll((as) => as.map((a) => a.getAttribute("href").replace("/journey/", ""))),
  };
}
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
async function unlabelledOrClipped(page) {
  return page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll("button, a[href], select, input")) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(el).visibility === "hidden" || el.closest(".sr-only, .ol-sr-only")) continue;
      const name = (el.getAttribute("aria-label") || el.innerText || el.labels?.[0]?.innerText || el.getAttribute("title") || "").trim();
      if (!name) bad.push(`unnamed <${el.tagName.toLowerCase()}>`);
      else if (r.right > window.innerWidth + 1) bad.push(`off-screen "${name.slice(0, 30)}"`);
    }
    return bad;
  });
}

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const newPage = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${page.url()} ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.location()?.url?.includes("/api/transit/septa/")) errors.push(`${page.url()} console ${m.text()}`);
    });
    return page;
  };
  let page = await newPage();
  await page.goto(base + "/");

  // A1: default demo unchanged
  {
    const ids = await page.locator(".route-card a.select-route").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
    log("A1", "Default search still shows the two original demo routes", ids.includes("/journey/regional-connection") && ids.includes("/journey/amtrak-connection") && ids.length === 2, ids.join(", "));
  }

  // B1 Boston → New York
  const b1 = await search(page, "Boston", "New York");
  log("B1", "Boston → New York offers Amtrak, Greyhound and FlixBus", ["amtrak", "greyhound", "flixbus"].every((p) => b1.ids.includes(`east-boston--new-york--${p}`)), `${b1.status} [${b1.ids.join(", ")}]`);
  {
    const cards = page.locator(".route-card");
    const n = await cards.count();
    let labelled = 0, fareOk = 0;
    for (let i = 0; i < n; i++) {
      const t = flat(await cards.nth(i).innerText());
      if (/SAMPLE ITINERARY/i.test(t) && /concept|not verified|illustrative/i.test(t)) labelled++;
      if (/Check fares/.test(t) && !/\$0\b|NaN|undefined/.test(t)) fareOk++;
    }
    log("D1", "Every Boston → New York card is labelled sample/concept", labelled === n && n > 0, `${labelled}/${n}`);
    log("D2", "Unknown fares show 'Check fares', never $0/NaN", fareOk === n, `${fareOk}/${n}`);
    const disclaimer = flat(await page.locator(".results-disclaimer").innerText());
    log("D1", "Results disclaimer says expanded routes are concepts", /city-level concepts, not verified services/i.test(disclaimer));
  }
  await page.screenshot({ path: `${shots}/b1-boston-new-york-desktop.png`, fullPage: false });

  // C6/C7 filters on Boston → New York
  const filter = async (label) => {
    await page.getByRole("button", { name: label, exact: true }).click();
    await page.waitForTimeout(150);
    return page.locator(".route-card a.select-route").evaluateAll((as) => as.map((a) => a.getAttribute("href").split("--").pop()));
  };
  {
    const rail = await filter("Rail only");
    log("C6", "Rail only → Amtrak only", rail.length > 0 && rail.every((p) => p === "amtrak"), rail.join(","));
    const pressed = await page.getByRole("button", { name: "Rail only", exact: true }).getAttribute("aria-pressed");
    log("F2", "Mode filter exposes aria-pressed", pressed === "true", pressed);
    const busOnly = await filter("Bus only");
    log("C6", "Bus only → Greyhound and FlixBus only", busOnly.length === 2 && busOnly.every((p) => ["greyhound", "flixbus"].includes(p)), busOnly.join(","));
    const mixed = await filter("Rail + bus");
    const empty = mixed.length ? "" : flat(await page.locator(".empty-state").innerText());
    log("C6", "Rail + bus on Boston → New York → clear empty state", mixed.length === 0 && /Try another mode or operator/.test(empty), empty.slice(0, 120));
    await filter("All transport");
    await page.locator(".transport-filters select").selectOption("GREYHOUND");
    await page.waitForTimeout(150);
    const gh = await page.locator(".route-card a.select-route").evaluateAll((as) => as.map((a) => a.getAttribute("href").split("--").pop()));
    log("C7", "Operator = Greyhound → only Greyhound", gh.length === 1 && gh[0] === "greyhound", gh.join(","));
    await page.locator(".transport-filters select").selectOption("all");
    await page.waitForTimeout(150);
    log("C7", "Clearing operator filter restores all", (await page.locator(".route-card").count()) === b1.ids.length);
  }

  // Compare two expanded routes with unknown fares
  {
    await page.locator(".compare-shortcut").click();
    const dlg = page.locator("dialog.comparison-dialog[open]");
    await dlg.waitFor();
    const t = flat(await dlg.innerText());
    log("D2", "Compare with unknown fares shows no $0/NaN and says sample", !/NaN|undefined|\$0\b/.test(t) && /sample/i.test(t), t.slice(0, 160));
    await page.keyboard.press("Escape");
  }
  // Sort by fare with unknown fares
  {
    await page.locator("#sort").selectOption("fare");
    await page.waitForTimeout(150);
    log("D2", "Sort by lowest sample fare with unknown fares keeps all results", (await page.locator(".route-card").count()) === b1.ids.length);
    await page.locator("#sort").selectOption("recommended");
  }

  // B2 Portland → Miami overnight
  const b2 = await search(page, "Portland", "Miami");
  log("B2", "Portland → Miami has results", b2.ids.length > 0, `${b2.status} [${b2.ids.join(", ")}]`);
  {
    const arrivals = await page.locator(".route-card .route-time.arrival").allInnerTexts();
    log("B2", "Arrival shows a next-day date on every card", arrivals.length > 0 && arrivals.every((a) => /Oct (25|26)/.test(a)), arrivals.map(flat).join(" | "));
  }

  // B3 Boston → Stony Brook mixed
  const b3 = await search(page, "Boston", "Stony Brook");
  log("B3", "Boston → Stony Brook has results", b3.ids.length > 0, `${b3.status} [${b3.ids.join(", ")}]`);
  {
    const mixed = await filter("Rail + bus");
    log("B3", "Rail + bus filter keeps coach + LIRR journeys", mixed.length > 0 && mixed.every((p) => ["greyhound", "flixbus"].includes(p)), mixed.join(","));
    await filter("All transport");
  }

  // B4 reverse trips
  for (const [o, d] of [["New York", "Boston"], ["Miami", "Portland"], ["Stony Brook", "Boston"]]) {
    const r = await search(page, o, d);
    const slug = (s) => s.toLowerCase().replace(/\s+/g, "-");
    const correct = r.ids.length > 0 && r.ids.every((id) => id.startsWith(`east-${slug(o)}--${slug(d)}--`));
    log("B4", `Reverse ${o} → ${d} returns trips in that direction`, correct, `${r.status}`);
  }

  // C aliases and invalid input
  for (const [o, d, expectStart] of [
    ["NYC", "Boston", "east-new-york--boston--"],
    ["New York City", "Boston", "east-new-york--boston--"],
    ["Boston", "DC", "east-boston--washington--"],
    ["Boston", "Washington, DC", "east-boston--washington--"],
    ["  boston ", "new york", "east-boston--new-york--"],
  ]) {
    const r = await search(page, o, d);
    log("C1-3", `Alias "${o}" → "${d}" resolves`, r.ids.length > 0 && r.ids.every((id) => id.startsWith(expectStart)), r.status);
  }
  {
    const r = await search(page, "Atlantis", "Boston");
    const empty = flat(await page.locator(".empty-state").innerText());
    log("C4", "Unknown city → no invented route, catalogue message, names input", r.ids.length === 0 && /East Coast catalogue/.test(empty) && /Atlantis/.test(r.status), `${r.status} / ${empty.slice(0, 90)}`);
    await page.screenshot({ path: `${shots}/c4-unknown-city.png` });
    const same = await search(page, "Boston", "boston");
    log("C5", "Same origin and destination → 'two different cities'", same.ids.length === 0 && /two different cities/.test(flat(await page.locator(".empty-state").innerText())));
    await page.locator(".empty-state button").click();
    await page.waitForTimeout(200);
    log("C5", "'Show demo routes' restores the original demo", (await page.locator('a.select-route[href="/journey/regional-connection"]').count()) === 1);
  }

  // Share link for an expanded route
  {
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin: base });
    await search(page, "Boston", "New York");
    const btn = page.locator(".route-card .share-trip-button").first();
    const label = await btn.getAttribute("aria-label");
    await btn.click();
    await page.waitForTimeout(200);
    const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ""));
    log("E2", "Share copies a canonical /journey/east-… link", /\/journey\/east-boston--new-york--/.test(clip), `${label} → ${clip}`);
  }
  await page.context().close();

  // B5, D3, D4, D5, E1, E2 on Journey and Wallet for each expanded id
  const expanded = ["east-boston--new-york--greyhound", "east-boston--new-york--flixbus", "east-boston--new-york--amtrak", "east-portland--miami--amtrak", "east-boston--stony-brook--greyhound", "east-boston--stony-brook--flixbus"];
  for (const id of expanded) {
    page = await newPage(); // fresh profile: no localStorage, like a shared link
    await page.goto(`${base}/journey/${id}`);
    await page.locator(`#main-content a[href="/wallet/${id}"]`).first().waitFor({ timeout: 8000 }).catch(() => {});
    const jt = flat(await page.locator("#main-content").innerText());
    const found = !/not found/i.test(jt) && jt.length > 200;
    log("E2", `${id}: Journey opens from a fresh browser`, found);
    log("D1", `${id}: Journey labels concept/sample`, /concept|sample|illustrative|not verified/i.test(jt));
    log("D5", `${id}: Journey makes no live claims`, liveClaims(jt).length === 0, liveClaims(jt).join(" | "));
    if (id.includes("portland--miami")) {
      log("B2", `${id}: Journey shows the next-day date`, /Oct 25/.test(jt), (jt.match(/[^.]{0,40}Oct 25[^.]{0,20}/) ?? ["no Oct 25"])[0]);
    }
    if (id.includes("stony-brook--greyhound") || id.includes("stony-brook--flixbus")) {
      log("B3", `${id}: Journey shows a coach leg and an LIRR leg`, /(Greyhound|FlixBus)/.test(jt) && /LIRR|Long Island/.test(jt));
    }
    await page.reload();
    await page.waitForTimeout(500);
    log("E1", `${id}: Journey survives refresh`, !/not found/i.test(await page.locator("#main-content").innerText()));
    await page.goto(`${base}/wallet/${id}`);
    await page.locator(".oneline-wallet h1").waitFor({ timeout: 8000 }).catch(() => {});
    const wt = flat(await page.locator("#main-content").innerText());
    const legs = await page.locator(".ol-ticket-list > li").count();
    log("B5", `${id}: Wallet lists legs`, legs > 0 && !/not found/i.test(wt), `${legs} legs`);
    const links = await page.locator(".ol-ticket-list a[href^='http']").evaluateAll((as) => as.map((a) => ({ href: a.href, target: a.target, rel: a.rel })));
    const badLinks = links.filter((l) => { const u = new URL(l.href); return u.protocol !== "https:" || !allowed(u.hostname) || l.target !== "_blank" || !/noopener/.test(l.rel) || /utm_|aff|ref=/.test(u.search); });
    log("D3", `${id}: Wallet ticket links are https, operator-owned, new tab, noopener`, links.length >= legs && badLinks.length === 0, [...new Set(links.map((l) => new URL(l.href).hostname))].join(", ") + (badLinks.length ? " BAD " + JSON.stringify(badLinks) : ""));
    const op = id.split("--").pop();
    if (op !== "amtrak") log("D3", `${id}: Wallet links to ${op}.com`, links.some((l) => new URL(l.href).hostname.endsWith(`${op}.com`)));
    log("D4", `${id}: no SEPTA live panel`, (await page.locator("#ol-live-heading").count()) === 0);
    log("D5", `${id}: Wallet makes no live claims`, liveClaims(wt).length === 0, liveClaims(wt).join(" | "));
    await page.reload();
    await page.waitForTimeout(500);
    log("E1", `${id}: Wallet survives refresh`, (await page.locator(".ol-ticket-list > li").count()) === legs);
    await page.context().close();
  }

  // E3 mistyped expanded ids
  page = await newPage();
  for (const p of ["/journey/east-boston--new-york--bogus", "/wallet/east-boston--atlantis--greyhound"]) {
    await page.goto(base + p);
    await page.waitForTimeout(500);
    log("E3", `Mistyped ${p} → not found with a way back`, /not found/i.test(await page.locator("#main-content").innerText()) && (await page.locator('#main-content a[href="/"]').count()) > 0);
  }
  await page.context().close();

  // F1/F3 mobile
  for (const width of [390, 320]) {
    page = await newPage({ viewport: { width, height: 800 }, isMobile: true, hasTouch: true });
    await page.goto(base + "/");
    await search(page, "Boston", "Stony Brook");
    log("F1", `${width}px Search with expanded results: no overflow`, (await noOverflow(page)) <= 0, `${await noOverflow(page)}px`);
    const bad = await unlabelledOrClipped(page);
    log("F1", `${width}px Search: controls named and on-screen`, bad.length === 0, bad.slice(0, 4).join("; "));
    await page.screenshot({ path: `${shots}/mobile-${width}-search-boston-stony-brook.png`, fullPage: true });
    for (const id of ["east-boston--new-york--flixbus", "east-portland--miami--amtrak", "east-boston--stony-brook--greyhound"]) {
      for (const kind of ["journey", "wallet"]) {
        await page.goto(`${base}/${kind}/${id}`);
        await page.waitForTimeout(700);
        const o = await noOverflow(page);
        const b = await unlabelledOrClipped(page);
        log("F1", `${width}px ${kind}/${id}: no overflow, controls named`, o <= 0 && b.length === 0, `overflow ${o}px ${b.slice(0, 3).join("; ")}`);
        if (kind === "journey") {
          // City names must not collide with the departure/arrival time beside them.
          const collisions = await page.evaluate(() => {
            const leaves = [...document.querySelectorAll("#main-content *")].filter((e) => e.children.length === 0 && e.offsetParent);
            const times = leaves.filter((e) => /^\d{1,2}:\d{2} [AP]M( · [A-Z][a-z]{2} \d+)?$/.test(e.textContent.trim()));
            const places = leaves.filter((e) => /^[A-Z][A-Za-z .,'-]{2,40}$/.test(e.textContent.trim()) && !/^(Depart|Arrive)$/.test(e.textContent.trim()));
            const out = [];
            // A long unbreakable word ("Washington,") can spill out of a narrow min-w-0 column into the time.
            for (const c of places) if (c.scrollWidth > c.clientWidth + 1) out.push(`"${c.textContent.trim()}" overflows its ${c.clientWidth}px column by ${c.scrollWidth - c.clientWidth}px`);
            for (const t of times) for (const c of places) {
              const a = t.getBoundingClientRect(), b = c.getBoundingClientRect();
              if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1)
                out.push(`"${c.textContent.trim()}" under "${t.textContent.trim()}"`);
            }
            return out;
          });
          log("F1", `${width}px journey/${id}: city names don't collide with times`, collisions.length === 0, collisions.join("; "));
        }
        if (id.includes("portland") && kind === "journey") {
          const visible = await page.getByText(/Oct 25/).first().isVisible().catch(() => false);
          log("F3", `${width}px overnight date visible on Journey`, visible);
        }
        await page.screenshot({ path: `${shots}/mobile-${width}-${kind}-${id}.png`, fullPage: true });
      }
    }
    await page.context().close();
  }

  // F2 keyboard-only search → filter → choose → wallet
  {
    page = await newPage();
    await page.goto(base + "/");
    await page.locator("#origin").focus();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("NYC");
    await page.keyboard.press("Tab");
    let onDest = await page.evaluate(() => document.activeElement?.id);
    if (onDest !== "destination") { await page.keyboard.press("Tab"); onDest = await page.evaluate(() => document.activeElement?.id); }
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.type("DC");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const status = flat(await page.locator(".results-heading [role=status]").innerText());
    log("F2", "Keyboard: type NYC → DC and Enter searches", /New York|NYC/.test(status) && /DC|Washington/.test(status) && /[1-9]\d* sample/.test(status), status);
    let reachedFilter = false;
    for (let i = 0; i < 40 && !reachedFilter; i++) {
      await page.keyboard.press("Tab");
      reachedFilter = await page.evaluate(() => document.activeElement?.textContent?.trim() === "Bus only");
    }
    log("F2", "Keyboard: Tab reaches 'Bus only'", reachedFilter);
    if (reachedFilter) {
      const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      await page.keyboard.press("Space");
      await page.waitForTimeout(150);
      log("F2", "Keyboard: Space applies the filter; focus ring visible", (await page.getByRole("button", { name: "Bus only", exact: true }).getAttribute("aria-pressed")) === "true" && ring !== "none", `outline ${ring}`);
    }
    let onChoose = false;
    for (let i = 0; i < 60 && !onChoose; i++) {
      await page.keyboard.press("Tab");
      onChoose = await page.evaluate(() => /^\/journey\/east-/.test(document.activeElement?.getAttribute("href") ?? ""));
    }
    log("F2", "Keyboard: Tab reaches an expanded 'Choose' link", onChoose);
    if (onChoose) {
      const href = await page.evaluate(() => document.activeElement.getAttribute("href"));
      await page.keyboard.press("Enter");
      await page.waitForURL("**" + href);
      const id = href.split("/").pop();
      await page.locator(`#main-content a[href="/wallet/${id}"]`).first().waitFor();
      let onWallet = false;
      for (let i = 0; i < 120 && !onWallet; i++) {
        await page.keyboard.press("Tab");
        onWallet = await page.evaluate((id) => document.activeElement?.getAttribute("href") === `/wallet/${id}`, id);
      }
      log("F2", "Keyboard: Tab reaches the Wallet link on an expanded Journey", onWallet);
    }
    await page.context().close();
  }

  await browser.close();
  log("F4", "No page or console errors", errors.length === 0, errors.slice(0, 4).join(" ; "));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} expansion checks passed`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
