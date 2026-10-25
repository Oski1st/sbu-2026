import { useSearchParams } from "react-router-dom";
import {
  defaultSearch,
  readSearchState,
  writeSearchState,
  newSearchPatch,
  type SearchState,
} from "../data/searchState";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  Layers3,
  Leaf,
  Route,
  ShieldCheck,
  Sparkles,
  TrainFront,
  Bus,
  GitCompareArrows,
  X,
} from "lucide-react";
import { cities, featuredCorridors, resolveCity } from "../data/eastCoast";
import { agencies } from "../data/agencies";
import type { Agency } from "../types";
import { planTrips } from "../data/tripLookup";
import { shiftSampleTimelines, sortTrips } from "../data/tripUtils";
import { CorridorMap } from "../components/search/CorridorMap";
import { SearchForm } from "../components/search/SearchForm";
import { RouteCard } from "../components/search/RouteCard";
import { RouteComparison } from "../components/search/RouteComparison";
import { IconTooltip } from "../components/ui/icon-tooltip";

/**
 * Operators named in the sample routes, shown as plain text badges. These are
 * not official logos; OneLine is not affiliated with any operator.
 */
const networkOperators: { id: Agency; label: string }[] = [
  { id: "SEPTA", label: "SEPTA" },
  { id: "NJ_TRANSIT", label: "NJ TRANSIT" },
  { id: "AMTRAK", label: "Amtrak" },
  { id: "LIRR", label: "LIRR" },
  { id: "GREYHOUND", label: "Greyhound" },
  { id: "FLIXBUS", label: "FlixBus" },
];

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const criteria = readSearchState(searchParams);
  const query = { origin: criteria.origin, destination: criteria.destination };
  const { order, includeAmtrak, mode, operator } = criteria;
  const searched = searchParams.has("from") || searchParams.has("to");
  const hasPlanningPreference = searchParams.has("date") || searchParams.has("time");
  function updateCriteria(patch: Partial<SearchState>) {
    // History updates before React commits navigation; read it so rapid filter changes compose.
    const current = new URLSearchParams(window.location.search);
    setSearchParams(
      writeSearchState({ ...readSearchState(current), ...patch }, current),
    );
  }
  const setOrder = (order: string) => updateCriteria({ order });
  const setMode = (mode: string) => updateCriteria({ mode });
  const setOperator = (operator: string) => updateCriteria({ operator });
  const setIncludeAmtrak = (includeAmtrak: boolean) =>
    updateCriteria({ includeAmtrak });
  const [formVersion, setFormVersion] = useState(0);
  const resultsRef = useRef<HTMLElement>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const searchKey = searchParams.toString();
  useEffect(() => {
    setCompareIds([]);
    setCompareOpen(false);
  }, [searchKey]);
  const matches = useMemo(
    () => {
      const plannedTrips = planTrips(query.origin, query.destination);
      return hasPlanningPreference
        ? shiftSampleTimelines(plannedTrips, criteria.departureDate, criteria.departureTime)
        : plannedTrips;
    },
    [query.origin, query.destination, criteria.departureDate, criteria.departureTime, hasPlanningPreference],
  );
  const trips = sortTrips(
    matches.filter(
      (trip) =>
        (includeAmtrak || trip.legs.every((leg) => leg.agency !== "AMTRAK")) &&
        (mode === "all" ||
          (mode === "rail"
            ? trip.legs.every((leg) => agencies[leg.agency].mode === "rail")
            : mode === "bus"
              ? trip.legs.every((leg) => agencies[leg.agency].mode === "bus")
              : new Set(trip.legs.map((leg) => agencies[leg.agency].mode))
                  .size > 1)) &&
        (operator === "all" ||
          trip.legs.some((leg) => leg.agency === operator)),
    ),
    order,
  );
  const comparedTrips = trips.filter((trip) => compareIds.includes(trip.id));
  function toggleCompare(id: string) {
    setCompareIds((ids) =>
      ids.includes(id)
        ? ids.filter((value) => value !== id)
        : [...ids, id].slice(-2),
    );
  }
  function search(
    origin: string,
    destination: string,
    preferences: Pick<SearchState, "departureDate" | "departureTime">,
  ) {
    // Form and corridor searches both start from unfiltered results.
    updateCriteria(newSearchPatch(origin, destination, preferences));
    setFormVersion((version) => version + 1);
    setCompareIds([]);
    setCompareOpen(false);
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
      resultsRef.current?.focus({ preventScroll: true });
    }, 0);
  }
  return (
    <main className="search-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="little-dot" />
            EAST COAST RAIL AND BUS TRIP PLANNER
          </span>
          <h1>
            Plan trips that
            <br />
            cross{" "}
            <span>
              operators.
              <svg
                viewBox="0 0 420 24"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M4 15Q180-2 414 8M70 22Q230 9 363 18" />
              </svg>
            </span>
          </h1>
          <p>
            Every leg of your trip on one page.
            <br className="desktop-break" /> You buy tickets from each operator
            directly.
          </p>
          <div className="hero-meta">
            <span>
              <Route size={16} />
              {cities.length} sample cities
            </span>
            <i />
            <span>
              <Leaf size={16} />
              Rail and intercity bus
            </span>
          </div>
        </div>
        <CorridorMap />
      </section>
      <RouteComparison
        trips={comparedTrips}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        planningPreferences={hasPlanningPreference ? {
          departureDate: criteria.departureDate,
          departureTime: criteria.departureTime,
        } : undefined}
      />
      {comparedTrips.length > 0 && (
        <div
          className="compare-tray"
          role="region"
          aria-label="Selected routes for comparison"
        >
          <div>
            <GitCompareArrows size={20} />
            <span>
              <strong>{comparedTrips.length} of 2 routes selected</strong>
              <small>
                {comparedTrips.length < 2
                  ? "Select one more route to compare."
                  : "Ready to compare."}
              </small>
            </span>
          </div>
          <button
            className="compare-tray-action"
            disabled={comparedTrips.length !== 2}
            onClick={(event) => {
              // Safari does not focus buttons on click; focus the opener so
              // RouteComparison returns focus here when the dialog closes.
              event.currentTarget.focus();
              setCompareOpen(true);
            }}
          >
            Compare routes <ArrowRight size={15} />
          </button>
          <IconTooltip label="Clear comparison" side="top">
            <button
              className="compare-tray-clear"
              onClick={() => {
                setCompareIds([]);
                setCompareOpen(false);
              }}
              aria-label="Clear comparison"
            >
              <X size={18} />
            </button>
          </IconTooltip>
        </div>
      )}
      <div className="content-wrap">
        <SearchForm
          key={JSON.stringify([formVersion, query.origin, query.destination, criteria.departureDate, criteria.departureTime])}
          initialOrigin={query.origin}
          initialDestination={query.destination}
          initialDepartureDate={criteria.departureDate}
          initialDepartureTime={criteria.departureTime}
          onSearch={search}
        />
        <section className="coast-explorer" aria-labelledby="explore-title">
          <div className="explore-heading">
            <div>
              <span className="eyebrow">SAMPLE CORRIDORS</span>
              <h2 id="explore-title">Try another corridor.</h2>
              <p>
                {cities.length} cities from Maine to Florida. Pick a corridor to
                load its sample rail and bus trips.
              </p>
            </div>
            <span className="coverage-tag">
              SAMPLE NETWORK · NOT LIVE ROUTING
            </span>
          </div>
          <div className="corridor-grid">
            {featuredCorridors.map((corridor) => (
              <button
                key={corridor.origin}
                className="corridor-pick"
                onClick={() => {
                  search(corridor.origin, corridor.destination, {
                    departureDate: criteria.departureDate,
                    departureTime: criteria.departureTime,
                  });
                }}
              >
                <span>{corridor.region}</span>
                <strong>
                  {corridor.origin} <ArrowRight size={16} />{" "}
                  {corridor.destination}
                </strong>
                <small>
                  {corridor.label} <ArrowUpRight size={14} />
                </small>
              </button>
            ))}
          </div>
          <details className="coverage-details">
            <summary>
              See all {cities.length} cities and coverage limits
            </summary>
            <p>
              {cities.map((city) => `${city.name} (${city.state})`).join(" · ")}
            </p>
            <p>
              City-level concepts only. Operator coverage, actual terminals,
              station transfers, service dates, schedules and fares must be
              confirmed. This catalogue is not complete East Coast transit
              coverage.
            </p>
          </details>
        </section>
        <section className="network-strip" aria-label="Transit networks">
          <span>
            REAL OPERATORS.
            <br />
            <strong>SAMPLE CONNECTIONS.</strong>
          </span>
          {networkOperators.map(({ id, label }) => {
            const operator = agencies[id];
            const Icon = operator.mode === "bus" ? Bus : TrainFront;
            return (
              <div
                key={id}
                className="network-wordmark"
                style={{ "--agency-color": operator.color } as CSSProperties}
              >
                <Icon size={16} aria-hidden="true" focusable="false" />
                {label === operator.name ? (
                  label
                ) : (
                  <>
                    <span aria-hidden="true">{label}</span>
                    <span className="network-wordmark-sr">{operator.name}</span>
                  </>
                )}
              </div>
            );
          })}
        </section>
        <section
          className="results-section"
          id="routes"
          ref={resultsRef}
          tabIndex={-1}
          aria-labelledby="results-title"
        >
          <div className="results-heading">
            <div>
              <span className="eyebrow">RESULTS</span>
              <h2 id="results-title">
                Sample routes<span>.</span>
              </h2>
              <p aria-live="polite" role="status">
                {searched
                  ? `${trips.length} sample ${trips.length === 1 ? "connection" : "connections"} for ${query.origin} → ${query.destination}`
                  : "Showing the demo search: Philadelphia to Stony Brook."}
              </p>
            </div>
            <div className="sort-control">
              <label htmlFor="sort">SORT BY</label>
              <select
                id="sort"
                value={order}
                onChange={(event) => setOrder(event.target.value)}
              >
                <option value="recommended">Recommended</option>
                <option value="fastest">Fastest</option>
                <option value="fare">Lowest sample fare</option>
              </select>
            </div>
          </div>
          <div className="results-grid">
            <div className="route-list">
              <div
                className="transport-filters"
                aria-label="Filter transportation"
              >
                <div role="group" aria-label="Travel mode">
                  {[
                    ["all", "All transport"],
                    ["rail", "Rail only"],
                    ["bus", "Bus only"],
                    ["mixed", "Rail + bus"],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      aria-pressed={mode === value}
                      onClick={() => {
                        setMode(value);
                        setCompareIds([]);
                        setCompareOpen(false);
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <label>
                  OPERATOR{" "}
                  <select
                    value={operator}
                    onChange={(event) => {
                      setOperator(event.target.value);
                      setCompareIds([]);
                      setCompareOpen(false);
                    }}
                  >
                    <option value="all">All operators</option>
                    {Object.entries(agencies).map(([id, agency]) => (
                      <option key={id} value={id}>
                        {agency.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="results-toolbar">
                <span>
                  <span className="little-dot" />
                  {trips.length} sample options
                </span>
                <label className="amtrak-toggle">
                  <input
                    type="checkbox"
                    checked={includeAmtrak}
                    onChange={(event) => {
                      setIncludeAmtrak(event.target.checked);
                      setCompareIds([]);
                      setCompareOpen(false);
                    }}
                  />
                  Include Amtrak
                </label>
              </div>
              {trips.length > 1 && (
                <button
                  className="compare-shortcut"
                  onClick={() => {
                    setCompareIds(trips.slice(0, 2).map((trip) => trip.id));
                    setCompareOpen(true);
                  }}
                >
                  <GitCompareArrows size={15} />
                  Compare the first two <ArrowRight size={14} />
                </button>
              )}
              {trips.length > 0 ? (
                trips.map((trip, index) => (
                  <RouteCard
                    key={trip.id}
                    trip={trip}
                    index={index}
                    comparing={compareIds.includes(trip.id)}
                    onCompare={() => toggleCompare(trip.id)}
                    planningPreferences={hasPlanningPreference ? {
                      departureDate: criteria.departureDate,
                      departureTime: criteria.departureTime,
                    } : undefined}
                  />
                ))
              ) : (
                <div className="empty-state">
                  <Compass size={34} />
                  <h3>No sample journeys match this search.</h3>
                  <p>
                    {!resolveCity(query.origin) ||
                    !resolveCity(query.destination)
                      ? "Choose cities from our East Coast catalogue, or check actual services directly with the operators."
                      : resolveCity(query.origin)?.id ===
                          resolveCity(query.destination)?.id
                        ? "Choose two different cities to plan a journey."
                        : "Try another mode or operator. A missing sample doesn’t mean there’s no real service."}
                  </p>
                  <button
                    onClick={() => {
                      updateCriteria(defaultSearch);
                      setFormVersion((version) => version + 1);
                    }}
                  >
                    Show demo routes <ArrowRight size={16} />
                  </button>
                </div>
              )}
              <p className="results-disclaimer">
                <ShieldCheck size={15} />
                <span>
                  All times and fares shown are illustrative. Confirm your trip
                  with each agency before you travel. Bus routes and the
                  expanded rail routes are city-level concepts, not verified
                  services.
                </span>
              </p>
            </div>
            <aside className="journey-aside">
              <div className="aside-card">
                <span className="aside-icon">
                  <Layers3 size={23} />
                </span>
                <span className="eyebrow">WHY WE BUILT IT</span>
                <h3>
                  Every leg{" "}
                  <br />
                  on one page.
                </h3>
                <p>
                  Philadelphia to Stony Brook by train can mean SEPTA, NJ
                  TRANSIT and LIRR, each with its own app. OneLine lists the
                  legs, the transfers, and where to buy each ticket.
                </p>
                <ul>
                  <li>
                    <Check size={15} />
                    Times for each leg
                  </li>
                  <li>
                    <Check size={15} />
                    Where you change services
                  </li>
                  <li>
                    <Check size={15} />
                    Links to official ticket sites
                  </li>
                </ul>
                <div className="aside-mini-line">
                  <i />
                  <span />
                  <i />
                  <span />
                  <i />
                  <ArrowRight size={15} />
                </div>
                <span className="aside-signoff">
                  You still buy tickets
                  <br />
                  <strong>from each operator.</strong>
                </span>
              </div>
              <div className="demo-note">
                <Sparkles size={18} />
                <div>
                  <strong>Hackathon prototype</strong>
                  <p>
                    Built by a student team at SBUHacks 2026. The operators are
                    real; the trips are samples.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
        <section className="closing-banner">
          <div>
            <span className="eyebrow">ANOTHER TRIP?</span>
            <h2>
              Planning something else?
              <br />
              Start a new search.
            </h2>
          </div>
          <a href="#main-content" aria-label="Back to search">
            Back to search <ArrowUpRight size={22} />
          </a>
          <div className="banner-rails" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </section>
      </div>
    </main>
  );
}
