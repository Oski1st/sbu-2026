import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Clock3, GitCompareArrows, Info, X } from "lucide-react";
import type { Trip } from "../../types";
import { agencies } from "../../data/agencies";
import {
  compareTrips,
  formatDuration,
  formatMoney,
  formatTime,
  formatJourneyTime,
  sampleTotal,
  transferCount,
  tripMetrics,
} from "../../data/tripUtils";
import { useSelectedTrip } from "../layout/TripContext";
const minutes = (value: number | undefined | null) =>
  value == null
    ? "Unavailable"
    : value < 60
      ? `${value} min`
      : formatDuration(value);
interface Props {
  trips: Trip[];
  open: boolean;
  onClose: () => void;
}
export function RouteComparison({ trips, open, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const { selectTrip } = useSelectedTrip();
  useEffect(() => {
    if (!open || !dialog.current) return;
    const element = dialog.current;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (!element.open) element.showModal();
    return () => {
      if (element.open) element.close();
      previous?.focus({ preventScroll: true });
    };
  }, [open]);
  const comparison =
    trips.length === 2 ? compareTrips(trips[0], trips[1]) : null;
  return (
    <dialog
      ref={dialog}
      className="comparison-dialog"
      aria-labelledby="comparison-title"
      aria-describedby="comparison-note"
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < box.left ||
          event.clientX > box.right ||
          event.clientY < box.top ||
          event.clientY > box.bottom
        )
          onClose();
      }}
    >
      <div className="comparison-header">
        <span className="eyebrow">
          <GitCompareArrows size={15} />COMPARE ROUTES
        </span>
        <button
          type="button"
          className="comparison-close"
          onClick={onClose}
          aria-label="Close route comparison"
          autoFocus
        >
          <X size={20} />
        </button>
      </div>
      <h2 id="comparison-title">Two routes, side by side.</h2>
      <p id="comparison-note">
        All times and fares below are sample data.
      </p>
      {comparison && (
        <div className="comparison-insight">
          <Clock3 size={20} />
          <p>
            <strong>{comparison.faster.label}</strong>
            {comparison.minutesSaved > 0
              ? ` gets you there ${comparison.minutesSaved} minutes sooner`
              : " arrives at the same time"}
            {comparison.fareDifference === null
              ? "."
              : comparison.fareDifference > 0
                ? ` for ${formatMoney(comparison.fareDifference)} more in sample fares.`
                : comparison.fareDifference < 0
                  ? ` and saves ${formatMoney(-comparison.fareDifference)} in sample fares.`
                  : " at the same sample fare."}
          </p>
        </div>
      )}
      <div className="comparison-table-wrap">
        <table className="comparison-table">
          <caption className="sr-only">
            Compare selected sample journeys
          </caption>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Metric</span>
              </th>
              {trips.map((trip) => (
                <th key={trip.id} scope="col">
                  <span className="comparison-route-name">
                    {trip.label?.replace("The ", "") ?? trip.id}
                  </span>
                  <small>
                    {[...new Set(trip.legs.map((leg) => leg.agency))]
                      .map((agency) => agencies[agency].shortName)
                      .join(" + ")}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Total journey</th>
              {trips.map((trip) => (
                <td key={trip.id}>
                  <strong>{formatDuration(trip.durationMinutes)}</strong>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Sample fare</th>
              {trips.map((trip) => {
                const price = sampleTotal(trip);
                return (
                  <td key={trip.id}>
                    <strong>
                      {price === null ? "Unavailable" : formatMoney(price)}
                    </strong>
                    <small>Illustrative, USD</small>
                  </td>
                );
              })}
            </tr>
            <tr>
              <th scope="row">Connections</th>
              {trips.map((trip) => (
                <td key={trip.id}>{trip.planningNote ? "Unverified" : `${transferCount(trip)} transfers`}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Time on board</th>
              {trips.map((trip) => (
                <td key={trip.id}>{minutes(tripMetrics(trip)?.rideMinutes)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Between services</th>
              {trips.map((trip) => (
                <td key={trip.id}>
                  {minutes(tripMetrics(trip)?.transferMinutes)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Shortest transfer</th>
              {trips.map((trip) => (
                <td key={trip.id}>
                  {trip.legs.length < 2
                    ? "No transfers"
                    : minutes(tripMetrics(trip)?.shortestTransferMinutes)}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Sample departure</th>
              {trips.map((trip) => (
                <td key={trip.id}>
                  {formatTime(trip.legs[0].departure)}
                  <small>Eastern Time</small>
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">Sample arrival</th>
              {trips.map((trip) => (
                <td key={trip.id}>
                  {formatJourneyTime(
                    trip.legs.at(-1)!.arrival,
                    trip.legs[0].departure,
                  )}
                  <small>Eastern Time</small>
                </td>
              ))}
            </tr>
            <tr className="comparison-action-row">
              <th scope="row">
                <span className="sr-only">Select a route</span>
              </th>
              {trips.map((trip) => (
                <td key={trip.id}>
                  <Link
                    to={`/journey/${trip.id}`}
                    onClick={() => {
                      selectTrip(trip);
                      onClose();
                    }}
                    className="select-route"
                  >
                    Choose route <ArrowRight size={15} />
                  </Link>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="comparison-caution">
        <Info size={15} />
        Transfer intervals are calculated from the sample itinerary. They are
        not minimum connection advice or a live guarantee. Check accessibility,
        platforms and actual schedules with each agency.
      </p>
    </dialog>
  );
}
