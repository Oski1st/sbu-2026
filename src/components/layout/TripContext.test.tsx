import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { TripProvider } from "./TripContext";
import { AppLayout } from "./AppLayout";

function navigationAt(url: string, kind: "journey" | "wallet") {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <TripProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path={`${kind}/:tripId?`} element={<main>Trip content</main>} />
          </Route>
        </Routes>
      </TripProvider>
    </MemoryRouter>,
  );
}

describe("shared navigation trip selection", () => {
  for (const kind of ["journey", "wallet"] as const) {
    it(`keeps ${kind} navigation on the canonical trip when a legacy query conflicts`, () => {
      const html = navigationAt(`/${kind}/regional-connection?trip=amtrak-connection`, kind);
      expect(html).toContain('href="/journey/regional-connection"');
      expect(html).toContain('href="/wallet/regional-connection"');
      expect(html).not.toContain('href="/wallet/amtrak-connection"');
    });

    it(`preserves legacy query selection on the ${kind} entry route`, () => {
      const html = navigationAt(`/${kind}?trip=amtrak-connection`, kind);
      expect(html).toContain('href="/journey/amtrak-connection"');
      expect(html).toContain('href="/wallet/amtrak-connection"');
    });

    it(`does not replace an invalid canonical ${kind} ID with a different query trip`, () => {
      const html = navigationAt(`/${kind}/missing-trip?trip=amtrak-connection`, kind);
      expect(html).toContain('href="/journey"');
      expect(html).toContain('href="/wallet"');
      expect(html).not.toContain('href="/wallet/amtrak-connection"');
    });
  }
});
