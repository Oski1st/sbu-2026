import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  TrainFront,
  ArrowUpRight,
} from "lucide-react";
import type { Trip } from "../../types";
import { agencies } from "../../data/agencies";
import {
  formatDuration,
  formatMoney,
  formatTime,
  sampleTotal,
  transferCount,
  tripMetrics,
} from "../../data/tripUtils";
import { useSelectedTrip } from "../layout/TripContext";
import { ShareTripButton } from "./ShareTripButton";
export function RouteCard({
  trip,
  index,
  comparing,
  onCompare,
}: {
  trip: Trip;
  index: number;
  comparing: boolean;
  onCompare: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { selectTrip } = useSelectedTrip();
  const price = sampleTotal(trip);
  const metrics = tripMetrics(trip);
  const unique = [...new Set(trip.legs.map((leg) => leg.agency))];
  const first = trip.legs[0],
    last = trip.legs.at(-1)!;
  return (
    <article
      className="route-card"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="route-card-top">
        <span className={`route-kicker ${index === 0 ? "recommended" : ""}`}>
          <span className="little-dot" />
          {trip.legs.some((leg) => leg.agency === "AMTRAK")
            ? "FEWER TRANSFERS"
            : "LOWER SAMPLE FARE"}
        </span>
        <span className="sample-label">SAMPLE ITINERARY</span>
      </div>
      <div className="route-card-title">
        <div>
          <h3>{trip.label}</h3>
          <p>{trip.description}</p>
        </div>
        <div className="fare">
          {price === null ? (
            <strong>Check fares</strong>
          ) : (
            <strong>
              {formatMoney(price)}
              <small> USD</small>
            </strong>
          )}
          <span>illustrative total</span>
        </div>
      </div>
      <div className="route-summary">
        <div className="route-time">
          <strong>{formatTime(first.departure)}</strong>
          <span>Philadelphia</span>
        </div>
        <div className="duration-line">
          <span>
            {formatDuration(trip.durationMinutes)}
            <i> · </i>
            {transferCount(trip)} transfers
          </span>
          <div>
            <i />
            <span />
            <ArrowRight size={13} />
          </div>
        </div>
        <div className="route-time arrival">
          <strong>{formatTime(last.arrival)}</strong>
          <span>Stony Brook</span>
        </div>
      </div>
      <div
        className="agency-path"
        aria-label={`Operated by ${unique.map((agency) => agencies[agency].name).join(", ")}`}
      >
        {unique.map((agency, i) => (
          <span className="agency-sequence" key={agency}>
            {i > 0 && <ArrowRight size={12} className="agency-arrow" />}
            <span
              className="agency-badge"
              style={
                { "--agency-color": agencies[agency].color } as CSSProperties
              }
            >
              <TrainFront size={13} />
              {agencies[agency].shortName}
            </span>
          </span>
        ))}
      </div>
      <div className="route-card-utility">
        <label className="compare-route-check">
          <input
            type="checkbox"
            checked={comparing}
            onChange={onCompare}
            aria-label={`Compare ${trip.label ?? trip.id}`}
          />
          Compare route
        </label>
        <ShareTripButton trip={trip} />
      </div>
      <div className="route-card-bottom">
        <button
          className="detail-toggle"
          aria-expanded={expanded}
          aria-controls={`details-${trip.id}`}
          onClick={() => setExpanded(!expanded)}
        >
          <ChevronDown size={15} className={expanded ? "rotate" : ""} />
          {expanded ? "Hide route details" : "View route details"}
        </button>
        <Link
          className="select-route"
          to={`/journey/${trip.id}`}
          state={{ tripId: trip.id, trip }}
          onClick={() => selectTrip(trip)}
        >
          Choose this route <ArrowRight size={16} />
        </Link>
      </div>
      {expanded && (
        <div id={`details-${trip.id}`} className="leg-details">
          {metrics && (
            <div className="trip-time-breakdown">
              <span>
                <strong>{formatDuration(metrics.rideMinutes)}</strong> on trains
              </span>
              <span>
                <strong>{metrics.transferMinutes} min</strong> between trains
              </span>
            </div>
          )}
          <p className="details-note">
            <Clock3 size={14} />
            All times shown in Eastern Time · Oct 24, 2026 · Sample only
          </p>
          {trip.legs.map((leg, i) => (
            <div key={leg.id} className="leg-detail">
              <span
                className="leg-number"
                style={{ background: agencies[leg.agency].color }}
              >
                {i + 1}
              </span>
              <div>
                <strong>{leg.line}</strong>
                <p>
                  {leg.from} <ArrowRight size={11} /> {leg.to}
                </p>
                <small>
                  {formatTime(leg.departure)} – {formatTime(leg.arrival)} ·{" "}
                  {leg.fare
                    ? leg.fare.amount === 0
                      ? "Included in preceding sample LIRR fare"
                      : `${formatMoney(leg.fare.amount)} sample fare`
                    : "Fare unavailable"}
                </small>
              </div>
              <a
                href={leg.purchaseUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`${agencies[leg.agency].name} official ticket information`}
              >
                Agency site <ArrowUpRight size={13} />
              </a>
            </div>
          ))}
          <p className="fare-disclaimer">
            Sample fares are for the demo only. Final prices, train changes and
            availability must be confirmed with each agency. Tickets are
            purchased separately.
          </p>
        </div>
      )}
    </article>
  );
}
