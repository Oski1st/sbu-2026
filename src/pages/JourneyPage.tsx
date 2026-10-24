import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { demoTrips } from "../data/demoTrips";
import type { Trip } from "../types/transit";
import { DelaySimulation } from "../components/journey/DelaySimulation";
import { RecoveryRecommendation } from "../components/journey/RecoveryRecommendation";
import { SegmentCard } from "../components/journey/SegmentCard";
import { TransferAssistant } from "../components/journey/TransferAssistant";
import { agencyStyles } from "../components/journey/journeyUtils";

function JourneyNotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col justify-center px-5 py-16 text-center">
      <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-slate-500">OneLine</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Journey not found</h1>
      <p className="mt-3 text-slate-600">This itinerary may have changed. Return to search to choose another trip.</p>
      <Link to="/" className="mx-auto mt-7 inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-5 text-sm font-bold text-white transition hover:bg-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2">Back to search</Link>
    </main>
  );
}

export default function JourneyPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const trip = useMemo<Trip | undefined>(() => demoTrips.find((candidate) => candidate.id === tripId), [tripId]);
  const [expandedLegId, setExpandedLegId] = useState<string | null>(null);
  const [isDelaySimulated, setIsDelaySimulated] = useState(false);

  if (!trip) return <JourneyNotFound />;

  const affectedLeg = trip.legs[0];
  const affectedConnection = trip.legs.length > 1 ? trip.legs[1] : undefined;
  const agencies = [...new Set(trip.legs.map((leg) => leg.agency))];

  return (
    <main className="min-h-screen bg-[#fbfcfe] pb-16 text-slate-950">
      <style>{`
        @keyframes one-line-journey-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .one-line-journey-enter { animation: one-line-journey-enter 450ms cubic-bezier(.2,.8,.2,1) both; }
        }
      `}</style>
      <div className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4 sm:px-6">
          <Link to="/" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-sm font-bold text-slate-700 transition hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-950">
            <span aria-hidden="true">←</span> Search routes
          </Link>
          <span className="text-sm font-extrabold tracking-tight text-slate-950">OneLine</span>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-5 pt-8 sm:px-6 sm:pt-12">
        <header className="one-line-journey-enter">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Your journey</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-slate-950 sm:text-4xl">{trip.origin} <span className="text-slate-400" aria-hidden="true">→</span> {trip.destination}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-bold text-slate-800">{trip.durationMinutes} min total</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 font-bold text-slate-800">{trip.legs.length} {trip.legs.length === 1 ? "train" : "trains"}</span>
            {agencies.map((agency) => <span key={agency} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${agencyStyles[agency].badge}`}>{agencyStyles[agency].label}</span>)}
          </div>
        </header>

        {affectedLeg && (
          <div className="mt-8 one-line-journey-enter">
            <DelaySimulation affectedLeg={affectedLeg} isActive={isDelaySimulated} onToggle={() => setIsDelaySimulated((active) => !active)} />
          </div>
        )}

        <div className="mt-6" aria-live="polite">
          {isDelaySimulated && affectedConnection && <RecoveryRecommendation missedLeg={affectedConnection} finalDestination={trip.destination} />}
        </div>

        <section className="mt-8" aria-labelledby="timeline-title">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-slate-500">Step by step</p>
              <h2 id="timeline-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Journey timeline</h2>
            </div>
            <p className="text-xs text-slate-500">Times shown from itinerary</p>
          </div>

          <div className="space-y-3">
            {trip.legs.map((leg, index) => (
              <div key={leg.id} className="one-line-journey-enter" style={{ animationDelay: `${Math.min(index * 70, 240)}ms` }}>
                <SegmentCard
                  leg={leg}
                  index={index}
                  isExpanded={expandedLegId === leg.id}
                  isDelayed={isDelaySimulated && leg.id === affectedLeg?.id}
                  onToggle={() => setExpandedLegId((current) => current === leg.id ? null : leg.id)}
                />
                {index < trip.legs.length - 1 && (
                  <TransferAssistant
                    arrivingLeg={leg}
                    nextLeg={trip.legs[index + 1]}
                    isAffected={isDelaySimulated && leg.id === affectedLeg?.id}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        <aside className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 sm:p-6">
          <p className="font-bold text-slate-950">A note on platforms</p>
          <p className="mt-1">Platform assignments can change and are not included here. Always follow live station signage, announcements, and official agency updates.</p>
        </aside>
      </div>
    </main>
  );
}
