import { useLayoutEffect, useRef, type KeyboardEvent } from "react";
import type { Leg } from "../../types/transit";
import type { JourneyDemoState, JourneyStep } from "./journeyProgress";
import { restoreJourneyControlFocus } from "./journeyControlFocus";

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
    : `Current step: transfer at ${leg.to} for the next service.`;
}

export function JourneyDemoControls({ destination, legs, state, step, stepCount, onStart, onNext, onPrevious, onReset }: JourneyDemoControlsProps) {
  const currentPosition = state.isActive ? state.currentStep + 1 : 0;
  const atFirstStep = !state.isActive || state.currentStep === 0;
  const atLastStep = !state.isActive || state.currentStep >= stepCount - 1;
  const startRef = useRef<HTMLButtonElement>(null);
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const focusedRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    restoreJourneyControlFocus(focusedRef.current, document.activeElement, document.body,
      [previousRef.current, nextRef.current, startRef.current]);
  }, [atFirstStep, atLastStep]);

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
      className="mt-6 rounded-box border border-base-300 bg-white p-4 shadow-[0_1px_2px_#173f350d,0_12px_32px_-18px_#173f3540] sm:p-5"
      aria-labelledby="demo-journey-title"
      onKeyDown={handleKeyDown}
      onFocusCapture={(event) => {
        focusedRef.current = event.target instanceof HTMLButtonElement ? event.target : null;
      }}
      onBlurCapture={(event) => {
        if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget)) {
          // Keep a reference only for blur caused by disabling the focused button.
          // Ordinary Tab/click-away must not make a later reset steal focus back.
          if (!(event.target instanceof HTMLButtonElement) || !event.target.disabled) focusedRef.current = null;
        }
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-primary">Manual demo</p>
          <h2 id="demo-journey-title" className="mt-1 text-xl font-bold tracking-tight text-primary">Steps to {destination}</h2>
          <p className="mt-1 max-w-xl text-sm leading-6 text-sage">You tap through each step yourself. It doesn’t use GPS, confirm boarding, or show live arrivals.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-primary ring-1 ring-base-300">{state.isActive ? `Step ${currentPosition} of ${stepCount}` : "Ready to start"}</span>
      </div>

      <div className="mt-4" aria-live="polite" aria-atomic="true">
        <div
          className="h-2 overflow-hidden rounded-full bg-base-200"
          role="progressbar"
          aria-label="Manual journey progress"
          aria-valuemin={0}
          aria-valuemax={stepCount}
          aria-valuenow={currentPosition}
          aria-valuetext={state.isActive ? `Step ${currentPosition} of ${stepCount}` : "Not started"}
        >
          <div className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${stepCount ? (currentPosition / stepCount) * 100 : 0}%` }} />
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-primary">{stepDescription(state.isActive ? step : null, legs)}</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        <button ref={startRef} type="button" onClick={onStart} className="min-h-11 rounded-xl bg-primary px-3 text-sm font-extrabold text-white transition hover:bg-secondary focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-[#d7ef95] focus-visible:outline-offset-[-5px]">
          Start demo journey
        </button>
        <button ref={previousRef} type="button" onClick={onPrevious} disabled={atFirstStep} className="min-h-11 rounded-xl bg-white px-3 text-sm font-extrabold text-primary ring-1 ring-base-300 transition hover:bg-base-200 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-[#4f7a2f] focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-45">
          Previous step
        </button>
        <button ref={nextRef} type="button" onClick={onNext} disabled={atLastStep} className="min-h-11 rounded-xl bg-white px-3 text-sm font-extrabold text-primary ring-1 ring-base-300 transition hover:bg-base-200 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-[#4f7a2f] focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-45">
          Next step
        </button>
        <button type="button" onClick={onReset} className="min-h-11 rounded-xl px-3 text-sm font-extrabold text-primary transition hover:bg-base-200 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-[#4f7a2f] focus-visible:outline-offset-4">
          Reset
        </button>
      </div>
      <p className="mt-3 text-xs font-medium leading-5 text-sage">Tip: when these controls are focused, use the left and right arrow keys to move between available manual steps.</p>
    </section>
  );
}
