import type { Leg } from "../../types/transit";
import { agencyStyles, differenceInMinutes, displayTime } from "./journeyUtils";

type TransferAssistantProps = {
  arrivingLeg: Leg;
  nextLeg: Leg;
  isAffected: boolean;
  isCurrent: boolean;
};

export function TransferAssistant({ arrivingLeg, nextLeg, isAffected, isCurrent }: TransferAssistantProps) {
  const transferTime = differenceInMinutes(arrivingLeg.arrival, nextLeg.departure);
  const nextAgency = agencyStyles[nextLeg.agency];
  const nextIsCoach = nextLeg.mode === "bus";
  const arrivingByCoach = arrivingLeg.mode === "bus";

  return (
    <section className={`relative ml-6 my-3 overflow-hidden rounded-2xl border p-4 transition duration-300 motion-reduce:transition-none sm:ml-8 ${isCurrent ? "border-emerald-400 bg-emerald-50 ring-4 ring-emerald-100" : isAffected ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`} aria-label={`${isCurrent ? "Current manual demo step: " : ""}Transfer at ${arrivingLeg.to}`}>
      <div className={`absolute inset-y-0 left-0 w-1 ${isCurrent ? "bg-emerald-500" : isAffected ? "bg-amber-500" : "bg-slate-300"}`} aria-hidden="true" />
      <div className="flex items-start gap-3 pl-2">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${isAffected ? "bg-amber-200 text-amber-900" : "bg-white text-slate-700"}`} aria-hidden="true">
          ⇄
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-bold text-slate-950">Transfer at {arrivingLeg.to}</p>
            {isCurrent && <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-bold text-emerald-950">Current manual demo step</span>}
            {transferTime !== null && <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isAffected ? "bg-amber-200 text-amber-900" : "bg-white text-slate-600"}`}>{transferTime} min planned</span>}
          </div>
          {isAffected ? (
            <p className="mt-2 text-sm leading-6 text-amber-950">
              Your planned connection is affected by a <strong>simulated</strong> delay. Check {arrivingByCoach ? "official operator details or terminal information" : "station boards or the agency app"} for the next available service before leaving your arriving service.
            </p>
          ) : (
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Next: <strong className="text-slate-800">{nextLeg.line}</strong> toward {nextLeg.to} at <strong className="text-slate-800">{displayTime(nextLeg.departure)}</strong>.
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            <span className={`rounded-full px-2.5 py-1 ${nextAgency.badge}`}>{nextAgency.label} next</span>
            <span className="rounded-full bg-white px-2.5 py-1">{nextIsCoach ? "Boarding location: check official operator details" : "Platform: check live station boards"}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
