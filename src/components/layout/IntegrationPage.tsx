import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Route,
  Wallet,
  TrainFront,
  Info,
} from "lucide-react";
import { useSelectedTrip } from "./TripContext";
import { agencies } from "../../data/agencies";
import { formatDuration, formatTime } from "../../data/tripUtils";
/** Owned by Person 1. Replaced automatically when teammate page modules are merged. */
export function IntegrationPage({ kind }: { kind: "journey" | "wallet" }) {
  const { selectedTrip } = useSelectedTrip();
  const Icon = kind === "journey" ? Route : Wallet;
  return (
    <div className="integration-page content-wrap">
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Back to search
      </Link>
      <span className="integration-icon">
        <Icon size={27} />
      </span>
      <span className="eyebrow">
        {kind === "journey" ? "YOUR NEXT CHAPTER" : "OFFICIAL TICKET OPTIONS"}
      </span>
      <h1>
        {kind === "journey"
          ? "A clear path ahead."
          : "Every ticket. One starting point."}
      </h1>
      <p className="integration-intro">
        {kind === "journey"
          ? "Your selected connection is ready to explore."
          : "Continue with each agency to check fares and buy valid tickets."}
      </p>
      <p className="integration-notice">
        <Info size={16} />
        {kind === "journey"
          ? "Journey preview · The full Journey page is being built by our team."
          : "Wallet preview · No tickets have been issued or purchased."}
      </p>
      {selectedTrip ? (
        <>
          <div className="integration-route">
            <div className="integration-route-title">
              <h2>
                {selectedTrip.origin} <ArrowRight size={23} />{" "}
                {selectedTrip.destination}
              </h2>
              <span>
                {formatDuration(selectedTrip.durationMinutes)} · Sample
                itinerary
              </span>
            </div>
            <div className="integration-legs">
              {selectedTrip.legs.map((leg) => (
                <div className="handoff-leg" key={leg.id}>
                  <span
                    className="handoff-leg-icon"
                    style={{ color: agencies[leg.agency].color }}
                  >
                    <TrainFront size={20} />
                  </span>
                  <div>
                    <small>
                      {agencies[leg.agency].name} · {leg.line}
                    </small>
                    <h3>
                      {leg.from} <ArrowRight size={14} /> {leg.to}
                    </h3>
                    <p>
                      {formatTime(leg.departure)} – {formatTime(leg.arrival)} ET
                      · Sample
                    </p>
                  </div>
                  {kind === "wallet" && (
                    <a target="_blank" rel="noreferrer" href={leg.purchaseUrl}>
                      Official tickets <ArrowUpRight size={14} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
          <p className="integration-note">
            Illustrative times and fares for Oct 24, 2026. Confirm actual
            schedules and availability with each operator. Transfer time is
            included in the sample total.
          </p>
          {kind === "journey" && (
            <Link
              className="search-button handoff-cta"
              to={`/wallet?trip=${selectedTrip.id}`}
            >
              View ticket options <ArrowRight size={17} />
            </Link>
          )}
        </>
      ) : (
        <div className="empty-state">
          <h2>Start with a connection.</h2>
          <p>Choose a route from Search to bring your journey here.</p>
          <Link className="search-button handoff-cta" to="/">
            Find my way <ArrowRight size={17} />
          </Link>
        </div>
      )}
    </div>
  );
}
