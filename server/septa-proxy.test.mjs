import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAppServer } from "./index.mjs";
import { SEPTA_UPSTREAM } from "./septa-proxy.mjs";
const cleanups = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});
async function start(options) {
  const server = createAppServer(options);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}
const endpoint = "/api/transit/septa/trains";
describe("same-origin SEPTA proxy", () => {
  it("returns the unchanged official array and never forwards browser credentials", async () => {
    const rows = [
      { trainno: "123", line: "Trenton", nextstop: "30th Street", late: 2 },
    ];
    const upstream = vi.fn(async () => Response.json(rows));
    const base = await start({ fetchImpl: upstream });
    const response = await fetch(base + endpoint, {
      headers: {
        Cookie: "private=session",
        Authorization: "Bearer local-only",
      },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(rows);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    const [url, options] = upstream.mock.calls[0];
    expect(url).toBe(SEPTA_UPSTREAM);
    expect(options.headers).toEqual({ Accept: "application/json" });
    expect(options.credentials).toBe("omit");
    expect(options.redirect).toBe("error");
  });
  it("preserves an empty valid feed rather than manufacturing trains", async () => {
    const base = await start({ fetchImpl: async () => Response.json([]) });
    const response = await fetch(base + endpoint);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });
  it("rejects arbitrary URL parameters and writes without fetching", async () => {
    const upstream = vi.fn();
    const base = await start({ fetchImpl: upstream });
    const query = await fetch(base + endpoint + "?url=https://example.com");
    expect(query.status).toBe(400);
    const post = await fetch(base + endpoint, { method: "POST" });
    expect(post.status).toBe(405);
    expect(post.headers.get("allow")).toBe("GET");
    expect(upstream).not.toHaveBeenCalled();
  });
  it.each([
    [
      "HTTP failure",
      () => new Response("upstream internal details", { status: 503 }),
    ],
    ["bad JSON", () => new Response("<html>Unavailable</html>")],
    ["wrong shape", () => Response.json({ error: "offline" })],
    ["oversized body", () => new Response("x".repeat(1024 * 1024 + 1))],
    [
      "network failure",
      () => {
        throw new Error("private network details");
      },
    ],
  ])("returns a safe unavailable response on %s", async (_label, result) => {
    const base = await start({ fetchImpl: async () => result() });
    const response = await fetch(base + endpoint);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "septa_unavailable" });
  });
  it("aborts slow requests before the wallet timeout", async () => {
    const upstream = vi.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const base = await start({ fetchImpl: upstream, timeoutMs: 25 });
    const response = await fetch(base + endpoint);
    expect(response.status).toBe(504);
    expect(await response.json()).toEqual({ error: "septa_timeout" });
    expect(upstream.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it("serves SPA deep links but does not mask unknown APIs or missing assets", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oneline-proxy-test-"));
    cleanups.push(() => rm(dir, { recursive: true, force: true }));
    await writeFile(
      join(dir, "index.html"),
      "<!doctype html><title>OneLine test</title>",
    );
    const base = await start({ distDir: dir });
    for (const route of [
      "/",
      "/wallet/regional-connection",
      "/journey/amtrak-connection",
    ]) {
      const response = await fetch(base + route, {
        headers: { Accept: "text/html" },
      });
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");
    }
    for (const route of [
      "/api/unknown",
      "/missing.js",
      "/%2e%2e%2fpackage.json",
    ]) {
      expect(
        (await fetch(base + route, { headers: { Accept: "text/html" } }))
          .status,
      ).toBe(404);
    }
  });
});
