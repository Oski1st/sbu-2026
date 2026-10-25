// P4-42: browser checks for PR #42 fix/newtab-links (new-tab link accessible names).
// Usage: node qa/p4-42-newtab-links-check.cjs <candUrl> <baseUrl> [shotsDir]
// Lists every a[target=_blank] on Search (route cards expanded + map details open), Journey (segment details
// expanded), Wallet and the /wallet integration fallback; reads each accessible name from the CDP AX tree;
// compares visible text with the base build; checks the Floridian map note and 320/390 overflow.
const { chromium } = require("playwright");
const fs = require("node:fs");
const [cand, base, shots] = process.argv.slice(2);
if (shots) fs.mkdirSync(shots, { recursive: true });
let pass = 0, fail = 0;
const failures = [];
function check(name, ok, detail = "") {
  if (ok) pass++; else { fail++; failures.push(name); }
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`);
}
const PAGES = [
  { key: "search", path: "/" },
  { key: "journey-regional", path: "/journey/regional-connection" },
  { key: "journey-greyhound", path: "/journey/east-boston--stony-brook--greyhound" },
  { key: "wallet-regional", path: "/wallet/regional-connection" },
  { key: "wallet-integration", path: "/wallet" },
];

async function expandAll(p) {
  const closed = p.locator("button.detail-toggle[aria-expanded=false]");
  for (let i = 0; i < 50 && (await closed.count()); i++) await closed.first().click();
}

async function prepare(p, key) {
  if (key === "search") {
    await p.waitForSelector(".route-card", { timeout: 15000 }).catch(() => {});
    await expandAll(p);
    await p.locator(".passenger-rail-map details").evaluateAll((ds) => ds.forEach((d) => (d.open = true)));
  }
  if (key.startsWith("journey")) {
    await p.locator("#timeline-title").waitFor();
  }
  if (key.startsWith("wallet")) await p.locator("h1").first().waitFor({ timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(300);
}

async function collect(ctx, url, key) {
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: "networkidle" });
  await prepare(p, key);
  const cdp = await ctx.newCDPSession(p);
  if (!key.startsWith("journey")) { const r = await snapshot(cdp); await p.close(); return r; }
  // Journey segment details behave as an accordion: open each segment in turn and union the links.
  const seen = new Map();
  const toggles = p.locator("main article button[aria-expanded]");
  const n = await toggles.count();
  for (let i = 0; i < n; i++) {
    if ((await toggles.nth(i).getAttribute("aria-expanded")) !== "true") await toggles.nth(i).click();
    await p.waitForTimeout(150);
    // Segment ticket links are keyed per opened segment (two LIRR legs share an href); page-level links by href.
    for (const l of await snapshot(cdp)) seen.set(/^Get tickets/.test(l.visible) ? `seg${i}|${l.href}` : l.href, l);
  }
  await p.close();
  return [...seen.values()];
}

async function snapshot(cdp) {
  const { root } = await cdp.send("DOM.getDocument", { depth: -1 });
  const { nodeIds } = await cdp.send("DOM.querySelectorAll", { nodeId: root.nodeId, selector: "a[target=_blank]" });
  const out = [];
  for (const nodeId of nodeIds) {
    const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { nodeId, fetchRelatives: false });
    const ax = nodes.find((n) => !n.ignored) || nodes[0];
    const { object } = await cdp.send("DOM.resolveNode", { nodeId });
    const { result } = await cdp.send("Runtime.callFunctionOn", {
      objectId: object.objectId, returnByValue: true,
      functionDeclaration: `function () {
        const c = this.cloneNode(true); c.querySelectorAll(".sr-only,.prm-sr-only").forEach((e) => e.remove());
        const r = this.getBoundingClientRect();
        return { visible: c.textContent.replace(/\\s+/g, " ").trim(), href: this.getAttribute("href"), rendered: r.width > 0 && r.height > 0,
          inClosed: !!this.closest("details:not([open])") };
      }`,
    });
    // Links inside collapsed/inert segment details are not exposed (AX-ignored); only audit exposed links.
    if (nodes.every((n) => n.ignored)) continue;
    out.push({ ...result.value, name: (ax?.name?.value || "").replace(/\s+/g, " ").trim(), role: ax?.role?.value });
  }
  return out;
}

(async () => {
  const browser = await chromium.launch();
  const report = {};
  for (const pg of PAGES) {
    const ctxC = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const c = await collect(ctxC, cand + pg.path, pg.key);
    const b = await collect(ctxB, base + pg.path, pg.key);
    await ctxC.close(); await ctxB.close();
    report[pg.key] = { cand: c, base: b };
    console.log(`-- ${pg.key}: ${c.length} new-tab links (base ${b.length})`);
    check(`${pg.key}: has new-tab links`, c.length > 0 || pg.key === "wallet-integration", `${c.length}`);
    const missing = c.filter((l) => !/opens in a new tab/i.test(l.name));
    check(`${pg.key}: every new-tab link name includes 'opens in a new tab'`, missing.length === 0,
      missing.map((l) => `"${l.name}" -> ${l.href}`).slice(0, 6).join(" ; "));
    const nameNotStartingWithVisible = c.filter((l) => l.visible && !l.name.toLowerCase().startsWith(l.visible.replace(/\s*↗\s*$/, "").trim().toLowerCase().slice(0, 12)));
    check(`${pg.key}: accessible name starts with visible label (label-in-name)`, nameNotStartingWithVisible.length === 0,
      nameNotStartingWithVisible.map((l) => `visible="${l.visible}" name="${l.name}"`).slice(0, 4).join(" ; "));
    const vc = c.map((l) => l.visible).sort(), vb = b.map((l) => l.visible).sort();
    check(`${pg.key}: visible link text unchanged vs base`, JSON.stringify(vc) === JSON.stringify(vb),
      vc.filter((t, i) => t !== vb[i]).slice(0, 4).map((t, i) => `"${t}" vs "${vb[vc.indexOf(t)]}"`).join(" ; "));
    const byName = new Map();
    for (const l of c) { if (!byName.has(l.name)) byName.set(l.name, new Set()); byName.get(l.name).add(l.href); }
    const dupes = [...byName].filter(([, hrefs]) => hrefs.size > 1);
    check(`${pg.key}: no identical names pointing to different destinations`, dupes.length === 0,
      dupes.map(([n, h]) => `"${n}" x${h.size}`).slice(0, 4).join(" ; "));
    const allDupNames = c.length - new Set(c.map((l) => l.name)).size;
    console.log(`   duplicate names (same name, any href): ${allDupNames}`);
    const baseMissing = b.filter((l) => !/opens in a new tab/i.test(l.name)).length;
    console.log(`   base links lacking 'opens in a new tab': ${baseMissing}/${b.length}`);
  }

  // Floridian note + overflow
  for (const w of [320, 390, 1280]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
    const p = await ctx.newPage();
    await p.goto(cand + "/", { waitUntil: "networkidle" });
    await p.waitForSelector(".passenger-rail-map summary");
    await p.locator(".passenger-rail-map summary").first().click();
    await p.waitForTimeout(200);
    const note = p.getByText("The Floridian description names Chicago", { exact: false });
    const vis = (await note.count()) === 1 && (await note.isVisible());
    check(`Floridian note visible in open map details at ${w}`, vis);
    const ov = await p.evaluate(() => {
      const doc = document.documentElement.scrollWidth > window.innerWidth;
      const c = document.querySelector(".prm-details-content");
      const inner = c ? [...c.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.right > window.innerWidth + 1 || r.left < -1); }).map((e) => e.tagName + ":" + (e.textContent || "").slice(0, 30)) : [];
      return { doc, sw: document.documentElement.scrollWidth, inner: inner.slice(0, 4) };
    });
    check(`No horizontal overflow on Search with map details open at ${w}`, !ov.doc && ov.inner.length === 0, JSON.stringify(ov));
    if (shots) {
      await note.scrollIntoViewIfNeeded().catch(() => {});
      await p.screenshot({ path: `${shots}/p4-42-map-floridian-${w}.png` });
    }
    // expanded RouteCard overflow
    await expandAll(p);
    const ov2 = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`No horizontal overflow with route cards expanded at ${w}`, !ov2);
    if (shots && w !== 1280) {
      await p.locator(".route-card").first().scrollIntoViewIfNeeded();
      await p.locator(".route-card").first().screenshot({ path: `${shots}/p4-42-routecard-expanded-${w}.png` });
    }
    await ctx.close();
  }
  await browser.close();
  if (shots) fs.writeFileSync(`${shots}/p4-42-links.json`, JSON.stringify(report, null, 1));
  console.log(`\n${pass}/${pass + fail} P4-42 checks passed`);
  if (failures.length) console.log("FAILURES: " + failures.join(" ; "));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
