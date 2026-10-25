import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SearchForm } from "../components/search/SearchForm";
import { createLocationCatalogue } from "../components/search/locationCatalogue";
import { ScheduledRouteCard } from "../components/search/ScheduledRouteCard";
import {
  fetchTimetableCatalogue,
  fetchTimetables,
  type TimetableCatalogue,
  type TimetableResult,
} from "../services/transit/timetables";
const today = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const value = (type: string) =>
    parts.find((part) => part.type === type)!.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
};
export default function TimetableSearchPage() {
  const [params, setParams] = useSearchParams();
  const [catalogue, setCatalogue] = useState<TimetableCatalogue>();
  const [catalogueError, setCatalogueError] = useState("");
  const [catalogueAttempt, setCatalogueAttempt] = useState(0);
  const [requestAttempt, setRequestAttempt] = useState(0);
  const [result, setResult] = useState<TimetableResult>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const resultsRef = useRef<HTMLElement>(null);
  const query = {
    from: params.get("from") ?? "Philadelphia, PA",
    to: params.get("to") ?? "Stony Brook, NY",
    date: params.get("date") ?? today(),
    time: params.get("time") ?? "08:00",
    mode: params.get("mode") ?? "all",
    operator: params.get("operator") ?? "all",
    order: params.get("order") ?? "arrival",
    amtrak: params.get("amtrak") ?? "1",
  };
  const searched =
    params.get("search") === "1" || params.has("from") || params.has("to");
  const queryKey = JSON.stringify(query);
  useEffect(() => {
    let active = true;
    setCatalogueError("");
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 15000);
    fetchTimetableCatalogue(c.signal)
      .then((value) => {
        if (active) setCatalogue(value);
      })
      .catch(() => {
        if (active)
          setCatalogueError(
            "City suggestions could not be loaded. Manual entry remains available; try a city and state.",
          );
      })
      .finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      c.abort();
    };
  }, [catalogueAttempt]);
  const cityIndex = useMemo(() => {
    const indexed = createLocationCatalogue(catalogue?.cities ?? []);
    return {
      ...indexed,
      selectionValue: (city: { name: string; state: string }) =>
        `${city.name}, ${city.state}`,
    };
  }, [catalogue]);
  useEffect(() => {
    if (!searched) return;
    const c = new AbortController();
    let active = true;
    const timer = setTimeout(() => c.abort(), 15000);
    setLoading(true);
    setResult(undefined);
    setError("");
    fetchTimetables(JSON.parse(queryKey), c.signal)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((cause) => {
        if (active)
          setError(
            c.signal.aborted
              ? "The timetable request took too long. Retry or check the operators."
              : cause instanceof Error
                ? cause.message
                : "Published timetables are unavailable.",
          );
      })
      .finally(() => {
        clearTimeout(timer);
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      clearTimeout(timer);
      c.abort();
    };
  }, [queryKey, searched, requestAttempt]);
  function patch(values: Record<string, string>) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(values)) next.set(k, v);
    next.set("search", "1");
    setParams(next);
  }
  function search(
    from: string,
    to: string,
    p: { departureDate: string; departureTime: string },
  ) {
    setRequestAttempt((attempt) => attempt + 1);
    patch({
      from: from.trim(),
      to: to.trim(),
      date: p.departureDate,
      time: p.departureTime,
    });
    setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
      resultsRef.current?.focus({ preventScroll: true });
    }, 0);
  }
  return (
    <main className="search-page timetable-page">
      <section className="timetable-hero content-wrap">
        <span className="eyebrow">YOUR CITIES. YOUR TRAVEL DATE.</span>
        <h1>Find your next connection.</h1>
        <p>
          Search published train and connecting-bus timetables. Start with two
          cities and choose when you want to leave.
        </p>
        <p className="coverage-tag">
          SCHEDULED SERVICE · NOT REALTIME OR TICKET INVENTORY
        </p>
      </section>
      <div className="content-wrap">
        <SearchForm
          key={[query.from, query.to, query.date, query.time].join("|")}
          initialOrigin={query.from}
          initialDestination={query.to}
          initialDepartureDate={query.date}
          initialDepartureTime={query.time}
          catalogue={cityIndex}
          timetable
          onSearch={search}
        />
        <p className="catalogue-qualification" role="status">
          {catalogue
            ? `${catalogue.cities.length.toLocaleString()} source-backed transit places. Only ${catalogue.cities.filter((c) => c.hasTimetableStops).length} currently have mapped stops in the loaded timetable feeds. A city listing does not guarantee a route; Google Transit coverage is not verified.`
            : catalogueError ||
              "Loading city suggestions. You can still type your cities manually."}
        </p>
        {!catalogue && catalogueError && (
          <button onClick={() => setCatalogueAttempt((attempt) => attempt + 1)}>
            Retry city suggestions
          </button>
        )}
        <section
          className="results-section"
          id="routes"
          ref={resultsRef}
          tabIndex={-1}
          aria-labelledby="results-title"
        >
          <div className="results-heading">
            <div>
              <span className="eyebrow">PUBLISHED DEPARTURES</span>
              <h2 id="results-title">Your route options.</h2>
              <p role="status" aria-live="polite">
                {loading
                  ? "Searching published timetables…"
                  : error ||
                    result?.message ||
                    (result
                      ? `${result.itineraries.length} scheduled options for ${query.from} → ${query.to}`
                      : "Choose two cities and a travel date to search.")}
              </p>
            </div>
            <div className="sort-control">
              <label htmlFor="timetable-order">SORT BY</label>
              <select
                id="timetable-order"
                value={query.order}
                onChange={(e) => patch({ order: e.target.value })}
              >
                <option value="arrival">Earliest arrival</option>
                <option value="transfers">Fewest transfers</option>
              </select>
            </div>
          </div>
          <div className="transport-filters">
            <label>
              TRAVEL MODE{" "}
              <select
                value={query.mode}
                onChange={(e) => patch({ mode: e.target.value })}
              >
                <option value="all">Rail + connecting bus</option>
                <option value="rail">Rail only</option>
                <option value="bus">Bus only</option>
                <option value="mixed">Mixed rail + bus</option>
              </select>
            </label>
            <label>
              OPERATOR{" "}
              <select
                value={query.operator}
                onChange={(e) => patch({ operator: e.target.value })}
              >
                <option value="all">All loaded operators</option>
                {[
                  "AMTRAK",
                  "LIRR",
                  "SEPTA",
                  "NJ_TRANSIT",
                  "GREYHOUND",
                  "FLIXBUS",
                ].map((o) => (
                  <option key={o} value={o}>
                    {o.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="amtrak-toggle">
              <input
                type="checkbox"
                checked={query.amtrak !== "0"}
                onChange={(e) =>
                  patch({ amtrak: e.target.checked ? "1" : "0" })
                }
              />{" "}
              Include Amtrak
            </label>
          </div>
          {error && (
            <div className="empty-state">
              <h3>We couldn’t verify this search.</h3>
              <button
                onClick={() => setRequestAttempt((attempt) => attempt + 1)}
              >
                Retry timetable search
              </button>
              <p>{error}</p>
              <p>
                Keep editing the cities/date above, or check the agencies
                directly. We won’t substitute sample times.
              </p>
            </div>
          )}
          {!loading && !error && result && !result.itineraries.length && (
            <div className="empty-state">
              <h3>No verified timetable connection found.</h3>
              <p>{result.message}</p>
              <p>
                Try another date or filter. Missing coverage is not evidence
                that no real service exists.
              </p>
            </div>
          )}
          {result?.itineraries.map((trip, index) => (
            <ScheduledRouteCard key={trip.id} trip={trip} index={index} />
          ))}
          <p className="results-disclaimer">
            Ordered within the loaded feeds and transfer assumptions only: next
            7 days, at most 4 boardings. No fare feed, reservation availability
            or realtime disruption checks. Confirm stations, transfers and
            current service with the operators.
          </p>
        </section>
        <section
          className="timetable-coverage"
          aria-labelledby="coverage-title"
        >
          <h2 id="coverage-title">What this search can verify</h2>
          <p>
            {catalogue?.feeds.length ? "Published Amtrak and LIRR snapshots are loaded." : "No published timetable snapshot is loaded on this checkout. Source redistribution clearance is pending."} No verified
            scheduled feed is loaded for SEPTA, NJ TRANSIT, Greyhound or
            FlixBus. Their catalogue listings and sample routes are never
            substituted for dated schedules.
          </p>
          {(catalogue?.feeds ?? result?.feeds ?? []).map((feed) => (
            <p key={feed.id}>
              <strong>{feed.operator}</strong>: {feed.startDate}–{feed.endDate};
              retrieved {new Date(feed.checkedAt).toLocaleString()}.{" "}
              <a href={feed.sourceUrl} target="_blank" rel="noreferrer">
                Official timetable source
              </a>
            </p>
          ))}
          <p>
            The original Philadelphia–Stony Brook demonstration is still
            available separately. Its times and fares are illustrative and never
            become search results for your travel date.
          </p>
          <Link className="select-route" to="/demo">
            Explore the original sample journeys
          </Link>
        </section>
      </div>
    </main>
  );
}
