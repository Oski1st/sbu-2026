import { lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import SearchPage from "./pages/SearchPage";
import { AppLayout } from "./components/layout/AppLayout";
import { TripProvider } from "./components/layout/TripContext";
import { IntegrationPage } from "./components/layout/IntegrationPage";
// Teammate-owned pages are optional until their PRs merge. No files are created in their paths.
// Both default exports and named JourneyPage/WalletPage exports are accepted.
const modules = import.meta.glob<{
  default?: ComponentType;
  JourneyPage?: ComponentType;
  WalletPage?: ComponentType;
}>("./pages/{JourneyPage,WalletPage}.tsx");
function page(kind: "journey" | "wallet") {
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
function NavigationEffects() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
    document.title = `OneLine · ${location.pathname.startsWith("/journey") ? "Your journey" : location.pathname.startsWith("/wallet") ? "Your wallet" : "A better way there"}`;
    document.getElementById("main-content")?.focus({ preventScroll: true });
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
            <Route index element={<SearchPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route path="journey" element={<Journey />} />
            <Route path="journey/:tripId" element={<Journey />} />
            <Route path="wallet" element={<Wallet />} />
            <Route
              path="*"
              element={
                <div className="empty-state">
                  <h1>A little off the line.</h1>
                  <p>Let’s get you back on track.</p>
                  <Link to="/">Return to search</Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </TripProvider>
  );
}
