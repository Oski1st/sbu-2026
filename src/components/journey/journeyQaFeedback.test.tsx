import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Leg } from "../../types/transit";
import { getTripById } from "../../data/tripLookup";
import JourneyPage from "../../pages/JourneyPage";
import WalletPage from "../../pages/WalletPage";
import { SegmentCard } from "./SegmentCard";
import { SimulationFeedback } from "./SimulationFeedback";
import { TransferAssistant } from "./TransferAssistant";
import { JourneyDemoControls } from "./JourneyDemoControls";
import { restoreJourneyControlFocus } from "./journeyControlFocus";
import { assessSimulatedConnection, DEMO_TRANSFER_BUFFER_MINUTES } from "./journeySimulation";
import { displaySegmentTime } from "./journeyUtils";

const arriving: Leg = { id: "qa-arriving", agency: "AMTRAK", from: "Boston", to: "New York", line: "Sample rail",
  departure: "2026-10-24T18:00:00-04:00", arrival: "2026-10-24T23:55:00-04:00", purchaseUrl: "https://www.amtrak.com/" };
const next: Leg = { ...arriving, id: "qa-next", from: "New York", to: "Philadelphia", departure: "2026-10-25T00:55:00-04:00", arrival: "2026-10-25T02:00:00-04:00" };
const departureWithSlack = (minutes: number) => ({ ...next, departure: new Date(Date.parse(arriving.arrival) + minutes * 60_000).toISOString() });
const feedback = (nextLeg?: Leg, active = true) => renderToStaticMarkup(<SimulationFeedback affectedLeg={arriving} nextLeg={nextLeg} destination="Philadelphia" active={active} />);

describe("P5D-JOURNEY33 delay feedback (J2 / F6)", () => {
  it.each([[60, 48, "comfortable"], [22, 10, "comfortable"], [21, 9, "tight"], [12, 0, "tight"], [11, -1, "missed"]] as const)("assesses %i minutes planned without rounding a missed connection into tomorrow", (planned, remaining, status) => {
    expect(assessSimulatedConnection(arriving, departureWithSlack(planned))).toEqual({ plannedMinutes: planned, remainingMinutes: remaining, status });
  });

  it("does not claim valid connections when timestamps are invalid or out of order", () => {
    for (const departure of ["unknown", "2026-10-24T20:00:00-04:00"]) {
      expect(assessSimulatedConnection(arriving, { ...next, departure }).status).toBe("unknown");
      const html = feedback({ ...next, departure });
      expect(html).toContain("do not allow us to assess");
      expect(html).not.toContain("connection still works");
      expect(html).not.toContain("Simulated recovery plan");
    }
  });

  it("keeps the 60-minute connection viable with 48 minutes left and states the demo threshold", () => {
    const html = feedback(next);
    expect(html).toContain("connection still works in this sample: 48 min");
    expect(html).toContain(`${DEMO_TRANSFER_BUFFER_MINUTES}-minute demo buffer`);
    expect(html).toContain("not an official minimum transfer time");
    expect(html).not.toContain("Simulated recovery plan");
    const trip = getTripById("east-boston--miami--amtrak")!;
    expect(assessSimulatedConnection(trip.legs[0], trip.legs[1]).remainingMinutes).toBe(48);
  });

  it.each([21, 12, 11])("shows recovery only below the demo threshold (%i-minute planned transfer)", (planned) => {
    const html = feedback(departureWithSlack(planned));
    expect(html).toContain("Simulated recovery plan");
    expect(html).not.toContain("connection still works");
    expect(html).toContain(planned < 12 ? "after the planned next departure" : "below the 10-minute demo warning threshold");
  });

  it("reports the simulated destination arrival for a single leg, including midnight rollover", () => {
    const html = feedback();
    expect(html).toContain("Simulated delay: +12 min");
    expect(html).toContain('dateTime="2026-10-25T04:07:00.000Z"');
    expect(html).toContain("Oct 25");
    expect(html).toContain("no onward connection");
    expect(html).not.toContain("Simulated recovery plan");
  });

  it("returns feedback to original sample times after reset and mounts an atomic live region", () => {
    expect(feedback(next, false)).toContain("Simulation off. Original sample itinerary times are shown");
    expect(feedback(next, false)).not.toContain("Simulated delay:");
    const html = renderToStaticMarkup(<MemoryRouter initialEntries={["/journey/east-new-york--stony-brook--amtrak"]}><Routes><Route path="/journey/:tripId" element={<JourneyPage />} /></Routes></MemoryRouter>);
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
    expect(html).toContain("Simulation off");
  });
});

describe("Transfer and segment clarity (S4 / J3 / F8)", () => {
  it.each([false, true])("includes next departure date and instant even when simulated=%s", (isAffected) => {
    const html = renderToStaticMarkup(<TransferAssistant arrivingLeg={arriving} nextLeg={next} isAffected={isAffected} isCurrent={false} />);
    expect(html).toContain(`dateTime="${next.departure}"`);
    expect(html).toContain(displaySegmentTime(next.departure));
    expect(html).toContain("· Oct 25");
    if (isAffected) {
      expect(html).toContain("48 min remains");
      expect(html).not.toContain("border-amber-300");
    }
  });

  it("left-aligns both delayed times on narrow layouts, retaining desktop alignment", () => {
    const html = renderToStaticMarkup(<SegmentCard leg={arriving} index={0} isExpanded={false} isDelayed isCurrent={false} onToggle={() => {}} />);
    expect(html).toContain('class="flex flex-col items-start sm:items-end"');
    expect(html).toContain("Original sample arrival:");
    expect(html).toContain("Simulated arrival (+12 minutes):");
  });

  it("highlights only genuinely tight transfers as at risk and leaves unknown timing neutral", () => {
    const transfer = (nextLeg: Leg) => renderToStaticMarkup(<TransferAssistant arrivingLeg={arriving} nextLeg={nextLeg} isAffected isCurrent={false} />);
    expect(transfer(departureWithSlack(21))).toContain("border-amber-300");
    const unknown = transfer({ ...next, departure: "unknown" });
    expect(unknown).toContain("do not allow us to assess");
    expect(unknown).not.toContain("border-emerald-200");
    expect(unknown).not.toContain("border-amber-300");
  });

  it("explains merged coach stops and unknown rest breaks without inventing a schedule", () => {
    const trip = getTripById("east-portland--miami--flixbus")!;
    const html = renderToStaticMarkup(<SegmentCard leg={trip.legs[0]} index={0} isExpanded={false} isDelayed={false} isCurrent={false} onToggle={() => {}} />);
    expect(html).toContain("may merge several city-to-city sample stops");
    expect(html).toContain("rest breaks are not shown or verified");
    expect(html).toContain("not a claim of nonstop service");
    expect(renderToStaticMarkup(<SegmentCard leg={arriving} index={0} isExpanded={false} isDelayed={false} isCurrent={false} onToggle={() => {}} />)).not.toContain("Sample coach corridor");
  });
});

describe("Demo boundary focus retention (F1)", () => {
  const body = {};
  const button = (disabled: boolean) => ({ disabled, focus: vi.fn() });

  it("moves from disabled Next at the final step to enabled Previous", () => {
    const previous = button(false), next = button(true), start = button(false);
    restoreJourneyControlFocus(next, body, body, [previous, next, start]);
    expect(previous.focus).toHaveBeenCalledOnce();
    expect(next.focus).not.toHaveBeenCalled();
  });

  it("moves from disabled Previous at the first step to enabled Next", () => {
    const previous = button(true), next = button(false), start = button(false);
    restoreJourneyControlFocus(previous, previous, body, [previous, next, start]);
    expect(next.focus).toHaveBeenCalledOnce();
  });

  it("uses Start when reset/single-leg progression leaves both direction buttons disabled", () => {
    const previous = button(true), next = button(true), start = button(false);
    restoreJourneyControlFocus(previous, body, body, [previous, next, start]);
    expect(start.focus).toHaveBeenCalledOnce();
  });

  it("never steals focus from another control or when the current button remains enabled", () => {
    const focused = button(true), enabled = button(false);
    restoreJourneyControlFocus(focused, {}, body, [enabled]);
    restoreJourneyControlFocus(enabled, enabled, body, [enabled]);
    restoreJourneyControlFocus(null, body, body, [enabled]);
    expect(enabled.focus).not.toHaveBeenCalled();
  });

  it.each([0, 2])("keeps native boundary semantics at step %i", (currentStep) => {
    const html = renderToStaticMarkup(<JourneyDemoControls destination="Philadelphia" legs={[arriving, next]} state={{ isActive: true, currentStep }} step={{ kind: "leg", legIndex: currentStep / 2 }} stepCount={3} onStart={() => {}} onNext={() => {}} onPrevious={() => {}} onReset={() => {}} />);
    expect(html.match(/disabled=""/g)).toHaveLength(1);
    expect(html).toContain("left and right arrow keys");
  });
});

describe("Wallet journey round trip (W3)", () => {
  it.each(["regional-connection", "amtrak-connection", "east-portland--miami--flixbus"])("returns %s to the same journey", (id) => {
    const html = renderToStaticMarkup(<MemoryRouter><WalletPage tripId={id} /></MemoryRouter>);
    const backLink = html.match(/<a[^>]*>Back to journey<\/a>/)?.[0];
    expect(backLink).toContain(`href="/journey/${id}"`);
  });

  it("does not create a journey link for an invalid wallet", () => {
    const html = renderToStaticMarkup(<MemoryRouter><WalletPage tripId="invalid-trip" /></MemoryRouter>);
    expect(html).toContain("Journey not found");
    expect(html).not.toContain("Back to journey");
  });
});
