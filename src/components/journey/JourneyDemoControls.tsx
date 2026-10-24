import type { KeyboardEvent } from "react";
import type { Leg } from "../../types/transit";
import type { JourneyDemoState, JourneyStep } from "./journeyProgress";

type JourneyDemoControlsProps = {
  destination: string;
  legs: Leg[];
  state: JourneyDemoState;
  step: JourneyStep | null;
  stepCount: number;
  onStart: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onReset: () => void;
};

function stepDescription(step: JourneyStep | null, legs: Leg[]): string {
  if (!step) return "Choose Start demo journey to begin the manual walkthrough.";
  const leg = legs[step.legIndex];
  if (!leg) return "Manual walkthrough ready.";
  return step.kind === "leg"
    ? `Current step: ${leg.line} from ${leg.from} to ${leg.to}.`
    : `Current step: transfer at ${leg.to} for the next train.`;
}

export function JourneyDemoControls({ destination, legs, state, step, stepCount, onStart, onNext, onPrevious, onReset }: JourneyDemoControlsProps) {
  const currentPosition = state.isActive ? state.currentStep + 1 : 0;
  const atFirstStep = !state.isActive || state.currentStep === 0;
  const atLastStep = !state.isActive || state.currentStep >= stepCount - 1;

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowRight" && !atLastStep) {
      event.preventDefault();
      onNext();
    }
    if (event.key === "ArrowLeft" && !atFirstStep) {
      event.preventDefault();
      onPrevious();
    }
  }

  return (
    <section
      className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 shadow-[0_12px_32px_-26px_rgba(6,78,59,0.5)] sm:p-5"
      aria-labelledby="demo-journey-title"
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-emerald-800">Manual demo</p>
          <h2 id="demo-journey-title" className="mt-1 text-xl font-bold tracking-tight text-emerald-950">Guided journey to {destination}</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-emerald-950/80">A tap-through walkthrough only — it does not use GPS, confirm boarding, or show live arrivals.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-900 ring-1 ring-emerald-200">{state.isActive ? `Step ${currentPosition} of ${stepCount}` : "Ready to start"}</span>
      </div>

      <div className="mt-4" aria-live="polite" aria-atomic="true">
        <div
          className="h-2 overflow-hidden rounded-full bg-emerald-100"
          role="progressbar"
          aria-label="Manual journey progress"
          aria-valuemin={0}
          aria-valuemax={stepCount}
          aria-valuenow={currentPosition}
          aria-valuetext={state.isActive ? `Step ${currentPosition} of ${stepCount}` : "Not started"}
        >
          <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${stepCount ? (currentPosition / stepCount) * 100 : 0}%` }} />
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-emerald-950">{stepDescription(state.isActive ? step : null, legs)}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button type="button" onClick={onStart} className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-extrabold text-white transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-950 focus-visible:ring-offset-2">
          Start demo journey
        </button>
        <button type="button" onClick={onPrevious} disabled={atFirstStep} className="min-h-11 rounded-xl bg-white px-3 text-sm font-extrabold text-emerald-950 ring-1 ring-emerald-200 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45">
          Previous step
        </button>
        <button type="button" onClick={onNext} disabled={atLastStep} className="min-h-11 rounded-xl bg-white px-3 text-sm font-extrabold text-emerald-950 ring-1 ring-emerald-200 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45">
          Next step
        </button>
        <button type="button" onClick={onReset} className="min-h-11 rounded-xl px-3 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-950 focus-visible:ring-offset-2">
          Reset
        </button>
      </div>
      <p className="mt-3 text-xs font-medium leading-5 text-emerald-900/75">Tip: when these controls are focused, use the left and right arrow keys to move between available manual steps.</p>
    </section>
  );
}
