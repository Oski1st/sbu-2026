// P4-14: canonical route IDs win over legacy ?trip= queries, in the real browser.
// Usage: node qa/p4-14-check.cjs <baseURL> <shotDir>
const { chromium } = require("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const shots = process.argv[3] ?? "qa-results/p4-14";
require("node:fs").mkdirSync(shots, { recursive: true });
const results = [];
const log = (name, ok, detail = "") => {
  results.push({ ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
};
const TRIPS = {
  "regional-connection": { legs: 4, septa: true, marker: /NJ TRANSIT/ },
  "amtrak-connection": { legs: 3, septa: false, marker: /amtrak/i },
  "east-boston--new-york--greyhound": { legs: 1, septa: false, marker: /Greyhound/ },
};

async function state(page) {
  return page.evaluate(() => {
    const header = document.querySelector("header") ?? document.body;
    const navHrefs = [...header.querySelectorAll('a[href^="/journey"], a[href^="/wallet"]')].map((a) => a.getAttribute("href"));
    const main = document.getElementById("main-content");
    return {
      path: location.pathname + location.search,
      navHrefs,
      text: main?.innerText ?? "",
      walletLinks: [...(main?.querySelectorAll('a[href^="/wallet/"]') ?? [])].map((a) => a.getAttribute("href")),
      legs: document.querySelectorAll(".ol-ticket-list > li").length,
      // Journey segments each have one expandable "View trip details" control.
      segments: main ? main.querySelectorAll("[aria-expanded]").length : 0,
      septa: !!document.getElementById("ol-live-heading"),
    };
  });
}
const settle = async (page) => { await page.waitForLoadState("networkidle").catch(() => {}); await page.waitForTimeout(500); };

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const fresh = async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${page.url()} ${e.message}`));
    page.on("console", (m) => m.type() === "error" && !m.location()?.url?.includes("/api/transit/septa/") && errors.push(`${page.url()} ${m.text()}`));
    return page;
  };

  // 1. Conflicting canonical path + legacy query: the path wins (content, header links, in-page links, refresh).
  for (const [canon, other] of [["regional-connection", "amtrak-connection"], ["amtrak-connection", "regional-connection"], ["east-boston--new-york--greyhound", "regional-connection"]]) {
    for (const kind of ["journey", "wallet"]) {
      const page = await fresh();
      const url = `/${kind}/${canon}?trip=${other}`;
      await page.goto(base + url);
      await settle(page);
      for (const phase of ["load", "refresh"]) {
        if (phase === "refresh") { await page.reload(); await settle(page); }
        const s = await state(page);
        const t = TRIPS[canon];
        const contentOk = kind === "wallet" ? s.legs === t.legs && s.septa === t.septa : s.segments === t.legs && t.marker.test(s.text) && !/not found/i.test(s.text);
        log(`${url} [${phase}]: shows ${canon} content`, contentOk, kind === "wallet" ? `${s.legs} legs, SEPTA panel ${s.septa}` : `${s.segments} segments`);
        const navOk = s.navHrefs.includes(`/journey/${canon}`) && s.navHrefs.includes(`/wallet/${canon}`) && !s.navHrefs.some((h) => h.includes(other));
        log(`${url} [${phase}]: header links stay on ${canon}`, navOk, s.navHrefs.join(", "));
        if (kind === "journey") log(`${url} [${phase}]: in-page Wallet link is ${canon}`, s.walletLinks.length > 0 && s.walletLinks.every((h) => h === `/wallet/${canon}`), s.walletLinks.join(", "));
      }
      if (kind === "journey") {
        await page.locator(`#main-content a[href="/wallet/${canon}"]`).first().click();
        await page.waitForURL(`**/wallet/${canon}`);
        await settle(page);
        const s = await state(page);
        log(`${url}: View ticket wallet opens the ${canon} Wallet`, s.legs === TRIPS[canon].legs, `${s.path}, ${s.legs} legs`);
      }
      if (canon === "regional-connection") await page.screenshot({ path: `${shots}/${kind}-canonical-wins.png` });
      await page.context().close();
    }
  }

  // 2. Legacy query on the entry route still works (redirects to the canonical path).
  for (const kind of ["journey", "wallet"]) {
    for (const id of ["amtrak-connection", "regional-connection"]) {
      const page = await fresh();
      await page.goto(`${base}/${kind}?trip=${id}`);
      await settle(page);
      const s = await state(page);
      const t = TRIPS[id];
      const contentOk = kind === "wallet" ? s.legs === t.legs : s.segments === t.legs && t.marker.test(s.text) && !/not found/i.test(s.text);
      log(`/${kind}?trip=${id}: legacy entry lands on /${kind}/${id}`, s.path.startsWith(`/${kind}/${id}`) && contentOk, s.path);
      log(`/${kind}?trip=${id}: header links follow ${id}`, s.navHrefs.includes(`/journey/${id}`) && s.navHrefs.includes(`/wallet/${id}`), s.navHrefs.join(", "));
      await page.context().close();
    }
  }

  // 3. Invalid canonical ID never silently substitutes the query trip.
  for (const kind of ["journey", "wallet"]) {
    for (const bad of ["bogus", "east-boston--atlantis--greyhound"]) {
      const page = await fresh();
      const url = `/${kind}/${bad}?trip=amtrak-connection`;
      await page.goto(base + url);
      await settle(page);
      for (const phase of ["load", "refresh"]) {
        if (phase === "refresh") { await page.reload(); await settle(page); }
        const s = await state(page);
        const noSubstitute = /not found/i.test(s.text) && s.legs === 0 && !s.navHrefs.some((h) => h.includes("amtrak-connection")) && !s.walletLinks.some((h) => h.includes("amtrak-connection"));
        log(`${url} [${phase}]: not found, no substitution`, noSubstitute, `${s.path} · nav ${s.navHrefs.join(", ")}`);
      }
      if (bad === "bogus") await page.screenshot({ path: `${shots}/${kind}-invalid-no-substitution.png` });
      await page.context().close();
    }
  }

  // 4. A stored selection never overrides the canonical path either.
  {
    const page = await fresh();
    // A selection is stored only when a route is chosen on Search (direct Journey URLs don't store one).
    await page.goto(`${base}/`);
    await page.locator('a.select-route[href="/journey/amtrak-connection"]').first().click();
    await page.waitForURL("**/journey/amtrak-connection");
    await settle(page);
    await page.goto(`${base}/journey/regional-connection`);
    await settle(page);
    const s = await state(page);
    log("Stored selection (amtrak) doesn't override /journey/regional-connection", TRIPS["regional-connection"].marker.test(s.text) && s.navHrefs.includes("/wallet/regional-connection"), s.navHrefs.join(", "));
    await page.goto(`${base}/wallet`);
    await settle(page);
    const w = await state(page);
    log("/wallet with no ID follows the stored selection (amtrak)", w.path.startsWith("/wallet/amtrak-connection") && w.legs === 3, w.path);
    await page.context().close();
  }

  await browser.close();
  log("No page or console errors", errors.length === 0, errors.slice(0, 4).join(" ; "));
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} P4-14 checks passed`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
