import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import WalletPage from '../../pages/WalletPage';
import { demoTrips } from '../../data/demoTrips';
import { officialPurchaseUrl, ticketing } from './ticketing';

function markup(tripId: string) {
  return renderToStaticMarkup(<MemoryRouter><WalletPage tripId={tripId} septaEndpoint="/api/transit/septa/trains" /></MemoryRouter>);
}

describe('shared wallet integration', () => {
  test.each(['regional-connection', 'amtrak-connection'])('%s renders every shared leg and official ticket destination', id => {
    const trip = demoTrips.find(candidate => candidate.id === id)!;
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

  test('Amtrak wallet has no unrelated SEPTA feed panel', () => {
    expect(markup('amtrak-connection')).not.toContain('SEPTA service snapshot');
    expect(markup('regional-connection')).toContain('SEPTA service snapshot');
  });

  test('unknown IDs do not silently show another itinerary', () => {
    const html = markup('missing-trip');
    expect(html).toContain('Journey not found');
    expect(html).not.toContain('type="checkbox"');
  });

  test('unsafe or wrong-agency ticket URLs fall back to official destinations', () => {
    for (const agency of ['SEPTA', 'NJ_TRANSIT', 'LIRR', 'AMTRAK'] as const) {
      for (const value of ['javascript:alert(1)', 'https://mta.info.evil.test/', 'https://user:pass@www.amtrak.com/', 'http://www.septa.org/']) {
        expect(officialPurchaseUrl(agency, value)).toBe(ticketing[agency].url);
      }
    }
  });
});
