import type { Leg } from "../../types/transit";
import { RecoveryRecommendation } from "./RecoveryRecommendation";
import { addMinutes, displaySegmentTime } from "./journeyUtils";
import { assessSimulatedConnection, DEMO_TRANSFER_BUFFER_MINUTES, SIMULATED_DELAY_MINUTES, simulatedConnectionMessage } from "./journeySimulation";

export function SimulationFeedback({ affectedLeg, nextLeg, destination, active }: {
  affectedLeg: Leg; nextLeg?: Leg; destination: string; active: boolean;
}) {
  if (!active) return <p className="text-sm text-sage">Simulation off. Original sample itinerary times are shown.</p>;
  const assessment = nextLeg ? assessSimulatedConnection(affectedLeg, nextLeg) : null;
  const atRisk = assessment?.status === "tight" || assessment?.status === "missed";
  const arrival = addMinutes(affectedLeg.arrival, SIMULATED_DELAY_MINUTES);
  return <>
    <div className={`rounded-2xl border p-4 text-sm leading-6 ${atRisk ? "border-amber-300 bg-amber-50 text-amber-950" : "border-base-300 bg-white text-base-content"}`}>
      <p><strong>Simulated delay: +{SIMULATED_DELAY_MINUTES} min.</strong> Sample arrival at {affectedLeg.to}: <time dateTime={arrival}>{displaySegmentTime(arrival)}</time> Eastern Time.</p>
      {assessment ? <p className="mt-2">{simulatedConnectionMessage(assessment)}</p> : <p className="mt-2">There is no onward connection in this itinerary. This is the simulated arrival at your destination.</p>}
      <p className="mt-2">Manual demo only, not a live alert or a service guarantee. The {DEMO_TRANSFER_BUFFER_MINUTES}-minute demo buffer is not an official minimum transfer time; confirm boarding and actual connections with the operator.</p>
    </div>
    {atRisk && nextLeg && <div className="mt-3"><RecoveryRecommendation missedLeg={nextLeg} finalDestination={destination} /></div>}
  </>;
}
