import type { Leg } from "../../types/transit";
import { addMinutes, agencyStyles, displayTime, legDuration } from "./journeyUtils";

type SegmentCardProps = {
  leg: Leg;
  index: number;
  isExpanded: boolean;
  isDelayed: boolean;
  onToggle: () => void;
};

export function SegmentCard({ leg, index, isExpanded, isDelayed, onToggle }: SegmentCardProps) {
  const styles = agencyStyles[leg.agency];
  const duration = legDuration(leg);
  const detailId = `segment-details-${leg.id}`;

  return (
    <article className={`rounded-3xl border bg-white p-4 shadow-[0_10px_35px_-24px_rgba(15,23,42,0.45)] transition duration-300 sm:p-5 ${isDelayed ? "border-amber-300 ring-4 ring-amber-100" : "border-slate-200"}`}>
      {isDelayed && (
        <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600" aria-hidden="true" />
          Simulated delay: +12 min
        </p>
      )}

      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-1" aria-hidden="true">
          <span className={`h-3.5 w-3.5 rounded-full ring-4 ${styles.dot} ${styles.ring}`} />
          <span className="my-1.5 h-full min-h-10 w-px bg-slate-200" />
          <span className={`h-3.5 w-3.5 rounded-sm ${styles.dot}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-[0.08em] ${styles.badge}`}>{styles.label}</span>
            {duration && <span className="text-xs font-medium text-slate-500">{duration}</span>}
          </div>

          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
            <div className="min-w-0">
              <p className="text-lg font-semibold leading-tight text-slate-950">{leg.from}</p>
              <p className="mt-1 text-sm text-slate-500">Depart</p>
            </div>
            <time dateTime={leg.departure} className="text-right text-base font-bold tabular-nums text-slate-900">{displayTime(leg.departure)}</time>

            <div className="mt-5 min-w-0">
              <p className="text-lg font-semibold leading-tight text-slate-950">{leg.to}</p>
              <p className="mt-1 text-sm text-slate-500">Arrive{isDelayed ? " (simulated)" : ""}</p>
            </div>
            <time className={`mt-5 text-right text-base font-bold tabular-nums ${isDelayed ? "text-amber-800" : "text-slate-900"}`}>
              {isDelayed ? (
                <span className="flex flex-col items-end">
                  <span className="text-xs font-medium text-slate-400 line-through">{displayTime(leg.arrival)}</span>
                  <span>{addMinutes(leg.arrival, 12)}</span>
                </span>
              ) : displayTime(leg.arrival)}
            </time>
          </div>

          <p className="mt-4 text-sm font-medium text-slate-700">
            {leg.line}
            <span className="mx-2 text-slate-300" aria-hidden="true">•</span>
            Train segment {index + 1}
          </p>

          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-controls={detailId}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
          >
            {isExpanded ? "Hide trip details" : "View trip details"}
            <svg className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="m3 6 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <div id={detailId} className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
            <div className="overflow-hidden">
              <div className="mt-2 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">On this segment</p>
                <ol className="mt-3 space-y-2 leading-6">
                  <li>1. Be ready to board the <strong>{leg.line}</strong> at {leg.from}.</li>
                  <li>2. Keep this itinerary handy and follow station signage for your train.</li>
                  <li>3. Exit at {leg.to} and continue to the next connection if shown below.</li>
                </ol>
                <a
                  href={leg.purchaseUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-white px-3 font-bold text-slate-900 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950"
                >
                  Get tickets from {styles.label}
                  <span className="ml-2" aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
