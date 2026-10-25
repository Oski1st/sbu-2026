import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { Navigate, Link, Route, Routes, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import SearchPage from "./pages/SearchPage";
import TimetableSearchPage from "./pages/TimetableSearchPage";
const ScheduledJourney = lazy(() => import("./pages/ScheduledJourneyPage"));
import { AppLayout } from "./components/layout/AppLayout";
import { TripProvider, useSelectedTrip } from "./components/layout/TripContext";
import { IntegrationPage } from "./components/layout/IntegrationPage";
// Teammate-owned pages are optional until their PRs merge. No files are created in their paths.
// Both default exports and named JourneyPage/WalletPage exports are accepted.
type HostedPageProps = { septaEndpoint?: string };
const modules = import.meta.glob<{
  default?: ComponentType<HostedPageProps>;
  JourneyPage?: ComponentType<HostedPageProps>;
  WalletPage?: ComponentType<HostedPageProps>;
}>("./pages/{JourneyPage,WalletPage}.tsx");
function page(kind: "journey" | "wallet"): ComponentType<HostedPageProps> {
  const name = kind === "journey" ? "JourneyPage" : "WalletPage";
  const load = modules[`./pages/${name}.tsx`];
  return load
    ? lazy(async () => {
        const module = await load();
        const component = module.default ?? module[name];
        if (!component)
          throw new Error(`${name} must export a React component.`);
        return { default: component };
      })
    : () => <IntegrationPage kind={kind} />;
}
const Journey = page("journey"),
  Wallet = page("wallet");
// Wallet intentionally renders a div; the host supplies its page landmark.
function WalletRoute() {
  const content = <Wallet septaEndpoint="/api/transit/septa/trains" />;
  return modules["./pages/WalletPage.tsx"] ? <main>{content}</main> : content;
}
function SelectionEntry({ kind }: { kind: "journey" | "wallet" }) {
  const { selectedTrip } = useSelectedTrip();
  return selectedTrip ? (
    <Navigate to={`/${kind}/${selectedTrip.id}`} replace />
  ) : (
    <IntegrationPage kind={kind} />
  );
}
function NavigationEffects() {
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    document.title = `OneLine · ${location.pathname.startsWith("/journey") ? "Your journey" : location.pathname.startsWith("/wallet") ? "Your wallet" : "A better way there"}`;
    if (previousPath.current !== location.pathname) {
      previousPath.current = location.pathname;
      window.scrollTo({ top: 0 });
      document.getElementById("main-content")?.focus({ preventScroll: true });
    }
  }, [location.pathname]);
  return null;
}
export default function App() {
  return (
    <TripProvider>
      <NavigationEffects />
      <Suspense
        fallback={
          <div className="page-loading" role="status">
            Connecting your journey…
          </div>
        }
      >
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<TimetableSearchPage />} />
            <Route path="demo" element={<SearchPage />} />
            <Route path="itinerary/:id" element={<ScheduledJourney />} />
            <Route path="search" element={<TimetableSearchPage />} />
            <Route path="journey" element={<SelectionEntry kind="journey" />} />
            <Route path="journey/:tripId" element={<Journey />} />
            <Route path="wallet" element={<SelectionEntry kind="wallet" />} />
            <Route path="wallet/:tripId" element={<WalletRoute />} />
            <Route
              path="*"
              element={
                <main className="empty-state">
                  <h1>A little off the line.</h1>
                  <p>Let’s get you back on track.</p>
                  <Link to="/">Return to search</Link>
                </main>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </TripProvider>
  );
}
