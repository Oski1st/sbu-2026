// Starts the real production server with a failing or stalled upstream to check
// the SEPTA proxy's unavailable responses end to end. Usage: node qa/septa-proxy-outage.mjs
import { createAppServer } from "../server/index.mjs";

const scenarios = {
  "upstream HTTP 500": async () => new Response("oops", { status: 500 }),
  "network failure": async () => { throw new TypeError("fetch failed"); },
  "non-array JSON": async () => Response.json({ error: "x" }),
  "stalled upstream": (_url, { signal }) =>
    new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
  "valid empty feed": async () => Response.json([]),
};

let failed = 0;
for (const [name, fetchImpl] of Object.entries(scenarios)) {
  const server = createAppServer({ fetchImpl, timeoutMs: 300 });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  const res = await fetch(`http://127.0.0.1:${port}/api/transit/septa/trains`);
  const body = await res.text();
  server.close();
  const expected = name === "stalled upstream" ? 504 : name === "valid empty feed" ? 200 : 502;
  const ok = res.status === expected && res.headers.get("cache-control") === "no-store";
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${res.status} ${body} (expected ${expected}, no-store)`);
}
process.exit(failed ? 1 : 0);
