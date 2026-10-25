import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { Leg } from "../../types/transit";
import { DelaySimulation } from "./DelaySimulation";
import { SegmentCard } from "./SegmentCard";

// A delay other than the shipped 12 minutes proves the copy follows journeySimulation's constant.
vi.mock("./journeySimulation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./journeySimulation")>()),
  SIMULATED_DELAY_MINUTES: 7,
}));

const leg: Leg = {
  id: "delay-copy", agency: "SEPTA", line: "Sample line", from: "Philadelphia", to: "Trenton",
  departure: "2026-10-24T08:00:00-04:00", arrival: "2026-10-24T08:55:00-04:00", purchaseUrl: "https://www.septa.org/",
};

describe("simulated delay copy follows SIMULATED_DELAY_MINUTES", () => {
  it("labels the delayed segment and its simulated arrival with the configured delay", () => {
    const html = renderToStaticMarkup(<SegmentCard leg={leg} index={0} isExpanded={false} isDelayed isCurrent={false} onToggle={() => {}} />);
    expect(html).toContain("Simulated delay: +7 min");
    expect(html).toMatch(/<time dateTime="2026-10-24T13:02:00.000Z" aria-label="Simulated arrival \(\+7 minutes\): /);
    expect(html).not.toMatch(/\+12|12 min/);
  });

  it("describes the configured delay in the simulator intro", () => {
    const html = renderToStaticMarkup(<DelaySimulation affectedLeg={leg} isActive={false} onToggle={() => {}} />);
    expect(html).toContain("Add a simulated 7-minute delay to the first leg");
    expect(html).toContain("Add 7 minutes to Sample line");
    expect(html).not.toContain("12");
  });
});
