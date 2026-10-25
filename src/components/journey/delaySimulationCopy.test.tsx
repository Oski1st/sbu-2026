import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Leg } from "../../types/transit";
import { DelaySimulation } from "./DelaySimulation";

const leg: Leg = {
  id: "delay-copy-rail", agency: "AMTRAK", line: "Sample rail segment",
  from: "Boston", to: "New York", purchaseUrl: "https://www.amtrak.com/",
  departure: "2026-10-24T08:00:00-04:00", arrival: "2026-10-24T11:55:00-04:00",
};

describe("DelaySimulation copy", () => {
  it("promises connection help only when the trip has a connection (W16)", () => {
    const multi = renderToStaticMarkup(<DelaySimulation affectedLeg={leg} isActive={false} onToggle={() => {}} />);
    expect(multi).toContain("when a connection is at risk");
    const single = renderToStaticMarkup(<DelaySimulation affectedLeg={leg} hasConnection={false} isActive={false} onToggle={() => {}} />);
    expect(single).not.toContain("connection is at risk");
    expect(single).toContain("no connection, so a delay only moves your sample arrival time");
  });
});
