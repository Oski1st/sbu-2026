import { MapPin } from "lucide-react";
import type {
  AccessLeg,
  AccessSide,
  AccessSummary,
  OperatorListing,
} from "../../services/transit/timetables";
import "./accessLeg.css";

const operatorNames: Record<string, string> = {
  AMTRAK: "Amtrak",
  LIRR: "LIRR",
  SEPTA: "SEPTA",
  NJ_TRANSIT: "NJ TRANSIT",
  GREYHOUND: "Greyhound",
  FLIXBUS: "FlixBus",
};
export const operatorName = (operator: string) =>
  operatorNames[operator] ?? operator.replaceAll("_", " ");
const stationLabel = (s: { name: string; id: string }) => `${s.name} (${s.id})`;

/** Catalogue listings with the existing qualified wording. Never schedules. */
export function OperatorListings({
  place,
  listings,
}: {
  place: string;
  listings: readonly OperatorListing[];
}) {
  if (!listings.length)
    return (
      <p className="access-listings">
        No operator listing is recorded for {place} in this catalogue. Missing
        evidence is not evidence of no service.
      </p>
    );
  return (
    <div className="access-listings">
      <p>
        Operators listed for {place}:{" "}
        <span className="access-qualifier">
          Listed service area — check boarding stop
        </span>
        . These listings are not schedules; no times or fares are shown for
        them.
      </p>
      <ul>
        {listings.map((l) => (
          <li key={l.operator + l.url}>
            <a href={l.url} target="_blank" rel="noreferrer">
              {operatorName(l.operator)} city page for {place}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** One unscheduled access step shown inside an itinerary. */
export function AccessLegNotice({
  leg,
  direction,
  showListings = false,
}: {
  leg: AccessLeg;
  direction: "before" | "after";
  showListings?: boolean;
}) {
  const from = direction === "before" ? leg.place : stationLabel(leg.station);
  const to = direction === "before" ? stationLabel(leg.station) : leg.place;
  return (
    <div className="access-leg" role="note" aria-label={`Unscheduled step: ${from} to ${to}`}>
      <span className="access-leg-tag">
        <MapPin size={12} aria-hidden="true" /> NOT IN PUBLISHED SCHEDULES
      </span>
      <p className="access-leg-title">
        <strong>
          Get from {from} to {to}
        </strong>
      </p>
      <p>
        About {leg.straightLineKm} km straight-line from the catalogue point
        for {leg.place}; not a road or transit distance. Not included in
        published schedules — no time, fare or duration is shown for this
        part.
        {direction === "before"
          ? " Your requested time is applied at the station, so allow time to get there."
          : ""}
      </p>
      {showListings && (
        <OperatorListings place={leg.place} listings={leg.listings} />
      )}
    </div>
  );
}

function SideSummary({
  side,
  role,
  radiusKm,
}: {
  side: AccessSide;
  role: "origin" | "destination";
  radiusKm: number;
}) {
  const verb = role === "origin" ? "start" : "end";
  return (
    <div className="access-side">
      <h3>
        {side.place} has no stop in the loaded Amtrak/LIRR timetables.
      </h3>
      {side.status === "ok" ? (
        <>
          <p>
            Published options {verb} at the nearest station
            {side.stations.length > 1 ? "s" : ""} within {radiusKm} km
            (straight-line from the catalogue point, not a travel distance).
            Getting between {side.place} and{" "}
            {side.stations.length > 1 ? "these stations" : "this station"} is
            not included in published schedules.
          </p>
          <ul className="access-stations">
            {side.stations.map((s) => (
              <li key={s.stationId}>
                {stationLabel(s)} — about {s.straightLineKm} km
              </li>
            ))}
          </ul>
        </>
      ) : side.status === "none-in-range" ? (
        <p>No published station in the loaded timetables is within {radiusKm} km.</p>
      ) : side.status === "outside-snapshot" ? (
        <p>Stations within {radiusKm} km exist, but the selected date is outside their published snapshot.</p>
      ) : side.status === "filtered-out" ? (
        <p>Stations within {radiusKm} km exist, but your operator settings exclude them.</p>
      ) : (
        <p>
          Its nearest published stations are no closer to it than the
          stations used for the other place, so no useful scheduled leg is
          offered.
        </p>
      )}
      <OperatorListings place={side.place} listings={side.listings} />
    </div>
  );
}

/** Search-level explanation of unscheduled access steps for unmapped places. */
export function AccessSummaryPanel({ access }: { access: AccessSummary }) {
  return (
    <section className="access-summary" aria-labelledby="access-summary-title">
      <h2 id="access-summary-title" className="access-summary-title">
        Getting to and from the timetable
      </h2>
      {access.origin && (
        <SideSummary side={access.origin} role="origin" radiusKm={access.radiusKm} />
      )}
      {access.destination && (
        <SideSummary
          side={access.destination}
          role="destination"
          radiusKm={access.radiusKm}
        />
      )}
    </section>
  );
}
