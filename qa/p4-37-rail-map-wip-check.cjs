// P4-37 (self-initiated WIP QA): CONUS passenger-rail map checkpoint checks (P4-36 protocol rows M1, M10-M14 in the browser).
// Usage: node qa/p4-37-rail-map-wip-check.cjs <baseURL> <shotsDir>
// fix/rail-map-polish: station markers are now <g class="prm-station"> (two zero-length paths) instead of <circle>; selector adapted.
const { chromium } = require("playwright");
const fs = require("node:fs");
const [base, shots] = [process.argv[2] || "http://127.0.0.1:4173", process.argv[3] || "p4-37-shots"];
fs.mkdirSync(shots, { recursive: true });
let pass = 0, fail = 0; const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`); };
(async () => {
  const b = await chromium.launch();
  for (const w of [1280, 390, 375, 320]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 640, hasTouch: w < 640 });
    const p = await ctx.newPage(); const ext = [], errs = [];
    p.on("request", (r) => { if (!r.url().startsWith(base)) ext.push(r.url()); });
    p.on("pageerror", (e) => errs.push(String(e))); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
    await p.goto(base + "/"); await p.waitForSelector(".passenger-rail-map svg");
    const m = await p.evaluate(() => {
      const root = document.querySelector(".passenger-rail-map"); const svg = root.querySelector("svg");
      const txt = root.innerText;
      const small = [...root.querySelectorAll("p, li, span, summary, small, figcaption, h2, h3")].filter((e) => e.getClientRects().length && e.innerText.trim() && !e.closest("details:not([open])")).map((e) => [parseFloat(getComputedStyle(e).fontSize), e.innerText.trim().slice(0, 30)]).filter(([s]) => s < 11);
      return { svgRole: svg.getAttribute("role"), labelledby: svg.getAttribute("aria-labelledby"), desc: svg.querySelector("desc")?.textContent || "",
        hasAKHI: /alaska|hawaii/i.test(root.textContent), insetFrames: root.querySelectorAll("[class*=inset]").length,
        routePaths: svg.querySelectorAll("[class*=route] path, path[class*=route]").length, statePaths: svg.querySelectorAll(".prm-states path").length,
        stationDots: svg.querySelectorAll(".prm-station").length, focusInSvg: svg.querySelectorAll("a,button,[tabindex]").length,
        small, overflow: document.documentElement.scrollWidth > innerWidth, svgW: svg.getBoundingClientRect().width,
        claims: /timetable|guarantee|partial/i.test(svg.querySelector("desc")?.textContent || ""), visibleText: txt.slice(0, 300) };
    });
    check(`${w}px M1: no Alaska/Hawaii insets or text`, !m.hasAKHI && m.insetFrames === 0, `insetFrames=${m.insetFrames}`);
    check(`${w}px M11: SVG role=img, labelled + described; no focusable elements inside`, m.svgRole === "img" && !!m.labelledby && m.desc.length > 50 && m.focusInSvg === 0, `focusables=${m.focusInSvg}`);
    check(`${w}px M14: description states partial / not a timetable / no guarantee`, m.claims, m.desc.slice(0, 120));
    check(`${w}px M12: visible map text ≥ 11px; no page overflow`, m.small.length === 0 && !m.overflow, JSON.stringify(m.small.slice(0, 3)) + ` svg ${Math.round(m.svgW)}px`);
    check(`${w}px M13: no runtime third-party requests; no page errors`, ext.length === 0 && errs.length === 0, `${ext.length} ext; ${errs.slice(0, 2).join(" | ")}`);
    if (w === 1280) {
      check("M1/M6 counts: 48 states + DC drawn; 26 station dots", m.statePaths === 49 && m.stationDots === 26, `states=${m.statePaths} dots=${m.stationDots} routePaths=${m.routePaths}`);
      // details: closed links not tabbable; open -> named & tabbable
      const cdp = await ctx.newCDPSession(p);
      const tabNames = async () => { await p.evaluate(() => { document.activeElement?.blur(); }); const seen = []; for (let i = 0; i < 70; i++) { await p.keyboard.press("Tab"); const a = await p.evaluate(() => { const e = document.activeElement; return e === document.body ? null : { tag: e.tagName, inMap: !!e.closest(".passenger-rail-map"), text: (e.textContent || "").trim().slice(0, 40) }; }); if (!a) break; seen.push(a); } return seen.filter((s) => s.inMap); };
      const closed = await tabNames();
      check("M11 closed details: only the summary is a Tab stop inside the map", closed.length === 1 && closed[0].tag === "SUMMARY", JSON.stringify(closed));
      await p.locator(".passenger-rail-map summary").focus(); await p.keyboard.press("Enter"); await p.waitForTimeout(200);
      const open = await p.evaluate(() => document.querySelector(".passenger-rail-map details").open);
      const { nodes } = await cdp.send("Accessibility.getFullAXTree");
      const axLinks = nodes.filter((n) => !n.ignored && n.role?.value === "link" && /official/.test(n.name?.value || ""));
      check("M11 Enter opens details; source links exposed with names in the accessibility tree", open && axLinks.length >= 8 && axLinks.every((n) => (n.name.value || "").trim().length > 5), `${axLinks.length} links, e.g. "${axLinks[0]?.name.value}"`);
      const gaps = await p.evaluate(() => document.querySelector(".passenger-rail-map details").innerText);
      check("M10: opened details list LIRR / SEPTA / NJ TRANSIT gaps and Stony Brook", /LIRR/.test(gaps) && /SEPTA/.test(gaps) && /NJ TRANSIT/i.test(gaps) && /Stony Brook/.test(gaps));
      const ext2 = []; p.on("request", (r) => { if (!r.url().startsWith(base)) ext2.push(r.url()); });
      await p.waitForTimeout(300);
      check("M13: opening details triggers no external request (links open only when clicked)", ext2.length === 0);
    }
    await p.locator(".passenger-rail-map").screenshot({ path: `${shots}/p4-37-rail-map-${w}.png` });
    await ctx.close();
  }
  await b.close();
  console.log(`\n${pass}/${pass + fail} P4-37 WIP checks passed`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
