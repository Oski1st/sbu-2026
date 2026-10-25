import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { clearRoutingCacheForTests } from "../../data/tripLookup";
import JourneyPage from "../../pages/JourneyPage";

function journeyAt(id: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/journey/${id}?trip=regional-connection`]}>
      <Routes>
        <Route path="/journey/:tripId" element={<JourneyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Journey deterministic lookup", () => {
  it("opens a multi-day east ID without a preceding search or populated cache", () => {
    clearRoutingCacheForTests();
    const id = "east-portland--miami--amtrak";
    const html = journeyAt(id);
    expect(html).toContain("Portland");
    expect(html).toContain("Miami");
    expect(html).toContain(`href="/wallet/${id}"`);
    expect(html).not.toContain("Journey not found");
  });

  it("keeps an unsupported east ID invalid despite a valid legacy query", () => {
    clearRoutingCacheForTests();
    const html = journeyAt("east-unknown--miami--amtrak");
    expect(html).toContain("Journey not found");
    expect(html).not.toContain('href="/wallet/regional-connection"');
  });
});
