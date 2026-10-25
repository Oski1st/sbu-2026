import { Link } from "react-router-dom";
import { useState } from "react";
import { ArrowRight, ChevronDown, TrainFront, Bus } from "lucide-react";
import type { ScheduledItinerary } from "../../services/transit/timetables";
import { stationTime } from "../../services/transit/timetables";
import { formatDuration } from "../../data/tripUtils";
export function ScheduledRouteCard({
  trip,
  index = 0,
  detailsOnly = false,
}: {
  trip: ScheduledItinerary;
  index?: number;
  detailsOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(detailsOnly);
  const first = trip.legs[0],
    last = trip.legs.at(-1)!;
  return (
    <article className="route-card scheduled-card">
      <div className="route-card-top">
        <span className="route-kicker">
          {index === 0
            ? "BEST MATCH FOR YOUR ORDER"
            : "ANOTHER PUBLISHED OPTION"}
        </span>
        <span className="sample-label timetable-label">
          PUBLISHED TIMETABLE
        </span>
      </div>
      <div className="route-card-title">
        <div>
          <h3>
            {trip.origin} → {trip.destination}
          </h3>
          <p>
            {trip.legs
              .map(
                (l) =>
                  `${l.operator === "AMTRAK" ? "Amtrak" : "LIRR"} ${l.number}`,
              )
              .join(" → ")}
          </p>
        </div>
        <div className="fare">
          <strong>Check fares</strong>
          <span>No fare or ticket inventory feed</span>
        </div>
      </div>
      <div className="route-summary">
        <div className="route-time">
          <strong>
            <time dateTime={trip.departure}>
              {stationTime(trip.departure, first.from.timezone)}
            </time>
          </strong>
          <span>
            {first.from.name} ({first.from.id})
          </span>
        </div>
        <div className="duration-line">
          <span>
            {formatDuration(trip.durationMinutes)} · {trip.transfers} transfers
          </span>
          <div>
            <i />
            <span />
            <ArrowRight size={13} />
          </div>
        </div>
        <div className="route-time arrival">
          <strong>
            <time dateTime={trip.arrival}>
              {stationTime(trip.arrival, last.to.timezone)}
            </time>
          </strong>
          <span>
            {last.to.name} ({last.to.id})
          </span>
        </div>
      </div>
      <p className="timetable-station-note">
        Starts at the named station, not a city centre. Departure is{" "}
        {trip.waitFromRequestedMinutes} min after your requested time. Times
        show each station’s time zone.
      </p>
      <div className="agency-path">
        {trip.legs.map((leg, i) => (
          <span className="agency-badge" key={leg.instance + "-" + i}>
            {leg.mode === "bus" ? <Bus size={13} /> : <TrainFront size={13} />}{" "}
            {leg.operator} · {leg.mode}
          </span>
        ))}
      </div>
      <div className="route-card-bottom">
        <button
          className="detail-toggle"
          aria-expanded={expanded}
          aria-controls={`scheduled-details-${trip.id}`}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown size={15} />
          {expanded ? "Hide route details" : "View route details"}
        </button>
        {!detailsOnly && (
          <Link className="select-route" to={"/itinerary/" + trip.id}>
            Choose this route <ArrowRight size={16} />
          </Link>
        )}
      </div>
      {expanded && (
        <div className="leg-details" id={`scheduled-details-${trip.id}`}>
          {trip.legs.map((leg, i) => (
            <div className="leg-detail" key={leg.instance + "-" + i}>
              <span className="leg-number">{i + 1}</span>
              <div>
                <strong>
                  {leg.route} {leg.number}
                </strong>
                <p>
                  {leg.from.name} ({leg.from.id}) → {leg.to.name} ({leg.to.id})
                </p>
                <small>
                  {stationTime(leg.departure, leg.from.timezone)} –{" "}
                  {stationTime(leg.arrival, leg.to.timezone)}
                </small>
                <p>
                  Source agency: {leg.agencyName}; {leg.mode}. Scheduled, not
                  realtime.
                </p>
              </div>
              <a href={leg.purchaseUrl} target="_blank" rel="noreferrer">
                Official tickets
              </a>
            </div>
          ))}
          <p className="fare-disclaimer">
            Check current service, station access and tickets with each
            operator. Transfers use published GTFS rules where available; other
            same-station transfers use a 10 minute planning buffer and
            Penn/Moynihan cross-operator transfers use 15 minutes. These buffers
            are not guaranteed connections.
          </p>
        </div>
      )}
    </article>
  );
}
