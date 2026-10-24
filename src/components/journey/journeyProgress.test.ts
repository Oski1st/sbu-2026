import { describe, expect, it } from "vitest";
import { initialJourneyDemoState, journeyStepCount, nextJourneyStep, previousJourneyStep, startJourneyDemo, stepAt } from "./journeyProgress";

describe("manual journey progression", () => {
  it("stays within the first and final walkthrough steps", () => {
    const stepCount = journeyStepCount(3);
    let state = startJourneyDemo(stepCount);

    expect(previousJourneyStep(state)).toEqual(state);
    for (let index = 0; index < 8; index += 1) state = nextJourneyStep(state, stepCount);

    expect(state).toEqual({ isActive: true, currentStep: 4 });
    expect(stepAt(state.currentStep, 3)).toEqual({ kind: "leg", legIndex: 2 });
  });

  it("starts from the first train when next is used before the demo starts", () => {
    expect(nextJourneyStep(initialJourneyDemoState(), journeyStepCount(4))).toEqual({ isActive: true, currentStep: 0 });
  });

  it("creates a fresh state for reset and for a trip change", () => {
    const progressed = { isActive: true, currentStep: 3 };

    expect(initialJourneyDemoState()).toEqual({ isActive: false, currentStep: 0 });
    expect(startJourneyDemo(journeyStepCount(3))).toEqual({ isActive: true, currentStep: 0 });
    expect(stepAt(progressed.currentStep, 2)).toBeNull();
  });
});
