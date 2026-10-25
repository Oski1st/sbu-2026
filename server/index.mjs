import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createTimetableApi } from "./timetable-api.mjs";
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
};

/** Small production host for dist/ and the same-origin API. Bind publicly via HOST. */
export function createAppServer({ distDir = root, fetchImpl, timeoutMs } = {}) {
  const timetable = createTimetableApi();
  const proxy = createSeptaProxy({ fetchImpl, timeoutMs });
  return createServer((req, res) => {
    void timetable(req, res, () => proxy(req, res, () => {
      void serveStatic(req, res, distDir);
    })).catch(() => sendJson(res, 500, { error: "internal_error" }));
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
      extension = extname(path);
    try {
      data = await readFile(
        path === absoluteRoot ? resolve(absoluteRoot, "index.html") : path,
      );
      if (path === absoluteRoot) extension = ".html";
    } catch (error) {
      if (!["ENOENT", "ENOTDIR", "EISDIR"].includes(error.code)) throw error;
      // Only document requests receive the SPA fallback; broken assets/API calls stay errors.
      if (
        extension ||
        !req.headers.accept?.includes("text/html") ||
        pathname.split("/").some((part) => part.startsWith(".") && part !== "")
      ) {
        return sendJson(res, 404, { error: "not_found" });
      }
      data = await readFile(resolve(absoluteRoot, "index.html"));
      extension = ".html";
    }
    res.writeHead(200, {
      "Content-Type": mime[extension] ?? "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
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
  createAppServer().listen(port, host, () =>
    console.log(`OneLine listening at http://${host}:${port}`),
  );
}
