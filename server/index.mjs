import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);
import { createSeptaProxy, sendJson } from "./septa-proxy.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist");
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};
const compressible = new Set([".html", ".js", ".css", ".svg", ".json", ".txt", ".webmanifest"]);

/**
 * Conservative, self-only policy: scripts and network requests (including the same-origin SEPTA
 * proxy) are limited to this origin. data: covers the inline SVG favicon. External links still
 * work because top-level navigation is not governed by CSP. Clipboard (Share) is left allowed.
 */
export const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=(), payment=(), usb=()",
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    // JourneyPage renders an inline <style> keyframe block; a hash would break on every edit.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
};

// Compressed bodies are cached in memory by content hash, so a rebuilt dist/ is never served
// stale. Compression runs on the libuv thread pool, so it never blocks other requests.
const encodedCache = new Map();
function encode(data, encoding) {
  const key = `${encoding}:${createHash("sha1").update(data).digest("hex")}`;
  let body = encodedCache.get(key);
  if (!body) {
    if (encodedCache.size > 256) encodedCache.clear();
    body =
      encoding === "br"
        ? brotli(data, {
            params: {
              [constants.BROTLI_PARAM_QUALITY]: 11,
              [constants.BROTLI_PARAM_SIZE_HINT]: data.length,
            },
          })
        : gz(data, { level: 9 });
    body.catch(() => encodedCache.delete(key));
    encodedCache.set(key, body);
  }
  return body;
}

/** Pre-compresses text assets so the first visitor after a cold start gets cached bodies. */
export async function warmCompressionCache(distDir = root) {
  const entries = await readdir(distDir, { recursive: true, withFileTypes: true });
  await Promise.all(
    entries
      .filter((entry) => entry.isFile() && compressible.has(extname(entry.name)))
      .map(async (entry) => {
        const file = resolve(entry.parentPath, entry.name);
        const data = await readFile(file);
        if (data.length <= 1024) return;
        await Promise.all([encode(data, "br"), encode(data, "gzip")]);
      }),
  );
}
function pickEncoding(acceptEncoding = "") {
  const accepted = acceptEncoding
    .split(",")
    .map((part) => part.trim().split(";"))
    .filter(([, q]) => !q || Number(q.split("=")[1]) > 0)
    .map(([name]) => name.toLowerCase());
  if (accepted.includes("br")) return "br";
  if (accepted.includes("gzip")) return "gzip";
  return undefined;
}

/** Small production host for dist/ and the same-origin API. Bind publicly via HOST. */
export function createAppServer({ distDir = root, fetchImpl, timeoutMs } = {}) {
  const proxy = createSeptaProxy({ fetchImpl, timeoutMs });
  return createServer((req, res) => {
    void proxy(req, res, () => {
      void serveStatic(req, res, distDir);
    }).catch(() => sendJson(res, 500, { error: "internal_error" }));
  });
}

async function serveStatic(req, res, distDir) {
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname.startsWith("/api/"))
      return sendJson(res, 404, { error: "not_found" });
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.setHeader("Allow", "GET, HEAD");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return sendJson(res, 400, { error: "invalid_path" });
    }
    if (pathname.split("/").some((part) => part.startsWith(".") && part !== ""))
      return sendJson(res, 404, { error: "not_found" });
    const absoluteRoot = resolve(distDir);
    const path = resolve(absoluteRoot, "." + pathname);
    if (!path.startsWith(absoluteRoot + sep) && path !== absoluteRoot)
      return sendJson(res, 404, { error: "not_found" });
    let data,
      filePath = path === absoluteRoot ? resolve(absoluteRoot, "index.html") : path,
      extension = extname(path);
    try {
      data = await readFile(filePath);
      if (path === absoluteRoot) extension = ".html";
    } catch (error) {
      // ENAMETOOLONG: an over-long deep link (e.g. /wallet/<2000 chars>) is just a missing file.
      if (!["ENOENT", "ENOTDIR", "EISDIR", "ENAMETOOLONG"].includes(error.code))
        throw error;
      // Only document requests receive the SPA fallback; broken assets/API calls stay errors.
      if (
        extension ||
        !req.headers.accept?.includes("text/html") ||
        pathname.split("/").some((part) => part.startsWith(".") && part !== "")
      ) {
        return sendJson(res, 404, { error: "not_found" });
      }
      filePath = resolve(absoluteRoot, "index.html");
      data = await readFile(filePath);
      extension = ".html";
    }
    const headers = {
      ...securityHeaders,
      "Content-Type": mime[extension] ?? "application/octet-stream",
      // Vite content-hashes everything under /assets/, so those never change for a given URL.
      // Documents and unhashed files (robots.txt) revalidate so a deploy is picked up at once.
      "Cache-Control": filePath.startsWith(resolve(absoluteRoot, "assets") + sep)
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    };
    if (compressible.has(extension) && data.length > 1024) {
      headers.Vary = "Accept-Encoding";
      const encoding = pickEncoding(req.headers["accept-encoding"]);
      if (encoding) {
        data = await encode(data, encoding);
        headers["Content-Encoding"] = encoding;
      }
    }
    headers["Content-Length"] = data.length;
    res.writeHead(200, headers);
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    sendJson(res, 500, { error: "server_unavailable" });
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PORT ?? 3000);
  const host = process.env.HOST ?? "127.0.0.1";
  createAppServer().listen(port, host, () => {
    console.log(`OneLine listening at http://${host}:${port}`);
    warmCompressionCache().catch(() => {});
  });
}
