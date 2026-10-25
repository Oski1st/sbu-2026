import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  fetchItinerary,
  type ItineraryResult,
} from "../services/transit/timetables";
import { ScheduledRouteCard } from "../components/search/ScheduledRouteCard";
export default function ScheduledJourneyPage() {
  const { id } = useParams();
  const [result, setResult] = useState<ItineraryResult>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 15000);
    setResult(undefined);
    setError("");
    fetchItinerary(id ?? "", c.signal)
      .then((r) => {
        if (active) setResult(r);
      })
      .catch((e) => {
        if (active)
          setError(
            c.signal.aborted
              ? "The timetable request took too long. Retry or return to search."
              : e instanceof Error
                ? e.message
                : "Could not load this itinerary.",
          );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      c.abort();
    };
  }, [id, retry]);
  return (
    <main className="content-wrap scheduled-journey">
      <span className="eyebrow">YOUR PUBLISHED ITINERARY</span>
      <h1>
        {result
          ? "Your connection. In one place."
          : error
            ? "Itinerary unavailable"
            : "Loading your itinerary…"}
      </h1>
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button onClick={() => setRetry((x) => x + 1)}>
            Retry timetable lookup
          </button>
        </div>
      )}
      {result && (
        <>
          <p>
            Reconstructed from timetable snapshot {result.version}. Schedules
            can change; this is not a ticket, reservation, realtime arrival or
            connection guarantee.
          </p>
          {Date.parse(result.itinerary.departure) < Date.now() && (
            <p>
              This departure is in the past. This is a published timetable
              record, not live tracking.
            </p>
          )}
          <ScheduledRouteCard
            key={result.itinerary.id}
            trip={result.itinerary}
            detailsOnly
          />
          <p>
            Share or bookmark this page to reopen the same snapshot itinerary.
            If the source snapshot changes, the link will ask you to search
            again rather than silently replace it.
          </p>
          <h2>Before you travel</h2>
          <ul>
            <li>
              Check each operator’s current schedule, disruptions, station
              access and tickets.
            </li>
            <li>
              Transfers use the stated planning buffers; platform changes and
              accessibility have not been verified.
            </li>
            <li>
              The station names shown are the actual GTFS stops. They are not
              the city centre or your current location.
            </li>
            {(result.itinerary.access?.before ||
              result.itinerary.access?.after) && (
              <li>
                Steps marked “Not in published schedules” connect a listed
                place to the nearest published station. Their distances are
                straight-line references only; plan that part yourself and
                check the listed operators directly.
              </li>
            )}
          </ul>
        </>
      )}
      <Link to="/">Back to timetable search</Link>
    </main>
  );
}
