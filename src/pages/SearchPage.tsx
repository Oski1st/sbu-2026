import { useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Compass,
  Layers3,
  Leaf,
  MoveUpRight,
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
import { demoTrips } from "../data/demoTrips";
import { findTrips, sortTrips } from "../data/tripUtils";
import { CorridorMap } from "../components/search/CorridorMap";
import { SearchForm } from "../components/search/SearchForm";
import { RouteCard } from "../components/search/RouteCard";
import { RouteComparison } from "../components/search/RouteComparison";
export default function SearchPage() {
  const [query, setQuery] = useState({
    origin: "Philadelphia",
    destination: "Stony Brook",
  });
  const [order, setOrder] = useState("recommended");
  const [includeAmtrak, setIncludeAmtrak] = useState(true);
  const [mode, setMode] = useState("all");
  const [operator, setOperator] = useState("all");
  const [searched, setSearched] = useState(false);
  const [formVersion, setFormVersion] = useState(0);
  const resultsRef = useRef<HTMLElement>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const matches = findTrips(demoTrips, query.origin, query.destination);
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
  function search(origin: string, destination: string) {
    setQuery({ origin: origin.trim(), destination: destination.trim() });
    setSearched(true);
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
            ALL YOUR CONNECTIONS. ONE CLEAR PATH.
          </span>
          <h1>
            Different lines.
            <br />
            Same{" "}
            <span>
              direction.
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
            From your first departure to your last stop.
            <br className="desktop-break" /> A simpler way to travel across the
            East Coast.
          </p>
          <div className="hero-meta">
            <span>
              <Route size={16} />
              {cities.length} cities, one bigger idea
            </span>
            <i />
            <span>
              <Leaf size={16} />
              Trains + coaches. More possibility.
            </span>
          </div>
        </div>
        <CorridorMap />
      </section>
      <RouteComparison
        trips={comparedTrips}
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
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
                  : "A clearer view of your options."}
              </small>
            </span>
          </div>
          <button
            className="compare-tray-action"
            disabled={comparedTrips.length !== 2}
            onClick={() => setCompareOpen(true)}
          >
            Compare routes <ArrowRight size={15} />
          </button>
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
        </div>
      )}
      <div className="content-wrap">
        <SearchForm
          key={formVersion}
          initialOrigin={query.origin}
          initialDestination={query.destination}
          onSearch={search}
        />
        <section className="coast-explorer" aria-labelledby="explore-title">
          <div className="explore-heading">
            <div>
              <span className="eyebrow">A BIGGER PICTURE</span>
              <h2 id="explore-title">A whole coast of possibilities.</h2>
              <p>
                {cities.length} cities, Maine to Florida. Explore sample rail
                and coach corridors.
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
                  setMode("all");
                  setOperator("all");
                  setIncludeAmtrak(true);
                  setFormVersion((v) => v + 1);
                  search(corridor.origin, corridor.destination);
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
          <div className="network-wordmark septa">
            <TrainFront size={22} />
            SEPTA
          </div>
          <div className="network-wordmark njt">
            <span>◢</span>NJ TRANSIT
          </div>
          <div className="network-wordmark amtrak">
            <MoveUpRight size={25} />
            AMTRAK<small>®</small>
          </div>
          <div className="network-wordmark lirr">
            <span>MTA</span>Long Island
            <br />
            Rail Road
          </div>
          <div className="network-wordmark">
            <Bus size={22} /> Greyhound
          </div>
          <div className="network-wordmark flixbus">
            <Bus size={22} /> FlixBus
          </div>
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
              <span className="eyebrow">THE JOURNEY STARTS HERE</span>
              <h2 id="results-title">
                A few ways to get there<span>.</span>
              </h2>
              <p aria-live="polite" role="status">
                {searched
                  ? `${trips.length} sample ${trips.length === 1 ? "connection" : "connections"} for ${query.origin} → ${query.destination}`
                  : "Philadelphia to Stony Brook. Every connection, considered."}
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
                  Compare two options <ArrowRight size={14} />
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
                        : "Try another mode or operator. No matching sample is not evidence that real service is unavailable."}
                  </p>
                  <button
                    onClick={() => {
                      setQuery({
                        origin: "Philadelphia",
                        destination: "Stony Brook",
                      });
                      setIncludeAmtrak(true);
                      setMode("all");
                      setOperator("all");
                      setSearched(false);
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
                  Designed for clarity, not guesswork. All displayed times and
                  fares are illustrative. Confirm your trip with the agencies
                  before traveling. Bus and expanded rail routes are city-level
                  concepts, not verified services.
                </span>
              </p>
            </div>
            <aside className="journey-aside">
              <div className="aside-card">
                <span className="aside-icon">
                  <Layers3 size={23} />
                </span>
                <span className="eyebrow">LESS TAB-HOPPING.</span>
                <h3>
                  Your whole trip.
                  <br />
                  Finally together.
                </h3>
                <p>
                  More operators shouldn’t mean more scattered plans. See the
                  connections, compare your options, and know what comes next.
                </p>
                <ul>
                  <li>
                    <Check size={15} />
                    Every leg in one place
                  </li>
                  <li>
                    <Check size={15} />
                    Clear transfer points
                  </li>
                  <li>
                    <Check size={15} />
                    Official ticket links
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
                  A little less friction.
                  <br />
                  <strong>A lot more adventure.</strong>
                </span>
              </div>
              <div className="demo-note">
                <Sparkles size={18} />
                <div>
                  <strong>A glimpse of what’s next</strong>
                  <p>
                    Built at SBUHacks 2026. Real networks, sample journeys, one
                    connected idea.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
        <section className="closing-banner">
          <div>
            <span className="eyebrow">TAKE THE CONNECTED ROUTE</span>
            <h2>
              The best part?
              <br />
              You’re already on your way.
            </h2>
          </div>
          <a href="#main-content" aria-label="Back to search">
            Let’s go somewhere <ArrowUpRight size={22} />
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
