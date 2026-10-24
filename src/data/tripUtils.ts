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
    value.trim().toLowerCase().replace(/\s+/g, " ");
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
