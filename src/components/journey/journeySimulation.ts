import type { Leg } from "../../types/transit";
import { differenceInMinutes } from "./journeyUtils";

export const SIMULATED_DELAY_MINUTES = 12;
/** A demo warning rule, NOT an agency minimum transfer time. */
export const DEMO_TRANSFER_BUFFER_MINUTES = 10;

export function assessSimulatedConnection(arrivingLeg: Leg, nextLeg: Leg) {
  const plannedMinutes = differenceInMinutes(arrivingLeg.arrival, nextLeg.departure);
  const remainingMinutes = plannedMinutes === null ? null : plannedMinutes - SIMULATED_DELAY_MINUTES;
  const status = remainingMinutes === null ? "unknown"
    : remainingMinutes < 0 ? "missed"
    : remainingMinutes < DEMO_TRANSFER_BUFFER_MINUTES ? "tight" : "comfortable";
  return { plannedMinutes, remainingMinutes, status } as const;
}

export function simulatedConnectionMessage(assessment: ReturnType<typeof assessSimulatedConnection>): string {
  const { status, remainingMinutes } = assessment;
  if (status === "unknown") return "The sample timestamps do not allow us to assess this simulated connection.";
  if (status === "missed") return `The simulated arrival is ${Math.abs(remainingMinutes!)} min after the planned next departure.`;
  if (status === "tight") return `Only ${remainingMinutes} min remains after the simulated delay, below the ${DEMO_TRANSFER_BUFFER_MINUTES}-minute demo warning threshold.`;
  return `The connection still works in this sample: ${remainingMinutes} min remains after the simulated delay, meeting the ${DEMO_TRANSFER_BUFFER_MINUTES}-minute demo buffer.`;
}
