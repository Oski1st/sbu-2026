import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = { children: ReactNode; resetKey: string };
type State = { failed: boolean };

/**
 * Keeps the header, navigation and footer usable when a page fails to render, most often because
 * a lazily loaded page chunk could not be fetched (offline, or an open tab after a redeploy).
 * The error clears when resetKey (the pathname) changes, so navigating elsewhere starts fresh
 * without remounting the page on every navigation.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidUpdate(previous: Props) {
    if (this.state.failed && previous.resetKey !== this.props.resetKey)
      this.setState({ failed: false });
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.warn("OneLine page failed to load", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="empty-state" role="alert">
        <h1>This page didn’t load.</h1>
        <p>Check your connection, then try again.</p>
        {/* A reload is required: React.lazy keeps a failed chunk import cached. */}
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
        <Link to="/">Return to search</Link>
      </main>
    );
  }
}
