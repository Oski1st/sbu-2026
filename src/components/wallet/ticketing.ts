import type { Agency } from '../../types/transit';
import { AMTRAK_BOOKING_URL } from '../../lib/amtrakHandoff';

export const ticketing: Record<Agency, { name: string; url: string; label: string; help: string }> = {
  SEPTA: {
    name: 'SEPTA', url: 'https://www.septa.org/fares/ways-to-pay/',
    label: 'SEPTA payment options',
    help: 'Review the official payment options for your service. OneLine does not issue or validate tickets.',
  },
  NJ_TRANSIT: {
    name: 'NJ TRANSIT', url: 'https://www.njtransit.com/app',
    label: 'NJ TRANSIT app & tickets',
    help: 'Use the official NJ TRANSIT app to choose your stations and purchase the appropriate ticket.',
  },
  LIRR: {
    name: 'Long Island Rail Road', url: 'https://www.mta.info/traintime',
    label: 'MTA TrainTime & tickets',
    help: 'Use MTA TrainTime for LIRR ticket options. Confirm stations and ticket conditions with MTA.',
  },
  AMTRAK: {
    name: 'Amtrak', url: AMTRAK_BOOKING_URL,
    label: 'Amtrak booking & app',
    help: 'Book with Amtrak directly and confirm your selected train, travel date, and reservation conditions.',
  },
  GREYHOUND: { name: 'Greyhound', url: 'https://www.greyhound.com/', label: 'Greyhound booking & tickets', help: 'Choose actual cities, terminals and travel dates with Greyhound. Sample plans do not confirm direct service, connections, availability or a ticket.' },
  FLIXBUS: { name: 'FlixBus', url: 'https://www.flixbus.com/', label: 'FlixBus booking & tickets', help: 'Choose actual cities, terminals and travel dates with FlixBus. Sample plans do not confirm direct service, connections, availability or a ticket.' },
};

/** Accept only HTTPS agency-owned destinations; never follow arbitrary trip-data links. */
export function officialPurchaseUrl(agency: Agency, candidate: string): string {
  const fallback = ticketing[agency]?.url;
  if (!fallback) return '';
  // Amtrak session URLs expire within minutes: only ever hand off to the stable booking page.
  if (agency === 'AMTRAK') return AMTRAK_BOOKING_URL;
  const domains: Record<Agency, string[]> = {
    SEPTA: ['septa.org', 'septakey.org'], NJ_TRANSIT: ['njtransit.com'], LIRR: ['mta.info'], AMTRAK: ['amtrak.com'], GREYHOUND: ['greyhound.com'], FLIXBUS: ['flixbus.com'],
  };
  try {
    const url = new URL(candidate);
    if (url.protocol === 'https:' && !url.username && !url.password && !url.port &&
      domains[agency].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
      return url.href;
    }
  } catch { /* Invalid or missing shared URL: use the verified agency information page. */ }
  return fallback;
}
