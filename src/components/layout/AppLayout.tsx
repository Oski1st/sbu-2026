import { Suspense } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { MoveRight, Search, Route, Wallet } from "lucide-react";
import { useSelectedTrip } from "./TripContext";
import { Brand } from "./Brand";
import { RouteErrorBoundary } from "./RouteErrorBoundary";
export function AppLayout() {
  const { selectedTrip } = useSelectedTrip();
  const { pathname } = useLocation();
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link to="/" aria-label="OneLine home">
          <Brand />
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            <Search size={15} />
            Search
          </NavLink>
          <NavLink
            to={selectedTrip ? `/journey/${selectedTrip.id}` : "/journey"}
          >
            <Route size={15} />
            Journey
          </NavLink>
          <NavLink to={selectedTrip ? `/wallet/${selectedTrip.id}` : "/wallet"}>
            <Wallet size={15} />
            Wallet
          </NavLink>
        </nav>
        <span className="header-note">
          <span className="little-dot" />
          Prototype · sample trips
        </span>
      </header>
      <div id="main-content" tabIndex={-1}>
        <Suspense
          fallback={
            // Reserve a viewport of height so the footer does not jump when a lazy page arrives.
            <main
              className="page-loading"
              role="status"
              style={{ minHeight: "100vh" }}
            >
              Loading…
            </main>
          }
        >
          <RouteErrorBoundary resetKey={pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </Suspense>
      </div>
      <footer className="site-footer">
        <div>
          <Link to="/" aria-label="OneLine home">
            <Brand />
          </Link>
          <p>Trip planning across transit operators.</p>
        </div>
        <span>
          For trips with transfers.
          <br />
          <small>SBUHacks 2026 · Independent student project</small>
        </span>
        <p className="footer-credit">Built together</p>
        <div className="footer-line">
          <MoveRight size={19} />
          <span>Not affiliated with any transit operator.</span>
          <small>Sample itineraries · Live data limited to labelled SEPTA snapshots</small>
        </div>
      </footer>
    </div>
  );
}
