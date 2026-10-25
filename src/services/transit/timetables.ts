export interface TimetablePlace {
  id: string;
  name: string;
  state: string;
  aliases: string[];
  hasTimetableStops: boolean;
  /** A published station lies within the access radius (access trip itself unscheduled). */
  hasNearbyTimetableStation?: boolean;
}
export interface TimetableFeed {
  id: string;
  operator: string;
  sourceUrl: string;
  sha256: string;
  checkedAt: string;
  version: string;
  startDate: string;
  endDate: string;
}
export interface TimetableCatalogue {
  version: string;
  accessPolicy?: { radiusKm: number; maxStations: number };
  cities: TimetablePlace[];
  feeds: TimetableFeed[];
  limits: string[];
}
export interface TimetableStop {
  id: string;
  feed: string;
  name: string;
  timezone: string;
  url: string;
}
export interface ScheduledLeg {
  instance: string;
  feed: string;
  operator: "AMTRAK" | "LIRR";
  tripId: string;
  routeId: string;
  serviceDate: string;
  route: string;
  number: string;
  agencyName: string;
  mode: "rail" | "bus";
  fromStop: string;
  toStop: string;
  from: TimetableStop;
  to: TimetableStop;
  departure: string;
  arrival: string;
  sourceUrl: string;
  purchaseUrl: string;
}
/** Qualified catalogue listing: a named service area, never a schedule. */
export interface OperatorListing {
  operator: string;
  url: string;
}
export interface AccessStation {
  stationId: string;
  id: string;
  feed: string;
  name: string;
}
/** Unscheduled trip between a place and a timetable station. No times/fares/durations. */
export interface AccessLeg {
  place: string;
  placeId: string;
  station: AccessStation;
  /** Rounded straight-line km from the catalogue representative point. */
  straightLineKm: number;
  distanceReference: "catalogue-representative-point";
  scheduled: false;
  listings: OperatorListing[];
}
export interface AccessSide {
  placeId: string;
  place: string;
  status:
    | "ok"
    | "none-in-range"
    | "outside-snapshot"
    | "filtered-out"
    | "no-useful-leg";
  stations: (AccessStation & { straightLineKm: number })[];
  listings: OperatorListing[];
}
export interface AccessSummary {
  radiusKm: number;
  maxStations: number;
  distanceReference: "catalogue-representative-point";
  scheduled: false;
  origin: AccessSide | null;
  destination: AccessSide | null;
}
export interface ScheduledItinerary {
  id: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  durationMinutes: number;
  waitFromRequestedMinutes: number;
  transfers: number;
  access?: { before: AccessLeg | null; after: AccessLeg | null };
  legs: ScheduledLeg[];
}
export interface TimetableResult {
  version: string;
  query: {
    from: string;
    to: string;
    date: string;
    time: string;
    timezone: string;
  };
  itineraries: ScheduledItinerary[];
  warnings: string[];
  feeds: TimetableFeed[];
  reason?: string;
  message?: string;
  access?: AccessSummary;
}
export interface ItineraryResult extends Omit<TimetableResult, "itineraries"> {
  itinerary: ScheduledItinerary;
}
export class TimetableError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
async function read<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    signal,
    headers: { Accept: "application/json" },
  });
  const body = await response.json();
  if (!response.ok)
    throw new TimetableError(
      body.error ?? "unavailable",
      body.message ?? "Published timetables could not be loaded.",
    );
  return body as T;
}
export const fetchTimetableCatalogue = (signal: AbortSignal) =>
  read<TimetableCatalogue>("/api/transit/catalogue", signal);
export function fetchTimetables(
  query: Record<string, string>,
  signal: AbortSignal,
) {
  return read<TimetableResult>(
    "/api/transit/plan?" + new URLSearchParams(query),
    signal,
  );
}
export const fetchItinerary = (id: string, signal: AbortSignal) =>
  read<ItineraryResult>(
    "/api/transit/itinerary/" + encodeURIComponent(id),
    signal,
  );
export function stationTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}
