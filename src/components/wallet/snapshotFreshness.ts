/** Expire observations by elapsed time, including after background timer throttling. */
export function watchSnapshotExpiry(
  fetchedAt: string,
  onExpire: () => void,
  windowEvents: EventTarget = window,
  documentEvents: EventTarget = document,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  const stop = () => {
    active = false;
    clearTimeout(timer);
    windowEvents.removeEventListener('focus', check);
    windowEvents.removeEventListener('pageshow', check);
    documentEvents.removeEventListener('visibilitychange', check);
  };
  const check = () => {
    if (!active) return;
    clearTimeout(timer);
    const remaining = Date.parse(fetchedAt) + 60000 - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      stop();
      onExpire();
    } else timer = setTimeout(check, remaining);
  };
  windowEvents.addEventListener('focus', check);
  windowEvents.addEventListener('pageshow', check);
  documentEvents.addEventListener('visibilitychange', check);
  check();
  return stop;
}
