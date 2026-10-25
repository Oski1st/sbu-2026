const { chromium } = require("playwright");
const fs = require("node:fs");
const [cand, base, shots] = process.argv.slice(2); fs.mkdirSync(shots, { recursive: true });
let pass = 0, fail = 0; const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"} ${n}${d ? " — " + d : ""}`); };
const NOTE = "Sample itinerary times in Eastern Time";
async function layout(url, w, tag) {
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: w, height: 900 }, isMobile: w < 640, hasTouch: w < 640 })).newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(url + "/journey/east-washington--orlando--amtrak"); await p.waitForSelector("#timeline-title");
  const r = await p.evaluate((note) => {
    const h = document.querySelector("#timeline-title"); const box = h.parentElement.parentElement;
    const ps = [...box.querySelectorAll(":scope > p")]; const n = ps[ps.length - 1];
    const hb = h.parentElement.getBoundingClientRect(), nb = n.getBoundingClientRect();
    const overlap = !(nb.left >= hb.right || nb.right <= hb.left || nb.top >= hb.bottom || nb.bottom <= hb.top);
    return { text: n.textContent.trim(), font: parseFloat(getComputedStyle(n).fontSize), color: getComputedStyle(n).color, overlap,
      stacked: nb.top >= hb.bottom - 1, noteInViewport: nb.left >= 0 && nb.right <= innerWidth, lines: Math.round(nb.height / parseFloat(getComputedStyle(n).lineHeight || 16)),
      overflow: document.documentElement.scrollWidth > innerWidth };
  }, NOTE);
  await p.locator("#timeline-title").locator("xpath=../..").screenshot({ path: `${shots}/p4-30-${tag}-${w}.png` });
  await b.close(); return { ...r, errs };
}
async function times(url, id, simulate) {
  const b = await chromium.launch(); const p = await (await b.newContext()).newPage();
  await p.goto(`${url}/journey/${id}`); await p.waitForSelector("article time");
  if (simulate) await p.getByRole("button", { name: "Simulate delay" }).click();
  const t = await p.$$eval("article time", (ts) => ts.map((t) => [t.getAttribute("datetime"), t.textContent, t.getAttribute("aria-label")]));
  await b.close(); return t;
}
(async () => {
  for (const w of [320, 375, 390, 640, 1280]) {
    const c = await layout(cand, w, "cand"); await layout(base, w, "base");
    check(`${w}px: note reads "${NOTE}"`, c.text === NOTE, c.text);
    check(`${w}px: note does not overlap the heading block; inside viewport; no page overflow`, !c.overlap && c.noteInViewport && !c.overflow, JSON.stringify({ overlap: c.overlap, inVp: c.noteInViewport, overflow: c.overflow }));
    check(`${w}px: layout ${w < 640 ? "stacked below heading" : "side by side"}`, w < 640 ? c.stacked : !c.stacked, `stacked=${c.stacked}`);
    check(`${w}px: note font ${c.font}px ≥ 12, no page errors`, c.font >= 12 && c.errs.length === 0, `${c.font}px ${c.color}`);
  }
  for (const [id, sim] of [["regional-connection", false], ["regional-connection", true], ["east-washington--orlando--amtrak", false], ["east-washington--orlando--amtrak", true]]) {
    const a = await times(cand, id, sim), b2 = await times(base, id, sim);
    check(`timeline <time> values identical to base: ${id}${sim ? " (simulated delay)" : ""}`, JSON.stringify(a) === JSON.stringify(b2), `${a.length} times; e.g. ${JSON.stringify(a[1])}`);
  }
  console.log(`\n${pass}/${pass + fail} P4-30 checks passed`); process.exit(fail ? 1 : 0);
})();
