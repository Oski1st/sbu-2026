import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Leg } from "../../types/transit";
import { SegmentCard } from "./SegmentCard";
import { displaySegmentTime } from "./journeyUtils";

const baseLeg: Leg = {
  id: "arrival-test", agency: "AMTRAK", line: "Sample rail segment",
  from: "Boston", to: "Philadelphia", purchaseUrl: "https://www.amtrak.com/",
  departure: "2026-10-24T08:00:00-04:00", arrival: "2026-10-24T13:00:00-04:00",
};

function renderTimes(leg: Leg, isDelayed = false) {
  const html = renderToStaticMarkup(<SegmentCard leg={leg} index={0} isExpanded={false} isDelayed={isDelayed} isCurrent={false} onToggle={() => {}} />);
  const times = [...html.matchAll(/<time\b([^>]*)>([\s\S]*?)<\/time>/g)].map((match) => ({
    dateTime: match[1].match(/datetime="([^"]+)"/i)?.[1],
    attributes: match[1], text: match[2],
  }));
  return { html, times };
}

describe("SegmentCard arrival timestamps", () => {
  it("gives ordinary sample arrival its exact ISO instant without changing its label", () => {
    const { html, times } = renderTimes(baseLeg);
    expect(times).toHaveLength(2);
    expect(times[0].dateTime).toBe(baseLeg.departure);
    expect(times[1].dateTime).toBe(baseLeg.arrival);
    expect(times[1].text).toBe(displaySegmentTime(baseLeg.arrival));
    expect(html).toContain("AMTRAK");
    expect(html).not.toContain("Simulated delay");
  });

  it("keeps overnight arrivals on the following calendar date", () => {
    const leg = { ...baseLeg, departure: "2026-10-24T23:00:00-04:00", arrival: "2026-10-25T01:05:00-04:00" };
    const { times } = renderTimes(leg);
    expect(times[1].dateTime).toBe(leg.arrival);
    expect(times[1].text).toBe(displaySegmentTime(leg.arrival));
    expect(times[0].text).toContain("Oct 24");
    expect(times[1].text).toContain("Oct 25");
  });

  it("identifies original and simulated midnight-rollover arrivals independently", () => {
    const leg = { ...baseLeg, departure: "2026-10-24T23:10:00-04:00", arrival: "2026-10-24T23:55:00-04:00" };
    const original = JSON.stringify(leg);
    const { html, times } = renderTimes(leg, true);
    expect(times).toHaveLength(3);
    expect(times[1].dateTime).toBe(leg.arrival);
    expect(times[1].attributes).toContain("Original sample arrival:");
    expect(times[1].attributes).toContain("line-through");
    expect(times[1].text).toBe(displaySegmentTime(leg.arrival));
    const simulatedIso = "2026-10-25T04:07:00.000Z";
    expect(times[2].dateTime).toBe(simulatedIso);
    expect(times[2].attributes).toContain("Simulated arrival (+12 minutes):");
    expect(times[2].text).toBe(displaySegmentTime(simulatedIso));
    expect(times[1].text).toContain("Oct 24");
    expect(times[2].text).toContain("Oct 25");
    expect(Date.parse(times[2].dateTime!) - Date.parse(times[1].dateTime!)).toBe(12 * 60_000);
    expect(html).toContain("Simulated delay: +12 min");
    expect(html).toContain("Arrive (simulated)");
    expect(JSON.stringify(leg)).toBe(original);
  });
});
