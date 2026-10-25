import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useParams } from "react-router-dom";
import { getTripById } from "../data/tripLookup";
import { formatDuration } from "../data/tripUtils";
import type { Trip } from "../types/transit";
import { DelaySimulation } from "../components/journey/DelaySimulation";
import { JourneyDemoControls } from "../components/journey/JourneyDemoControls";
import { SimulationFeedback } from "../components/journey/SimulationFeedback";
import { SegmentCard } from "../components/journey/SegmentCard";
import { TransferAssistant } from "../components/journey/TransferAssistant";
import { Toaster } from "../components/ui/sonner";
import { SIMULATED_DELAY_MINUTES } from "../components/journey/journeySimulation";
import "../styles/journey.css";
import { agencyStyles } from "../components/journey/journeyUtils";
import { initialJourneyDemoState, journeyStepCount, nextJourneyStep, previousJourneyStep, startJourneyDemo, stepAt } from "../components/journey/journeyProgress";

function JourneyNotFound() {
  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl flex-col justify-center px-5 py-16 text-center">
      <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-sage">OneLine</p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-primary">Journey not found</h1>
      <p className="mt-3 text-sage">This itinerary may have changed. Return to search to choose another trip.</p>
      <Link to="/" className="btn btn-primary mx-auto mt-7 min-h-11 px-5 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-[#d7ef95] focus-visible:outline-offset-[-5px]">Back to search</Link>
    </main>
  );
}

export default function JourneyPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const trip = useMemo<Trip | undefined>(() => getTripById(tripId), [tripId]);
  const [expandedLegId, setExpandedLegId] = useState<string | null>(null);
  const [isDelaySimulated, setIsDelaySimulated] = useState(false);
  const [demoState, setDemoState] = useState(initialJourneyDemoState);

  useEffect(() => {
    setExpandedLegId(null);
    setIsDelaySimulated(false);
    toast.dismiss("simulated-delay");
    setDemoState(initialJourneyDemoState());
  }, [tripId]);

  if (!trip) return <JourneyNotFound />;

  const affectedLeg = trip.legs[0];
  const affectedConnection = trip.legs.length > 1 ? trip.legs[1] : undefined;
  const agencies = [...new Set(trip.legs.map((leg) => leg.agency))];
  const demoStepCount = journeyStepCount(trip.legs.length);
  const currentDemoStep = demoState.isActive ? stepAt(demoState.currentStep, trip.legs.length) : null;

  function resetJourneyExperience() {
    setExpandedLegId(null);
    setIsDelaySimulated(false);
    toast.dismiss("simulated-delay");
    setDemoState(initialJourneyDemoState());
  }

  return (
    <main className="min-h-screen bg-base-100 pb-16 text-base-content">
      <style>{`
        @keyframes one-line-journey-enter {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: no-preference) {
          .one-line-journey-enter { animation: one-line-journey-enter 450ms cubic-bezier(.2,.8,.2,1) both; }
        }
      `}</style>
      <div className="mx-auto max-w-3xl px-5 pt-8 sm:px-6 sm:pt-12">
        <header className="one-line-journey-enter">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-sage">Your journey</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-primary sm:text-5xl">{trip.origin} <span className="text-[#8aa36a]" aria-hidden="true">→</span> {trip.destination}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-sage">
            <span className="badge badge-lg border-0 bg-primary font-bold text-primary-content">{formatDuration(trip.durationMinutes)} total</span>
            <span className="badge badge-lg border-base-300 bg-white font-bold text-primary">{trip.legs.length} {trip.legs.length === 1 ? "segment" : "segments"}</span>
            {agencies.map((agency) => <span key={agency} className={`rounded-full px-3 py-1.5 text-xs font-extrabold ${agencyStyles[agency].badge}`}>{agencyStyles[agency].label}</span>)}
          </div>
          {trip.planningNote && <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Sample route concept. </strong>{trip.planningNote}</p>}
          <Link
            to={`/wallet/${trip.id}`}
            className="btn btn-primary mt-5 min-h-11 gap-2 px-5 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-[#d7ef95] focus-visible:outline-offset-[-5px]"
          >
            View ticket wallet
            <span aria-hidden="true">→</span>
          </Link>
        </header>

        <JourneyDemoControls
          destination={trip.destination}
          legs={trip.legs}
          state={demoState}
          step={currentDemoStep}
          stepCount={demoStepCount}
          onStart={() => setDemoState(startJourneyDemo(demoStepCount))}
          onNext={() => setDemoState((state) => nextJourneyStep(state, demoStepCount))}
          onPrevious={() => setDemoState((state) => previousJourneyStep(state))}
          onReset={resetJourneyExperience}
        />

        {affectedLeg && (
          <div className="mt-8 one-line-journey-enter">
            <DelaySimulation
              affectedLeg={affectedLeg}
              hasConnection={Boolean(affectedConnection)}
              isActive={isDelaySimulated}
              onToggle={() => {
                // The inline delay UI stays the source of truth; the toast is a visual-only cue (its Toaster
                // is hidden below), so #41's live region is the one place the delay is announced.
                if (!isDelaySimulated) toast("Delay simulation on", { id: "simulated-delay", description: `+${SIMULATED_DELAY_MINUTES} min on ${affectedLeg.line} · demo, not a live alert` });
                else toast.dismiss("simulated-delay");
                setIsDelaySimulated((active) => !active);
              }}
            />
          </div>
        )}

        <div className="mt-6" role="status" aria-live="polite" aria-atomic="true">
          {affectedLeg && <SimulationFeedback affectedLeg={affectedLeg} nextLeg={affectedConnection} destination={trip.destination} active={isDelaySimulated} />}
        </div>

        <section className="mt-8" aria-labelledby="timeline-title">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-sage">Step by step</p>
              <h2 id="timeline-title" className="mt-1 text-2xl font-bold tracking-tight text-primary">Journey timeline</h2>
            </div>
            <p className="text-xs text-sage">Fixed sample itinerary times (Eastern Time) · your search date and time are not applied</p>
          </div>

          <ol className="journey-steps">
            {trip.legs.map((leg, index) => (
              <li key={leg.id} className="journey-step one-line-journey-enter" style={{ animationDelay: `${Math.min(index * 70, 240)}ms` }}>
                <span
                  className={`journey-step-marker ${currentDemoStep?.kind === "leg" && currentDemoStep.legIndex === index ? "is-current" : isDelaySimulated && leg.id === affectedLeg?.id ? "is-delayed" : ""}`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <SegmentCard
                  leg={leg}
                  index={index}
                  isExpanded={expandedLegId === leg.id}
                  isDelayed={isDelaySimulated && leg.id === affectedLeg?.id}
                  isCurrent={currentDemoStep?.kind === "leg" && currentDemoStep.legIndex === index}
                  onToggle={() => setExpandedLegId((current) => current === leg.id ? null : leg.id)}
                />
                {index < trip.legs.length - 1 && (
                  <TransferAssistant
                    arrivingLeg={leg}
                    nextLeg={trip.legs[index + 1]}
                    isAffected={isDelaySimulated && leg.id === affectedLeg?.id}
                    isCurrent={currentDemoStep?.kind === "transfer" && currentDemoStep.legIndex === index}
                  />
                )}
              </li>
            ))}
          </ol>
        </section>

        <aside className="mt-8 rounded-box border border-base-300 bg-white p-5 text-sm leading-6 text-sage sm:p-6">
          <p className="font-bold text-primary">A note on boarding locations</p>
          <p className="mt-1">Platform, gate, and curbside boarding locations can change and are not included here. Always follow station or terminal signage, announcements, and official operator updates.</p>
        </aside>
      </div>
      {/* Sonner's region is always aria-live, so it would announce the delay a second time. Hide it
          from assistive technology; inert keeps its tabbable toast out of the focus order too. */}
      <div aria-hidden="true" inert>
        <Toaster hotkey={[]} />
      </div>
    </main>
  );
}
