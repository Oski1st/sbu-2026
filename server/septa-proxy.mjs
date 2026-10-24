/** Fixed-upstream, same-origin SEPTA TrainView bridge. No client URL or credentials. */
export const SEPTA_PATH = "/api/transit/septa/trains";
export const SEPTA_UPSTREAM = "https://api.septa.org/api/TrainView/index.php";
const MAX_BYTES = 1024 * 1024;

export function sendJson(res, status, value) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(value));
}

async function readBoundedJson(response) {
  if (Number(response.headers.get("content-length")) > MAX_BYTES) {
    await response.body?.cancel();
    throw new Error("oversize");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("missing_body");
  let size = 0;
  const chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error("oversize");
      chunks.push(value);
    }
  } finally {
    // Cancel also stops an oversized response without buffering the remaining body.
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const data = JSON.parse(new TextDecoder().decode(bytes));
  // Record-level validation remains in Person 3's adapter.
  if (!Array.isArray(data)) throw new Error("invalid_shape");
  return data;
}

export function createSeptaProxy({
  fetchImpl = globalThis.fetch,
  timeoutMs = 4500,
} = {}) {
  return async function septaProxy(req, res, next) {
    let url;
    try {
      url = new URL(req.url ?? "/", "http://localhost");
    } catch {
      return sendJson(res, 400, { error: "invalid_path" });
    }
    if (url.pathname !== SEPTA_PATH) return next();
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return sendJson(res, 405, { error: "method_not_allowed" });
    }
    if (url.search)
      return sendJson(res, 400, { error: "query_parameters_not_supported" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    const disconnect = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on("close", disconnect);
    try {
      const response = await fetchImpl(SEPTA_UPSTREAM, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
        redirect: "error",
        credentials: "omit",
        cache: "no-store",
      });
      if (!response.ok) {
        await response.body?.cancel();
        return sendJson(res, 502, { error: "septa_unavailable" });
      }
      const data = await readBoundedJson(response);
      return sendJson(res, 200, data);
    } catch {
      return sendJson(res, controller.signal.aborted ? 504 : 502, {
        error: controller.signal.aborted
          ? "septa_timeout"
          : "septa_unavailable",
      });
    } finally {
      clearTimeout(timer);
      res.off("close", disconnect);
    }
  };
}
