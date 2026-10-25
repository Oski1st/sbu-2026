import { resolveCity } from "./eastCoast";
import type { Trip } from "../types";

const easternFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const sampleTimelineAnchor = Date.parse("2026-10-24T08:00:00-04:00");

function utcMilliseconds(year: number, month: number, day: number, hour: number, minute: number) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, 0, 0);
  return date.getTime();
}

/** Converts a valid New York wall-clock preference into an instant without using the viewer's local zone. */
function easternPreferenceInstant(dateValue: string, timeValue: string): number | null {
  const date = dateValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const time = timeValue.match(/^(\d{2}):(\d{2})$/);
  if (!date || !time) return null;
  const [year, month, day, hour, minute] = [...date.slice(1), ...time.slice(1)].map(Number);
  const expected = utcMilliseconds(year, month, day, hour, minute);
  const check = new Date(expected);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;

  // Formatting and correcting twice resolves the EDT/EST offset for the chosen date.
  // During the short spring-forward gap, use the next valid Eastern clock time.
  let candidate = expected;
  const candidates: { instant: number; wallClock: number }[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = Object.fromEntries(easternFormatter.formatToParts(new Date(candidate)).map(({ type, value }) => [type, value]));
    const wallClock = utcMilliseconds(Number(parts.year), Number(parts.month), Number(parts.day), Number(parts.hour), Number(parts.minute));
    candidates.push({ instant: candidate, wallClock });
    if (wallClock === expected) return candidate;
    candidate += expected - wallClock;
  }
  return candidates.filter((item) => item.wallClock >= expected).sort((a, b) => a.wallClock - b.wallClock)[0]?.instant ?? null;
}

/**
 * Move every sample result by one shared offset from the fixed 8 AM sample anchor.
 * Durations, transfer buffers, fares and each alternative's relative start offset stay intact.
 * This is a planning preview, never an operator schedule or live departure prediction.
 */
export function shiftSampleTimeline(trip: Trip, departureDate: string, departureTime: string): Trip {
  const target = easternPreferenceInstant(departureDate, departureTime);
  if (target === null) return trip;
  const offset = target - sampleTimelineAnchor;
  return {
    ...trip,
    legs: trip.legs.map((leg) => ({
      ...leg,
      departure: new Date(Date.parse(leg.departure) + offset).toISOString(),
      arrival: new Date(Date.parse(leg.arrival) + offset).toISOString(),
    })),
  };
}

export function shiftSampleTimelines(trips: Trip[], departureDate: string, departureTime: string) {
  return trips.map((trip) => shiftSampleTimeline(trip, departureDate, departureTime));
}

export const formatDuration = (minutes: number) =>
  minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
/** Final arrival instant; coach concepts start later than rail, so duration alone can't rank arrival. */
export const arrivalTime = (trip: Trip) => {
  const last = trip.legs.at(-1);
  const value = last ? +new Date(last.arrival) : NaN;
  return Number.isFinite(value) ? value : Infinity;
};
export const formatTime = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
export const sampleTotal = (trip: Trip) =>
  trip.legs.length > 0 &&
  trip.legs.every((leg) => leg.fare?.status === "sample")
    ? trip.legs.reduce((total, leg) => total + (leg.fare?.amount ?? 0), 0)
    : null;
export const transferCount = (trip: Trip) => Math.max(0, trip.legs.length - 1);
export const formatMoney = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
export function findTrips(
  trips: Trip[],
  origin: string,
  destination: string,
): Trip[] {
  const normalize = (value: string) =>
    resolveCity(value)?.id ?? value.trim().toLowerCase().replace(/\s+/g, " ");
  return trips.filter(
    (trip) =>
      normalize(trip.origin) === normalize(origin) &&
      normalize(trip.destination) === normalize(destination),
  );
}
export function sortTrips(trips: Trip[], order: string): Trip[] {
  return [...trips].sort((a, b) =>
    order === "fare"
      ? (sampleTotal(a) ?? Infinity) - (sampleTotal(b) ?? Infinity)
      : order === "fastest"
        ? arrivalTime(a) - arrivalTime(b) ||
          a.durationMinutes - b.durationMinutes
        : 0,
  );
}

/** Derived only from itinerary timestamps; never a live connection guarantee. */
export function tripMetrics(trip: Trip) {
  if (!trip.legs.length) return null;
  const rides = trip.legs.map(
    (leg) => (+new Date(leg.arrival) - +new Date(leg.departure)) / 60000,
  );
  const waits = trip.legs
    .slice(1)
    .map(
      (leg, index) =>
        (+new Date(leg.departure) - +new Date(trip.legs[index].arrival)) /
        60000,
    );
  if (
    [...rides, ...waits].some((value) => !Number.isFinite(value) || value < 0)
  )
    return null;
  return {
    rideMinutes: rides.reduce((sum, value) => sum + value, 0),
    transferMinutes: waits.reduce((sum, value) => sum + value, 0),
    shortestTransferMinutes: waits.length ? Math.min(...waits) : null,
  };
}

export function compareTrips(first: Trip, second: Trip) {
  const gap = arrivalTime(first) - arrivalTime(second);
  const [faster, slower] =
    gap < 0 || (gap === 0 && first.durationMinutes <= second.durationMinutes)
      ? [first, second]
      : [second, first];
  const fastFare = sampleTotal(faster),
    slowFare = sampleTotal(slower);
  const arrivalGap = (arrivalTime(slower) - arrivalTime(faster)) / 60000;
  return {
    faster,
    slower,
    // "Gets you there sooner" means earlier arrival, not a shorter ride.
    minutesSaved: Number.isFinite(arrivalGap) ? arrivalGap : 0,
    fareDifference:
      fastFare === null || slowFare === null ? null : fastFare - slowFare,
    transfersSaved: transferCount(slower) - transferCount(faster),
  };
}

/** Show calendar-day changes in Eastern Time rather than silently wrapping the clock. */
export function formatJourneyTime(iso: string, departure: string) {
  const day = (value: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(value));
  return day(iso) === day(departure)
    ? formatTime(iso)
    : `${formatTime(iso)} · ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(new Date(iso))}`;
}
