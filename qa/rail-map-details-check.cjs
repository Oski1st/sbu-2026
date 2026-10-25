// Rail map "Corridors, cities & coverage gaps" details: accessibility-tree link names (closed and open),
// bounded scroll panel, keyboard scrolling, and that opening it no longer pushes the trip search far down.
// Usage: node qa/rail-map-details-check.cjs <baseURL>
// e2e-check.cjs "buttons/links named" reads innerText, which is empty for links inside a CLOSED <details>;
// this script checks names through Chromium's accessibility tree instead.
// 41 links = 8 route pages + 26 station pages + 1 MTA (Stony Brook) + 3 operator-gap links + 3 dataset sources.
const { chromium } = require("playwright");
const base = process.argv[2] || "http://127.0.0.1:4181";
let pass = 0, fail = 0; const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`); };
(async () => {
  const b = await chromium.launch();
  for (const w of [1280, 768, 390, 375, 320]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 }, isMobile: w < 640, hasTouch: w < 640 });
    const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    await p.goto(base + "/"); await p.waitForSelector(".passenger-rail-map svg");
    const axLinks = async () => (await cdp.send("Accessibility.getFullAXTree")).nodes.filter((n) => !n.ignored && n.role?.value === "link" && /amtrak\.com|mta\.info|septa|njtransit|arcgis|naturalearth/.test(n.properties?.find((q) => q.name === "url")?.value?.value || ""));
    const searchTop = () => p.evaluate(() => document.querySelector("form, [role=search]")?.getBoundingClientRect().top + scrollY);
    const closedLinks = await axLinks(); const topClosed = await searchTop();
    check(`${w}px closed: map source links are not exposed while collapsed`, closedLinks.length === 0, `${closedLinks.length} exposed`);
    await p.locator(".passenger-rail-map summary").click(); await p.waitForTimeout(150);
    const open = await axLinks(); const unnamed = open.filter((n) => !(n.name?.value || "").trim());
    check(`${w}px open: every map link has an accessible name`, open.length === 41 && unnamed.length === 0, `${open.length} links, ${unnamed.length} unnamed; e.g. "${open[10]?.name?.value}"`);
    const m = await p.evaluate(() => { const c = document.querySelector(".prm-details-content"); return { h: c.clientHeight, sh: c.scrollHeight, vh: innerHeight, role: c.getAttribute("role"), label: c.getAttribute("aria-label"), overflow: document.documentElement.scrollWidth - innerWidth }; });
    const topOpen = await searchTop();
    check(`${w}px open: audit panel bounded (<= 24rem / 60vh) and scrollable; no page overflow`, m.h <= Math.min(384, m.vh * 0.6) + 1 && m.sh > m.h && m.overflow <= 0, `panel ${m.h}px of ${m.sh}px; overflow ${m.overflow}`);
    check(`${w}px open: trip search moves down by <= 450px`, topOpen - topClosed <= 450, `search form top ${Math.round(topClosed)} -> ${Math.round(topOpen)} (+${Math.round(topOpen - topClosed)})`);
    await p.locator(".prm-details-content").focus(); await p.keyboard.press("PageDown"); await p.waitForTimeout(250);
    const st = await p.evaluate(() => document.querySelector(".prm-details-content").scrollTop);
    check(`${w}px open: panel is a named region and scrolls by keyboard`, m.role === "region" && !!m.label && st > 0, `scrollTop after PageDown ${st}`);
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass}/${pass + fail} rail-map details checks passed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
