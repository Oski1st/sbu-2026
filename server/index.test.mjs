import { afterEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { request } from "node:http";
import { createAppServer } from "./index.mjs";

const cleanups = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
});

async function start() {
  const dir = await mkdtemp(join(tmpdir(), "oneline-static-"));
  await mkdir(join(dir, "assets"));
  await writeFile(join(dir, "index.html"), `<!doctype html><title>OneLine</title>${" ".repeat(2048)}`);
  await writeFile(join(dir, "assets", "index-abc123.js"), `console.log(${JSON.stringify("x".repeat(4096))});`);
  await writeFile(join(dir, "robots.txt"), "User-agent: *\nAllow: /\n");
  const server = createAppServer({ distDir: dir });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  cleanups.push(async () => {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
    await rm(dir, { recursive: true, force: true });
  });
  return server.address().port;
}

/** Raw request so the test sees the encoded bytes (fetch would transparently decode them). */
function get(port, path, headers = {}) {
  return new Promise((resolve, reject) => {
    request({ host: "127.0.0.1", port, path, headers }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    })
      .on("error", reject)
      .end();
  });
}

describe("production static host", () => {
  it("caches hashed assets for a year and revalidates documents", async () => {
    const port = await start();
    const asset = await get(port, "/assets/index-abc123.js");
    expect(asset.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    const page = await get(port, "/journey/regional-connection", { accept: "text/html" });
    expect(page.status).toBe(200);
    expect(page.headers["cache-control"]).toBe("no-cache");
    const robots = await get(port, "/robots.txt");
    expect(robots.headers["content-type"]).toBe("text/plain; charset=utf-8");
    expect(robots.headers["cache-control"]).toBe("no-cache");
  });

  it("compresses text with brotli or gzip only when the client accepts it", async () => {
    const port = await start();
    const plain = await get(port, "/assets/index-abc123.js");
    expect(plain.headers["content-encoding"]).toBeUndefined();
    expect(plain.headers.vary).toBe("Accept-Encoding");
    const br = await get(port, "/assets/index-abc123.js", { "accept-encoding": "gzip, deflate, br" });
    expect(br.headers["content-encoding"]).toBe("br");
    expect(Number(br.headers["content-length"])).toBe(br.body.length);
    expect(brotliDecompressSync(br.body).equals(plain.body)).toBe(true);
    const gzip = await get(port, "/", { "accept-encoding": "gzip" });
    expect(gzip.headers["content-encoding"]).toBe("gzip");
    const refused = await get(port, "/", { "accept-encoding": "br;q=0" });
    expect(refused.headers["content-encoding"]).toBeUndefined();
  });

  it("sends security headers that allow only same-origin scripts and requests", async () => {
    const port = await start();
    const page = await get(port, "/", { accept: "text/html" });
    expect(page.headers["x-content-type-options"]).toBe("nosniff");
    expect(page.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(page.headers["permissions-policy"]).toContain("geolocation=()");
    const csp = page.headers["content-security-policy"];
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("img-src 'self' data:");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it("serves the SPA for over-long deep links instead of a server error", async () => {
    const port = await start();
    const page = await get(port, `/wallet/${"x".repeat(2000)}`, { accept: "text/html" });
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toBe("text/html; charset=utf-8");
  });
});
