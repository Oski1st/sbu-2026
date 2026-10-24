import { afterEach, expect, test, vi } from 'vitest';
import { watchSnapshotExpiry } from './snapshotFreshness';

afterEach(() => vi.useRealTimers());

test('expires a feed after sixty seconds and stops after cleanup', () => {
  vi.useFakeTimers();
  const expire = vi.fn();
  const stop = watchSnapshotExpiry(new Date().toISOString(), expire, new EventTarget(), new EventTarget());
  vi.advanceTimersByTime(59999);
  expect(expire).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(expire).toHaveBeenCalledOnce();
  stop();
  const cancelled = vi.fn();
  const dispose = watchSnapshotExpiry(new Date().toISOString(), cancelled, new EventTarget(), new EventTarget());
  dispose();
  vi.advanceTimersByTime(60000);
  expect(cancelled).not.toHaveBeenCalled();
});

test.each(['focus', 'pageshow', 'visibilitychange'])('rechecks age on %s when background timers were delayed', event => {
  vi.useFakeTimers();
  const events = new EventTarget();
  const expire = vi.fn();
  const now = Date.now();
  const stop = watchSnapshotExpiry(new Date(now).toISOString(), expire, events, events);
  // Move the clock without firing timers, as happens during a suspended tab.
  vi.setSystemTime(now + 61000);
  events.dispatchEvent(new Event(event));
  expect(expire).toHaveBeenCalledOnce();
  events.dispatchEvent(new Event(event));
  expect(expire).toHaveBeenCalledOnce();
  stop();
});

test('an invalid retrieval time cannot remain live', () => {
  const expire = vi.fn();
  const stop = watchSnapshotExpiry('invalid', expire, new EventTarget(), new EventTarget());
  expect(expire).toHaveBeenCalledOnce();
  stop();
});
