import { Suspense } from "react";
import { NavLink, Link, Outlet } from "react-router-dom";
import { ArrowUpRight, MoveRight, Search, Route, Wallet } from "lucide-react";
import { useSelectedTrip } from "./TripContext";
import { Brand } from "./Brand";
export function AppLayout() {
  const { selectedTrip } = useSelectedTrip();
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
          Less switching. More going.
        </span>
      </header>
      <div id="main-content" tabIndex={-1}>
        <Suspense
          fallback={
            <main className="page-loading" role="status">
              Connecting your journey…
            </main>
          }
        >
          <Outlet />
        </Suspense>
      </div>
      <footer className="site-footer">
        <div>
          <Link to="/" aria-label="OneLine home">
            <Brand />
          </Link>
          <p>A better way there.</p>
        </div>
        <span>
          Made for the in-between.
          <br />
          <small>SBUHacks 2026 · Independent student project</small>
        </span>
        <a
          href="https://github.com/Oski1st/sbu-2026"
          target="_blank"
          rel="noreferrer"
        >
          Built together <ArrowUpRight size={16} />
        </a>
        <div className="footer-line">
          <MoveRight size={19} />
          <span>One journey. Many connections.</span>
          <small>Sample itineraries · No live arrival data</small>
        </div>
      </footer>
    </div>
  );
}
