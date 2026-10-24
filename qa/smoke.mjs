// Post-deploy smoke test. Usage: node qa/smoke.mjs https://your-host.example
const base = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const html = { accept: "text/html" };
const checks = [
  ["home", "/", html, (r) => r.status === 200],
  ["Journey deep link", "/journey/regional-connection", html, (r) => r.status === 200],
  ["Wallet deep link", "/wallet/amtrak-connection", html, (r) => r.status === 200],
  ["unknown route still serves the SPA", "/does-not-exist", html, (r) => r.status === 200],
  ["missing asset is 404", "/assets/missing.js", {}, (r) => r.status === 404],
  ["SEPTA proxy reachable (200 live, 502/504 unavailable)", "/api/transit/septa/trains", {},
    (r) => [200, 502, 504].includes(r.status) && r.headers.get("cache-control") === "no-store"],
];
let failed = 0;
for (const [name, path, headers, ok] of checks) {
  try {
    const r = await fetch(base + path, { headers });
    const pass = ok(r);
    const extra = path.startsWith("/api/") ? ` ${(await r.text()).slice(0, 60)}` : "";
    if (!pass) failed++;
    console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${r.status}${extra}`);
  } catch (e) {
    failed++;
    console.log(`FAIL ${name}: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
