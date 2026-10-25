import { isPlanningDate, parsePlanningTime } from "../../data/searchState";

export type PlanningPreferences = { departureDate: string; departureTime: string };

/** Typing pauses this long before a changed Date or Time re-runs the search. */
export const PREFERENCE_DEBOUNCE_MS = 300;

/** Normalized preferences when the Date is in range (D1 guard) and the Time is complete; otherwise null. */
export function validPreferences(
  departureDate: string,
  departureTime: string,
  today?: string,
): PlanningPreferences | null {
  const time = parsePlanningTime(departureTime);
  return time && isPlanningDate(departureDate, today) ? { departureDate, departureTime: time } : null;
}

/**
 * Debounced Date/Time → search refresh for the Search form. A valid change is sent after
 * `delay` ms, or at once on `flush` (blur). An incomplete or out-of-range value sends `null`
 * at once and drops any waiting change, so stale results can be hidden immediately.
 */
export function createPreferenceRefresh(
  send: (preferences: PlanningPreferences | null) => void,
  delay = PREFERENCE_DEBOUNCE_MS,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: PlanningPreferences | null = null;
  const cancel = () => {
    clearTimeout(timer);
    timer = undefined;
    pending = null;
  };
  const flush = () => {
    const preferences = pending;
    cancel();
    if (preferences) send(preferences);
  };
  return {
    change(departureDate: string, departureTime: string, today?: string) {
      cancel();
      const preferences = validPreferences(departureDate, departureTime, today);
      if (!preferences) {
        send(null);
        return;
      }
      pending = preferences;
      timer = setTimeout(flush, delay);
    },
    flush,
    cancel,
  };
}
