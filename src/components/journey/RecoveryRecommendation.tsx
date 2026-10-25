import type { Leg } from "../../types/transit";
import { agencyStyles } from "./journeyUtils";

type RecoveryRecommendationProps = {
  missedLeg: Leg;
  finalDestination: string;
};

export function RecoveryRecommendation({ missedLeg, finalDestination }: RecoveryRecommendationProps) {
  const agency = agencyStyles[missedLeg.agency];
  const isCoach = missedLeg.mode === "bus";

  return (
    <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 shadow-[0_16px_40px_-26px_rgba(180,83,9,0.5)] transition-all duration-300 sm:p-6" aria-labelledby="recovery-title">
      <div className="flex gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-200 text-amber-900" aria-hidden="true">!</span>
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-amber-800">Simulated recovery plan</p>
          <h2 id="recovery-title" className="mt-1 text-xl font-bold tracking-tight text-amber-950">You might miss your connection.</h2>
          <p className="mt-2 text-sm leading-6 text-amber-950">
            At {missedLeg.from}, check {isCoach ? "official operator details or terminal information" : "live departure boards"} for the next <strong>{missedLeg.line}</strong> service toward {missedLeg.to}. If the planned departure has passed, ask an on-site {agency.label} representative for the next available option to continue to {finalDestination}.
          </p>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-white/75 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Do now</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-900">Confirm your next departure with the operator before changing services.</p>
        </div>
        <div className="rounded-2xl bg-white/75 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Find next</p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-900">{isCoach ? "Use official operator details for boarding location and service updates." : "Use live station boards for platform and service details."}</p>
        </div>
      </div>
    </section>
  );
}
