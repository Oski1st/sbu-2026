export type JourneyDemoState = {
  isActive: boolean;
  currentStep: number;
};

export type JourneyStep =
  | { kind: "leg"; legIndex: number }
  | { kind: "transfer"; legIndex: number };

export function journeyStepCount(legCount: number): number {
  return legCount > 0 ? legCount * 2 - 1 : 0;
}

export function initialJourneyDemoState(): JourneyDemoState {
  return { isActive: false, currentStep: 0 };
}

export function startJourneyDemo(stepCount: number): JourneyDemoState {
  return stepCount > 0 ? { isActive: true, currentStep: 0 } : initialJourneyDemoState();
}

export function nextJourneyStep(state: JourneyDemoState, stepCount: number): JourneyDemoState {
  if (!state.isActive) return startJourneyDemo(stepCount);
  return { ...state, currentStep: Math.min(state.currentStep + 1, Math.max(0, stepCount - 1)) };
}

export function previousJourneyStep(state: JourneyDemoState): JourneyDemoState {
  return { ...state, currentStep: Math.max(0, state.currentStep - 1) };
}

export function stepAt(index: number, legCount: number): JourneyStep | null {
  if (index < 0 || index >= journeyStepCount(legCount)) return null;
  return index % 2 === 0
    ? { kind: "leg", legIndex: index / 2 }
    : { kind: "transfer", legIndex: (index - 1) / 2 };
}
