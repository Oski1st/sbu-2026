import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { getTripById } from "../../data/tripLookup";
import SearchPage from "../../pages/SearchPage";
import JourneyPage from "../../pages/JourneyPage";
import WalletPage from "../../pages/WalletPage";
import { AppLayout } from "../layout/AppLayout";
import { IntegrationPage } from "../layout/IntegrationPage";
import { CorridorMap } from "../search/CorridorMap";
import { RouteCard } from "../search/RouteCard";

// SSR cannot click disclosure buttons. Expand only this isolated RouteCard fixture
// through its initial state; production props/state and dependencies stay unchanged.
const fixture = vi.hoisted(() => ({ expandDisclosures: false }));
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => actual.useState(fixture.expandDisclosures && initial === false ? true : initial) };
});

afterEach(() => { fixture.expandDisclosures = false; vi.unstubAllGlobals(); });

function textContent(html: string) {
  return html.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<([a-z][\w:-]*)\b[^>]*\baria-hidden="true"[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]*>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'")
    .replace(/\s+/g, " ").trim();
}

/** Focused SSR name check for these text/aria-label links, not a browser/AT audit. */
function newTabLinks(html: string) {
  return [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
    .filter(([, attributes]) => /\btarget="_blank"/.test(attributes))
    .map(([, attributes, content]) => {
      // These fixtures use content or aria-label, not aria-labelledby references.
      expect(attributes).not.toContain("aria-labelledby");
      const label = attributes.match(/\baria-label="([^"]*)"/)?.[1];
      return { name: label === undefined ? textContent(content) : textContent(label), content, attributes };
    });
}

function assertWarnings(html: string, minimum: number) {
  const links = newTabLinks(html);
  expect(links.length).toBeGreaterThanOrEqual(minimum); // No vacuous success on an empty render.
  for (const link of links) {
    expect(link.name, link.attributes).toContain("opens in a new tab");
    expect(link.content).toMatch(/class="(?:prm-|ol-)?sr-only"/);
    expect(link.content).toContain("opens in a new tab");
  }
  return links;
}

function pageMarkup(url: string) {
  vi.stubGlobal("window", { location: { hostname: "localhost" } });
  return renderToStaticMarkup(<MemoryRouter initialEntries={[url]}><Routes><Route element={<AppLayout />}>
    <Route path="/" element={<SearchPage />} />
    <Route path="/journey/:tripId" element={<JourneyPage />} />
    <Route path="/wallet/:tripId" element={<WalletPage />} />
  </Route></Routes></MemoryRouter>);
}

describe("P2-NEWTAB-K5 declared accessible names", () => {
  it("checks overriding aria-labels and rejects warnings hidden from assistive technology", () => {
    expect(newTabLinks('<a target="_blank" aria-label="No warning">Visible<span class="sr-only"> (opens in a new tab)</span></a>')[0].name).toBe("No warning");
    expect(newTabLinks('<a target="_blank">Visible<span aria-hidden="true"> (opens in a new tab)</span></a>')[0].name).toBe("Visible");
  });

  it("warns on every map-details link and disambiguates generic operator sources", () => {
    const html = renderToStaticMarkup(<CorridorMap />);
    const links = assertWarnings(html, 41);
    const sources = links.filter((link) => link.name.startsWith("Official source"));
    expect(sources).toHaveLength(3);
    expect(new Set(sources.map((link) => link.name)).size).toBe(sources.length);
    for (const operator of ["SEPTA", "NJ TRANSIT", "LIRR"]) expect(sources.some((link) => link.name.includes(operator))).toBe(true);
    expect(html).toContain("Floridian description names Chicago");
    expect(html).toContain("drawn only as far as the mapped source extent");
    expect(html).toContain("does not show the full Chicago corridor");
  });

  it("covers Search plus its shared footer, including closed map details", () => {
    const links = assertWarnings(pageMarkup("/?from=Philadelphia&to=Stony%20Brook"), 42);
    expect(links.some((link) => link.name.startsWith("Built together"))).toBe(true);
  });

  it("covers the expandable Search card links, including their overriding aria-labels", () => {
    fixture.expandDisclosures = true;
    vi.stubGlobal("window", { location: { hostname: "localhost" } });
    const trip = getTripById("regional-connection")!;
    const html = renderToStaticMarkup(<MemoryRouter><RouteCard trip={trip} index={0} comparing={false} onCompare={() => {}} /></MemoryRouter>);
    const links = assertWarnings(html, trip.legs.length);
    expect(links).toHaveLength(trip.legs.length);
    expect(new Set(links.map((link) => link.name)).size).toBe(links.length);
    expect(links[0].name).toContain("SEPTA official ticket information for segment 1");
    for (const link of links) expect(link.name).toContain("Agency site");
  });

  it.each(["regional-connection", "amtrak-connection", "east-portland--miami--flixbus"])("covers Journey and Wallet links for %s", (id) => {
    const trip = getTripById(id)!;
    const journey = assertWarnings(pageMarkup(`/journey/${id}`), trip.legs.length + 1);
    const wallet = assertWarnings(pageMarkup(`/wallet/${id}`), trip.legs.length + 1);
    const ticketLinks = journey.filter((link) => link.name.startsWith("Get tickets from"));
    expect(new Set(ticketLinks.map((link) => link.name)).size).toBe(ticketLinks.length);
    expect(wallet.some((link) => link.name.startsWith("Built together"))).toBe(true);
  });

  it("covers the fallback integration Wallet with distinct per-leg names", () => {
    const trip = getTripById("regional-connection")!;
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/wallet?trip=regional-connection"]}><IntegrationPage kind="wallet" /></MemoryRouter>);
    const links = assertWarnings(html, trip.legs.length);
    expect(new Set(links.map((link) => link.name)).size).toBe(links.length);
  });
});
