import type { Leg } from "../../types/transit";
import { agencyStyles } from "./journeyUtils";
import { SIMULATED_DELAY_MINUTES } from "./journeySimulation";

type DelaySimulationProps = {
  affectedLeg: Leg;
  isActive: boolean;
  onToggle: () => void;
  /** False for one-leg trips: there is no connection to protect, only the arrival moves. */
  hasConnection?: boolean;
};

export function DelaySimulation({ affectedLeg, isActive, onToggle, hasConnection = true }: DelaySimulationProps) {
  const agency = agencyStyles[affectedLeg.agency];

  return (
    <section className={`overflow-hidden rounded-box border transition duration-300 ${isActive ? "border-amber-300 bg-amber-50" : "border-base-300 bg-white"}`} aria-labelledby="delay-simulator-title">
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-sage">Demo</p>
            <h2 id="delay-simulator-title" className="mt-1 text-xl font-bold tracking-tight text-base-content">Simulate a delay</h2>
            <p className="mt-2 max-w-lg text-sm leading-6 text-sage">{hasConnection
                ? `Add a simulated ${SIMULATED_DELAY_MINUTES}-minute delay to the first leg to see what OneLine suggests when a connection is at risk.`
                : "This trip has no connection, so a delay only moves your sample arrival time."} This is a demo, not a live alert.</p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-base-200 text-lg" aria-hidden="true">◷</span>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-2xl bg-base-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-base-content">Add {SIMULATED_DELAY_MINUTES} minutes to {affectedLeg.line}</p>
            <p className="mt-1 text-xs text-sage">{agency.label} · {affectedLeg.from} to {affectedLeg.to}</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-pressed={isActive}
            className={`min-h-11 rounded-xl px-4 text-sm font-extrabold transition focus-visible:outline-3 focus-visible:outline-solid ${isActive ? "bg-primary text-primary-content hover:bg-secondary focus-visible:outline-[#d7ef95] focus-visible:outline-offset-[-5px]" : "bg-amber-400 text-amber-950 hover:bg-amber-300 focus-visible:outline-[#4f7a2f] focus-visible:outline-offset-4"}`}
          >
            {isActive ? "Reset simulation" : "Simulate delay"}
          </button>
        </div>
      </div>
    </section>
  );
}
