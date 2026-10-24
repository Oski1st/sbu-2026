export const SEPTA_TRAINS_URL = 'https://api.septa.org/api/TrainView/index.php';

export interface SeptaTrain {
  trainNumber: string;
  line: string;
  destination: string;
  nextStop: string;
  delayMinutes: number | null;
}

export type SeptaResult =
  | { status: 'live'; trains: SeptaTrain[]; fetchedAt: string; source: string }
  | { status: 'unavailable'; reason: string; source: string };

/** Agency-wide observations only. Never infer a journey's train, departure, or ticket validity. */
export function parseSeptaTrains(payload: unknown): SeptaTrain[] {
  if (!Array.isArray(payload)) throw new Error('Unexpected SEPTA response');
  return payload.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('Invalid train');
    const item = row as Record<string, unknown>;
    if (['trainno', 'line', 'dest', 'nextstop'].some(key => typeof item[key] !== 'string' || !item[key])) {
      throw new Error('Missing train fields');
    }
    const delay = typeof item.late === 'number' ? item.late :
      typeof item.late === 'string' && /^\d+$/.test(item.late) ? Number(item.late) : null;
    return {
      trainNumber: item.trainno as string, line: item.line as string,
      destination: item.dest as string, nextStop: item.nextstop as string,
      delayMinutes: delay !== null && Number.isFinite(delay) && delay >= 0 ? delay : null,
    };
  });
}

export async function fetchSeptaTrains(options: { signal?: AbortSignal; endpoint?: string } = {}): Promise<SeptaResult> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 6000);
  try {
    const response = await fetch(options.endpoint ?? SEPTA_TRAINS_URL, {
      signal: controller.signal, credentials: 'omit', cache: 'no-store',
    });
    if (!response.ok) throw new Error('Feed unavailable');
    const trains = parseSeptaTrains(await response.json());
    return { status: 'live', trains, fetchedAt: new Date().toISOString(), source: SEPTA_TRAINS_URL };
  } catch {
    return {
      status: 'unavailable', source: SEPTA_TRAINS_URL,
      reason: 'Live SEPTA data is unavailable. Check the agency for current service; your demo itinerary has not been updated.',
    };
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
  }
}
