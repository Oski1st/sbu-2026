import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { getTripById } from "../../data/tripLookup";
import SearchPage from "../../pages/SearchPage";
import { ShareTripButton } from "./ShareTripButton";

const fixture = vi.hoisted(() => ({ status: "idle" }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(initial === "idle" ? fixture.status : initial) };
});
afterEach(() => { fixture.status = "idle"; vi.unstubAllGlobals(); });
const trip = getTripById("amtrak-connection")!;
const render = () => renderToStaticMarkup(<ShareTripButton trip={trip} />);

describe("share-link rendering resilience", () => {
  it("renders the share control and Search without browser globals", () => {
    vi.stubGlobal("window", undefined);
    expect(render()).toContain("Share route");
    const html = renderToStaticMarkup(<MemoryRouter><SearchPage /></MemoryRouter>);
    expect(html).toContain("Share route");
    expect(html).toContain('href="/journey/amtrak-connection"');
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])("keeps local preview labeling for %s", (hostname) => {
    vi.stubGlobal("window", { location: { hostname } });
    expect(render()).toContain("Copy preview link");
  });

  it.each(["idle", "copied", "manual"])("includes the actual visible button text in its name in %s state", (status) => {
    fixture.status = status;
    vi.stubGlobal("window", { location: { hostname: "oneline.example" } });
    const html = render();
    const label = html.match(/aria-label="([^"]+)"/)?.[1];
    expect(label).toContain(status === "copied" ? "Link copied" : "Share route");
    expect(label).toContain("for");
    if (status !== "idle") {
      expect(html).toContain('type="button" aria-label="Dismiss link message"');
      expect(html).toContain('role="status"');
    }
    if (status === "manual") expect(html).toContain('aria-label="Journey link"');
  });
});
