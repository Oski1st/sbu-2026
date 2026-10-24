import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { demoTrips } from "../../data/demoTrips";
import { formatDuration } from "../../data/tripUtils";
import JourneyPage from "../../pages/JourneyPage";
import { SegmentCard } from "./SegmentCard";

function journeyMarkup(tripId: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/journey/${tripId}`]}>
      <Routes>
        <Route path="/journey/:tripId" element={<JourneyPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("Journey layout for expanded concept routes", () => {
  test("formats a multi-day total with the shared duration formatter", () => {
    const trip = demoTrips.find((candidate) => candidate.id === "east-portland--miami--amtrak")!;
    const html = journeyMarkup(trip.id);

    expect(html).toContain(`${formatDuration(trip.durationMinutes)} total`);
    expect(html).not.toContain(`${trip.durationMinutes} min total`);
  });

  test("stacks station names and ISO timestamps before the small breakpoint", () => {
    const trip = demoTrips.find((candidate) => candidate.id === "east-portland--miami--amtrak")!;
    const washingtonLeg = trip.legs.find((leg) => leg.from === "Washington, DC")!;
    const html = renderToStaticMarkup(
      <SegmentCard leg={washingtonLeg} index={0} isExpanded={false} isDelayed={false} isCurrent={false} onToggle={() => {}} />,
    );

    expect(html).toContain("grid-cols-1");
    expect(html).toContain("sm:grid-cols-[minmax(0,1fr)_auto]");
    expect(html).toContain("text-left text-base font-bold tabular-nums text-slate-900 sm:text-right");
    expect(html).toContain("Washington, DC");
    expect(html).toContain("· Oct");
  });
});
