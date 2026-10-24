// Walk the docs/demo-script.md click path and time each step.
// Usage: node qa/demo-rehearsal.cjs <baseURL> [--offline]
// --offline blocks the SEPTA proxy in the browser to rehearse the "Live data unavailable" fallback.
const { chromium } = require("playwright");
const base = process.argv[2] ?? "http://127.0.0.1:4173";
const offline = process.argv.includes("--offline");
let failed = 0;
const step = async (name, fn) => {
  const start = Date.now();
  try {
    const detail = await fn();
    console.log(`PASS ${name} (${Date.now() - start} ms)${detail ? " — " + detail : ""}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name} — ${e.message.split("\n")[0]}`);
  }
};

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  if (offline) await page.route("**/api/transit/septa/trains", (r) => r.abort());
  const started = Date.now();

  await step("0:00 Search loads with both route cards", async () => {
    await page.goto(base + "/");
    const n = await page.locator(".compare-route-check input[type=checkbox]").count();
    if (n !== 2) throw new Error(`${n} compare checkboxes`);
  });
  await step("0:15 Compare both routes", async () => {
    const checks = page.locator(".compare-route-check input[type=checkbox]");
    await checks.nth(0).check();
    await checks.nth(1).check();
    await page.locator(".compare-tray-action").click();
    const insight = await page.locator("dialog[open] .comparison-insight").innerText();
    return insight.replace(/\s+/g, " ").trim();
  });
  await step("0:40 Choose route → Journey", async () => {
    await page.locator('dialog[open] a.select-route[href="/journey/regional-connection"]').click();
    await page.locator('#main-content a[href="/wallet/regional-connection"]').first().waitFor();
  });
  await step("0:50 Simulate delay shows a recovery plan", async () => {
    await page.getByRole("button", { name: "Simulate delay" }).first().click();
    await page.getByRole("button", { name: "Reset simulation" }).first().waitFor();
    const text = await page.locator("#main-content").innerText();
    if (!/demo scenario|simulat/i.test(text)) throw new Error("delay not labelled as a simulation");
  });
  await step("1:10 View ticket wallet", async () => {
    await page.locator('#main-content a[href="/wallet/regional-connection"]').first().click();
    await page.waitForURL("**/wallet/regional-connection");
    await page.locator(".ol-ticket-list > li").first().waitFor();
  });
  await step("1:20 Tick the first checklist item", async () => {
    await page.locator(".ol-ticket-list input[type=checkbox]").first().check();
    return `progress ${await page.locator("progress").getAttribute("value")}`;
  });
  await step("1:30 SEPTA panel settles", async () => {
    await page.waitForFunction(
      () => !/Checking the official SEPTA feed|Refreshing SEPTA observations/.test(document.querySelector(".ol-live")?.textContent ?? "Checking the official SEPTA feed"),
      null,
      { timeout: 10000 },
    );
    const text = (await page.locator(".ol-live").innerText()).replace(/\s+/g, " ");
    const state = /Live data unavailable|observations unavailable/.test(text) ? "unavailable"
      : /no active trains/.test(text) ? "empty" : /Live feed fetched|observations retrieved/.test(text) ? "live" : "unknown";
    if (state === "unknown" || (offline && state !== "unavailable")) throw new Error(`state ${state}`);
    return state;
  });
  await step("1:45 Refresh keeps the deep link", async () => {
    await page.reload();
    await page.locator(".ol-ticket-list > li").first().waitFor();
  });

  await browser.close();
  console.log(`\nClick path ${((Date.now() - started) / 1000).toFixed(1)} s (excludes talking). ${failed ? failed + " step(s) failed" : "All steps passed"}${offline ? " [offline SEPTA]" : ""}`);
  process.exitCode = failed ? 1 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
