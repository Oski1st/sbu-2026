import { expect, test } from 'vitest';
import { fetchSeptaTrains, parseSeptaTrains } from './septa';

const train = { trainno: 'test-only', line: 'Test line', dest: 'Test destination', nextstop: 'Test stop', late: 2 };

test('validates data and preserves unknown delays without inventing a value', () => {
  expect(parseSeptaTrains([train])[0].delayMinutes).toBe(2);
  expect(parseSeptaTrains([{ ...train, late: 'unknown' }])[0].delayMinutes).toBe(null);
  expect(parseSeptaTrains([{ ...train, late: '' }])[0].delayMinutes).toBe(null);
  expect(parseSeptaTrains([{ ...train, late: 999 }])[0].delayMinutes).toBe(null);
  expect(parseSeptaTrains([{ ...train, late: '999' }])[0].delayMinutes).toBe(null);
  expect(parseSeptaTrains([])).toEqual([]);
  expect(() => parseSeptaTrains({ error: 'no access' })).toThrow();
  expect(() => parseSeptaTrains([{ line: 'missing required fields' }])).toThrow();
});

test('successful fetch returns timestamped observations, never itinerary departures', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify([train]));
    const result = await fetchSeptaTrains();
    expect(result.status).toBe('live');
    if (result.status === 'live') {
      expect(Number.isFinite(Date.parse(result.fetchedAt))).toBeTruthy();
      expect(result.trains[0].trainNumber).toBe('test-only');
      expect('departure' in result.trains[0]).toBe(false);
    }
    globalThis.fetch = async () => new Response('[]');
    const empty = await fetchSeptaTrains();
    expect(empty.status).toBe('live');
    if (empty.status === 'live') expect(empty.trains).toEqual([]);
  } finally { globalThis.fetch = original; }
});

test('HTTP, invalid JSON, malformed payload, and network failures are unavailable', async () => {
  const original = globalThis.fetch;
  try {
    for (const replacement of [
      async () => new Response('denied', { status: 403 }),
      async () => new Response('<html>not JSON</html>'),
      async () => new Response('{"error":"credentials required"}'),
      async () => { throw new TypeError('Failed to fetch'); },
    ]) {
      globalThis.fetch = replacement;
      const result = await fetchSeptaTrains();
      expect(result.status).toBe('unavailable');
      expect('trains' in result).toBe(false);
    }
  } finally { globalThis.fetch = original; }
});

test('passes cancellation to fetch and safely returns unavailable', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => {
      expect(options?.signal?.aborted).toBe(true);
      throw new DOMException('Aborted', 'AbortError');
    };
    const controller = new AbortController(); controller.abort();
    expect((await fetchSeptaTrains({ signal: controller.signal })).status).toBe('unavailable');
  } finally { globalThis.fetch = original; }
});

test('uses the supplied same-origin endpoint with no cache or credentials', async () => {
  const original = globalThis.fetch;
  try {
    let requested: string | undefined;
    globalThis.fetch = async (url, options) => {
      requested = String(url);
      expect(options?.credentials).toBe('omit');
      expect(options?.cache).toBe('no-store');
      return new Response('[]');
    };
    expect((await fetchSeptaTrains({ endpoint: '/api/transit/septa/trains' })).status).toBe('live');
    expect(requested).toBe('/api/transit/septa/trains');
  } finally { globalThis.fetch = original; }
});

test('a stalled request times out instead of keeping the wallet loading', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, options) => new Promise<Response>((_resolve, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    expect((await fetchSeptaTrains()).status).toBe('unavailable');
  } finally { globalThis.fetch = original; }
}, 8000);
