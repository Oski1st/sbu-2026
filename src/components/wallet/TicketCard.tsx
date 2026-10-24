import type { Leg } from '../../types/transit';
import { officialPurchaseUrl, ticketing } from './ticketing';

function itineraryTime(value: string): string {
  if (!value) return 'Time not supplied';
  const date = new Date(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
  }).format(date);
}

export interface TicketCardProps {
  leg: Leg;
  index: number;
  checked: boolean;
  onToggle: () => void;
  throughTicketNote?: string;
}

export function TicketCard({ leg, index, checked, onToggle, throughTicketNote }: TicketCardProps) {
  const agency = ticketing[leg.agency];
  return (
    <li className={`ol-ticket ${checked ? 'ol-ticket-checked' : ''}`}>
      <div className="ol-ticket-top">
        <span className="ol-agency">{agency?.name ?? 'Unsupported agency'} · Leg {index + 1}</span>
        <span className={`ol-status ${checked ? 'ol-status-done' : ''}`}>
          {checked ? '✓ Demo item checked' : 'Demo item not checked'}
        </span>
      </div>
      <h2>{leg.line}</h2>
      <div className="ol-stations">
        <div><span className="ol-label">From</span><strong>{leg.from}</strong></div>
        <span aria-hidden="true" className="ol-arrow">→</span>
        <div><span className="ol-label">To</span><strong>{leg.to}</strong></div>
      </div>
      <p className="ol-schedule">Demo itinerary: {itineraryTime(leg.departure)} → {itineraryTime(leg.arrival)}</p>
      <p>{agency?.help ?? 'This agency is outside the current shared integration contract. Confirm ticketing with the agency.'}</p>
      {throughTicketNote && <p className="ol-coverage" id={`ol-coverage-${index}`}>{throughTicketNote}</p>}
      <div className="ol-ticket-actions">
        {agency && <a className="ol-button" href={officialPurchaseUrl(leg.agency, leg.purchaseUrl)} target="_blank" rel="noopener noreferrer">{agency.label} <span aria-hidden="true">↗</span><span className="ol-sr-only"> (opens in a new tab)</span></a>}
        <label className="ol-check"><input type="checkbox" checked={checked} onChange={onToggle} aria-describedby={`ol-check-help-${index}${throughTicketNote ? ` ol-coverage-${index}` : ''}`} />Mark leg {index + 1} planning note as checked</label>
      </div>
      <p className="ol-fine" id={`ol-check-help-${index}`}>Demo planning note only. Checking this box does not purchase a ticket, confirm payment, or establish ticket validity. Actual tickets stay with the agency.</p>
    </li>
  );
}
