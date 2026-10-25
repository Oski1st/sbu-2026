import { useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  Clock3,
  TrainFront,
  Bus,
  ArrowUpRight,
} from "lucide-react";
import type { Trip } from "../../types";
import { agencies } from "../../data/agencies";
import {
  formatDuration,
  formatMoney,
  formatTime,
  formatJourneyTime,
  sampleTotal,
  transferCount,
  tripMetrics,
} from "../../data/tripUtils";
import { useSelectedTrip } from "../layout/TripContext";
import { ShareTripButton } from "./ShareTripButton";
import { PurchaseLink, useSearchDate } from "../purchase/PurchaseLink";
export function RouteCard({
  trip,
  index,
  comparing,
  onCompare,
  planningPreferences,
}: {
  trip: Trip;
  index: number;
  comparing: boolean;
  onCompare: () => void;
  planningPreferences?: { departureDate: string; departureTime: string };
}) {
  const [expanded, setExpanded] = useState(false);
  const { selectTrip } = useSelectedTrip();
  // Remembers this Search date for Journey and Wallet ticket links, even while details are closed.
  useSearchDate();
  const price = sampleTotal(trip);
  const metrics = tripMetrics(trip);
  const unique = [...new Set(trip.legs.map((leg) => leg.agency))];
  const first = trip.legs[0],
    last = trip.legs.at(-1)!;
  const planningSearch = planningPreferences
    ? `?${new URLSearchParams({ date: planningPreferences.departureDate, time: planningPreferences.departureTime })}`
    : "";
  const previewDate = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(first.departure));
  return (
    <article
      className="route-card"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="route-card-top">
        <span className={`route-kicker ${index === 0 ? "recommended" : ""}`}>
          <span className="little-dot" />
          {trip.planningNote
            ? "CITY-LEVEL CONCEPT"
            : trip.legs.some((leg) => leg.agency === "AMTRAK")
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
          <span>
            {price === null ? "with the operator" : "illustrative total"}
          </span>
        </div>
      </div>
      <div className="route-summary">
        <div className="route-time">
          <strong>{formatTime(first.departure)}</strong>
          <span>{trip.origin}</span>
        </div>
        <div className="duration-line">
          <span>
            {formatDuration(trip.durationMinutes)}
            <i> · </i>
            {trip.planningNote ? "Connections unverified" : `${transferCount(trip)} transfers`}
          </span>
          <div>
            <i />
            <span />
            <ArrowRight size={13} />
          </div>
        </div>
        <div className="route-time arrival">
          <strong>{formatJourneyTime(last.arrival, first.departure)}</strong>
          <span>{trip.destination}</span>
        </div>
      </div>
      <div
        className="agency-path"
        role="group"
        aria-label={`Operated by ${unique.map((agency) => agencies[agency].name).join(", ")}`}
      >
        {unique.map((agency, i) => (
          <span className="agency-sequence" key={agency}>
            {i > 0 && <ArrowRight size={12} className="agency-arrow" aria-hidden="true" />}
            <span
              className="agency-badge"
              style={
                { "--agency-color": agencies[agency].color } as CSSProperties
              }
            >
              {agencies[agency].mode === "bus" ? (
                <Bus size={13} aria-hidden="true" />
              ) : (
                <TrainFront size={13} aria-hidden="true" />
              )}
              {agencies[agency].shortName}
            </span>
          </span>
        ))}
      </div>
      {trip.planningNote && (
        <p className="concept-note">
          Concept route · Actual services, terminals and transfers unverified.
        </p>
      )}
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
        <ShareTripButton trip={trip} search={planningSearch} />
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
          to={`/journey/${trip.id}${planningSearch}`}
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
                <strong>{formatDuration(metrics.rideMinutes)}</strong> on board
              </span>
              <span>
                <strong>{metrics.transferMinutes} min</strong> connecting
              </span>
            </div>
          )}
          <p className="details-note">
            <Clock3 size={14} />
            {planningPreferences
              ? `Demo timeline shifted to your planning preference · ${previewDate}, ${formatTime(first.departure)} Eastern Time. Not an actual schedule.`
              : `All times shown in Eastern Time · Sample departure ${previewDate}`}
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
                  {formatJourneyTime(leg.departure, first.departure)} –{" "}
                  {formatJourneyTime(leg.arrival, first.departure)} ·{" "}
                  {leg.fare
                    ? leg.fare.amount === 0
                      ? "Included in preceding sample LIRR fare"
                      : `${formatMoney(leg.fare.amount)} sample fare`
                    : "Fare unavailable"}
                </small>
              </div>
              <PurchaseLink
                leg={leg}
                tripStart={first.departure}
                position={`segment ${i + 1}`}
                icon={<ArrowUpRight size={13} aria-hidden="true" />}
              />
            </div>
          ))}
          <p className="fare-disclaimer">
            {trip.planningNote}{" "}
            Sample fares are for the demo only. Final prices, connections and
            availability must be confirmed with each agency. Tickets are
            purchased separately.
          </p>
        </div>
      )}
    </article>
  );
}
