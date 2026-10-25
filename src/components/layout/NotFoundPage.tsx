import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";

/** Unknown paths keep the app shell and offer a clear way home. */
export function NotFoundPage() {
  const { pathname } = useLocation();
  // Runs after the shared route-title effect, so unknown paths are not titled as Search.
  useEffect(() => {
    document.title = "OneLine · Page not found";
  }, [pathname]);
  return (
    <main className="empty-state">
      <h1>A little off the line.</h1>
      <p>Let’s get you back on track.</p>
      <Link to="/">Return to search</Link>
    </main>
  );
}
