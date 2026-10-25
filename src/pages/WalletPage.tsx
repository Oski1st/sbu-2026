import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Trip } from '../types/transit';
import { getTripById } from '../data/tripLookup';
import { formatDuration } from '../data/tripUtils';
import { TicketCard } from '../components/wallet/TicketCard';
import { TransitStatus } from '../components/wallet/TransitStatus';
import { lirrThroughTicketNote } from '../components/wallet/ticketCoverage';
import '../components/wallet/wallet.css';

export interface WalletPageProps {
  /** Optional override for embedded previews; normally read from React Router. */
  tripId?: string;
  /** Optional same-origin SEPTA proxy supplied by the host app; never a secret. */
  septaEndpoint?: string;
}

function tripIdFromLocation(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const match = /^\/wallet\/([^/]+)\/?$/.exec(window.location.pathname);
  try { return match ? decodeURIComponent(match[1]) : undefined; } catch { return undefined; }
}

function TripWallet({ trip, septaEndpoint }: { trip: Trip; septaEndpoint?: string }) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const completed = trip.legs.filter(leg => checked.has(leg.id)).length;
  return <>
    <Link className="ol-button" to={`/journey/${trip.id}`}>Back to journey</Link>
    <header className="ol-header"><span className="ol-eyebrow">ONELINE / TRIP WALLET</span>
      <h1>Where to buy<br />each ticket</h1>
      <p className="ol-route">{trip.origin} <span aria-hidden="true">→</span> {trip.destination}</p>
      <p className="ol-muted">{trip.legs.length} travel {trip.legs.length === 1 ? 'leg' : 'legs'} · Demo itinerary{Number.isFinite(trip.durationMinutes) && ` · ${formatDuration(trip.durationMinutes)}`}</p>
    </header>
    <aside className="ol-notice"><strong>OneLine doesn’t sell tickets. Buy them from each agency.</strong><p>This wallet is a demo mockup, not a boarding pass. Times are simulated itinerary data. Checklist marks are demo-only and do not confirm payment, ticket validity, or boarding eligibility. Prices and availability must be checked with each agency.</p></aside>
    <section className="ol-progress" aria-labelledby="ol-checklist-title"><div className="ol-section-heading"><h2 id="ol-checklist-title">Per-leg planning checklist</h2><span role="status" aria-atomic="true">{completed} / {trip.legs.length} demo items checked</span></div>
      <progress aria-label="Demo checklist progress" value={completed} max={Math.max(trip.legs.length, 1)} />
      <p className="ol-muted">One planning note per leg, not one purchase per leg. Marks reset when you change trips or reload this wallet.</p>
    </section>
    {trip.legs.length ? <ol className="ol-ticket-list">{trip.legs.map((leg, index) => <TicketCard key={leg.id} leg={leg} index={index} throughTicketNote={lirrThroughTicketNote(trip.legs, index)} checked={checked.has(leg.id)} onToggle={() => setChecked(previous => {
      const next = new Set(previous); if (next.has(leg.id)) next.delete(leg.id); else next.add(leg.id); return next;
    })} />)}</ol> : <section className="ol-empty"><h2>No travel legs supplied</h2><p>Choose a complete journey to see its agency ticket requirements.</p></section>}
    {trip.legs.some(leg => leg.agency === 'SEPTA') && <TransitStatus endpoint={septaEndpoint} />}
    <footer className="ol-footer">Independent hackathon prototype. OneLine does not sell, activate, or store agency tickets.</footer>
  </>;
}

export default function WalletPage({ tripId, septaEndpoint }: WalletPageProps) {
  const { tripId: routeTripId } = useParams<{ tripId: string }>();
  const id = tripId ?? routeTripId ?? tripIdFromLocation();
  const trip = getTripById(id);
  return <div className="oneline-wallet">
    {trip ? <TripWallet key={trip.id} trip={trip} septaEndpoint={septaEndpoint} /> : <section className="ol-empty"><span className="ol-eyebrow">TRIP WALLET</span><h1>{id ? 'Journey not found' : 'Choose your journey first'}</h1><p>Open a wallet from the journey search results. No tickets or itinerary have been created.</p><Link className="ol-button" to="/">Find a journey</Link></section>}
  </div>;
}
