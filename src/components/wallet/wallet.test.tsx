import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import WalletPage from '../../pages/WalletPage';
import { demoTrips } from '../../data/demoTrips';
import { getTripById } from '../../data/tripLookup';
import { officialPurchaseUrl, ticketing } from './ticketing';
import { lirrThroughTicketNote } from './ticketCoverage';
import { TicketCard } from './TicketCard';
import { TransitSnapshot } from './TransitStatus';
import type { SeptaResult } from '../../services/transit/septa';

function markup(tripId: string) {
  return renderToStaticMarkup(<MemoryRouter><WalletPage tripId={tripId} septaEndpoint="/api/transit/septa/trains" /></MemoryRouter>);
}

describe('shared wallet integration', () => {
  test.each(['regional-connection', 'amtrak-connection'])('%s renders every shared leg and official ticket destination', id => {
    const trip = getTripById(id)!;
    const html = markup(id);
    expect(html.match(/type="checkbox"/g)).toHaveLength(trip.legs.length);
    for (const leg of trip.legs) {
      expect(html).toContain(leg.from.replaceAll('&', '&amp;'));
      expect(html).toContain(leg.to.replaceAll('&', '&amp;'));
      expect(html).toContain(officialPurchaseUrl(leg.agency, leg.purchaseUrl));
      expect(html).toContain(ticketing[leg.agency].label.replaceAll('&', '&amp;'));
    }
    expect(html).toContain('Times are simulated itinerary data');
    expect(html).toContain('not confirm payment');
    expect(html).not.toContain('Live feed fetched');
  });

  test('a planning preference labels the shifted wallet timeline; the fixed sample does not', () => {
    const shifted = renderToStaticMarkup(<MemoryRouter initialEntries={['/wallet/regional-connection?date=2026-11-03&time=16:30']}><WalletPage tripId="regional-connection" /></MemoryRouter>);
    expect(shifted).toContain('Sample timeline shifted to your planning preference');
    expect(shifted).toContain('Nov 3, 4:30 PM EST');
    expect(markup('regional-connection')).not.toContain('shifted to your planning preference');
  });

  test('Amtrak wallet has no unrelated SEPTA feed panel', () => {
    expect(markup('amtrak-connection')).not.toContain('SEPTA service snapshot');
    expect(markup('regional-connection')).toContain('SEPTA service snapshot');
  });

  test('unknown IDs do not silently show another itinerary', () => {
    const html = markup('missing-trip');
    expect(html).toContain('Journey not found');
    expect(html).not.toContain('type="checkbox"');
    expect(html).toContain('href="/"');
  });

  test.each(['regional-connection', 'amtrak-connection', 'missing-trip'])('%s leaves navigation and the main landmark to the shared shell', id => {
    const html = markup(id);
    expect(html).toMatch(/^<div class="oneline-wallet">/);
    expect(html).not.toContain('<main');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('ol-brand');
    expect(html).not.toContain('Back to journey search');
  });

  test.each(['regional-connection', 'amtrak-connection'])('%s explains shared LIRR coverage without equating legs to purchases', id => {
    const html = markup(id);
    expect(html.match(/may share one through ticket/g)).toHaveLength(2);
    expect(html).toContain('A train change does not mean you must buy twice');
    expect(html).toContain('One planning note per leg, not one purchase per leg');
    expect(html).not.toContain('Purchase needed');
    const trip = getTripById(id)!;
    const firstLirr = trip.legs.findIndex(leg => leg.agency === 'LIRR');
    expect(lirrThroughTicketNote(trip.legs, firstLirr)).toBe(lirrThroughTicketNote(trip.legs, firstLirr + 1));
    expect(lirrThroughTicketNote(trip.legs, 0)).toBeUndefined();
    const disconnected = trip.legs.map(leg => ({ ...leg }));
    disconnected[firstLirr + 1].from = 'Different station';
    expect(lirrThroughTicketNote(disconnected, firstLirr)).toBeUndefined();
  });

  test('checked planning notes retain explicit no-purchase and validity explanations', () => {
    const leg = demoTrips[0].legs[0];
    const html = renderToStaticMarkup(<TicketCard leg={leg} index={0} checked onToggle={() => {}} />);
    expect(html).toContain('Demo item checked');
    expect(html).toContain('does not purchase a ticket, confirm payment, or establish ticket validity');
    expect(html).toContain('aria-describedby="ol-check-help-0"');
    expect(html).toContain('id="ol-check-help-0"');
  });

  test('unsafe or wrong-agency ticket URLs fall back to official destinations', () => {
    for (const agency of ['SEPTA', 'NJ_TRANSIT', 'LIRR', 'AMTRAK'] as const) {
      for (const value of ['javascript:alert(1)', 'https://mta.info.evil.test/', 'https://user:pass@www.amtrak.com/', 'http://www.septa.org/']) {
        expect(officialPurchaseUrl(agency, value)).toBe(ticketing[agency].url);
      }
    }
  });
});

describe('accessible feed explanations', () => {
  const live: SeptaResult = { status: 'live', source: 'test-only', fetchedAt: '2026-10-24T18:00:00Z',
    trains: [{ trainNumber: 'TEST-ONLY', line: 'Test line', destination: 'Test destination', nextStop: 'Test stop', delayMinutes: null }] };
  test('retrieval and expiry are explicit and use a semantic timestamp', () => {
    const html = renderToStaticMarkup(<TransitSnapshot result={live} stale={false} />);
    expect(html).toContain('expires after 60 seconds');
    expect(html).toContain('dateTime="2026-10-24T18:00:00Z"');
    expect(html).toContain('our retrieval time');
    expect(html).toContain('Agency-wide Regional Rail observations');
    expect(html).toContain('Demo departure and arrival times remain simulated');
    expect(html).toContain('role="status" aria-live="polite" aria-atomic="true"');
  });
  test('expired snapshots hide trains while retaining retrieval time and recovery instruction', () => {
    const html = renderToStaticMarkup(<TransitSnapshot result={live} stale />);
    expect(html).toContain('Snapshot expired. Observations are hidden. Refresh feed');
    expect(html).toContain('Last retrieved');
    expect(html).not.toContain('TEST-ONLY');
  });
  test('empty, unavailable, and loading states remain distinct', () => {
    const empty = renderToStaticMarkup(<TransitSnapshot result={{ ...live, trains: [] }} stale={false} />);
    expect(empty).toContain('no active trains');
    expect(empty).toContain('does not confirm that service has stopped');
    expect(empty).toContain('Snapshots expire after 60 seconds');
    expect(empty).not.toContain('unavailable');
    const unavailable = renderToStaticMarkup(<TransitSnapshot result={{ status: 'unavailable', reason: 'Test outage', source: 'test-only' }} stale={false} />);
    expect(unavailable).toContain('observations unavailable');
    expect(unavailable).not.toContain('Last retrieved');
    const loading = renderToStaticMarkup(<TransitSnapshot result={null} stale={false} />);
    expect(loading).toContain('Refreshing SEPTA observations. Please wait');
  });
});
