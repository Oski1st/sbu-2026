import { resolveCity } from "./eastCoast";
import type { Trip } from "../types";
export const formatDuration = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
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
        ? a.durationMinutes - b.durationMinutes
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
  const [faster, slower] =
    first.durationMinutes <= second.durationMinutes
      ? [first, second]
      : [second, first];
  const fastFare = sampleTotal(faster),
    slowFare = sampleTotal(slower);
  return {
    faster,
    slower,
    minutesSaved: slower.durationMinutes - faster.durationMinutes,
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
