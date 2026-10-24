import { describe, expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { demoTrips } from "../../data/demoTrips";
import { RecoveryRecommendation } from "./RecoveryRecommendation";
import { TransferAssistant } from "./TransferAssistant";

const flixBusTrip = demoTrips.find((trip) => trip.id === "east-portland--miami--flixbus");
const mixedTrip = demoTrips.find((trip) => trip.id === "east-boston--stony-brook--greyhound");
const reverseMixedTrip = demoTrips.find((trip) => trip.id === "east-stony-brook--boston--greyhound");

describe("coach-aware Journey guidance", () => {
  test("uses operator boarding details for a coach transfer", () => {
    expect(reverseMixedTrip).toBeDefined();
    const [arrivingLeg, nextLeg] = reverseMixedTrip!.legs;
    const html = renderToStaticMarkup(
      <TransferAssistant arrivingLeg={arrivingLeg} nextLeg={nextLeg} isAffected={false} isCurrent={false} />,
    );

    expect(html).toContain("Boarding location: check official operator details");
    expect(html).not.toContain("Platform: check live station boards");
  });

  test("keeps platform guidance for a rail connection after a coach leg", () => {
    expect(mixedTrip).toBeDefined();
    const arrivingLeg = mixedTrip!.legs.find((leg) => leg.mode === "bus")!;
    const nextLeg = mixedTrip!.legs[mixedTrip!.legs.indexOf(arrivingLeg) + 1];
    const html = renderToStaticMarkup(
      <TransferAssistant arrivingLeg={arrivingLeg} nextLeg={nextLeg} isAffected={false} isCurrent={false} />,
    );

    expect(nextLeg.mode).toBe("rail");
    expect(html).toContain("Platform: check live station boards");
  });

  test("keeps simulated coach recovery advice out of station-platform language", () => {
    const html = renderToStaticMarkup(
      <RecoveryRecommendation missedLeg={flixBusTrip!.legs[0]} finalDestination={flixBusTrip!.destination} />,
    );

    expect(html).toContain("official operator details or terminal information");
    expect(html).toContain("boarding location and service updates");
    expect(html).not.toContain("live departure boards");
  });
});
