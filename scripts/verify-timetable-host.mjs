import assert from "node:assert/strict";
import { once } from "node:events";
import { createAppServer } from "../server/index.mjs";
const server = createAppServer({
  fetchImpl: async () =>
    new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
const base = "http://127.0.0.1:" + server.address().port;
let checks = 0;
async function check(path, status, type, options = {}) {
  const r = await fetch(base + path, options);
  assert.equal(r.status, status, path);
  if (type) assert.ok(r.headers.get("content-type")?.includes(type), path);
  checks++;
  return r;
}
try {
  await check("/", 200, "text/html", { headers: { Accept: "text/html" } });
  await check("/demo", 200, "text/html", { headers: { Accept: "text/html" } });
  await check("/journey/regional-connection", 200, "text/html", {
    headers: { Accept: "text/html" },
  });
  await check("/wallet/amtrak-connection", 200, "text/html", {
    headers: { Accept: "text/html" },
  });
  const metadata = await (
    await check("/api/transit/catalogue", 200, "application/json")
  ).json();
  assert.equal(metadata.cities.length, 1371);
  checks++;
  const q =
    "/api/transit/plan?from=Boston%2C%20MA&to=Philadelphia%2C%20PA&date=2026-10-26&time=08%3A00";
  const body = await (await check(q, 200, "application/json")).json();
  assert.ok(body.itineraries.length);
  const trip = body.itineraries[0];
  assert.ok(trip.id.startsWith("tt1-"));
  checks++;
  await check("/itinerary/" + trip.id, 200, "text/html", {
    headers: { Accept: "text/html" },
  });
  const reconstructed = await (
    await check("/api/transit/itinerary/" + trip.id, 200, "application/json")
  ).json();
  assert.deepEqual(reconstructed.itinerary, trip);
  checks++;
  await check("/assets/missing.js", 404, "application/json");
  await check("/api/missing", 404, "application/json");
  await check("/api/transit/plan?from=A&from=B", 400, "application/json");
  await check("/api/transit/catalogue", 405, "application/json", {
    method: "POST",
  });
  await check("/api/transit/itinerary/invalid", 404, "application/json");
  await check("/api/transit/septa/trains", 200, "application/json");
  console.log(
    JSON.stringify({
      checks,
      base,
      version: body.version,
      firstArrival: trip.arrival,
      canonicalItinerary: "/itinerary/" + trip.id,
    }),
  );
  await new Promise((resolve) => server.close(resolve));
  if (process.argv.includes("--serve")) {
    // The smoke fixture is closed; the review preview uses the actual production host.
    const preview = createAppServer();
    preview.listen(0, "127.0.0.1");
    await once(preview, "listening");
    console.log("PREVIEW http://127.0.0.1:" + preview.address().port);
  }
} catch (error) {
  await new Promise((resolve) => server.close(resolve));
  throw error;
}
