import type { Agency } from '../../types/transit';
import { officialTicketPage } from '../../lib/purchase/official';

export const ticketing: Record<Agency, { name: string; url: string; label: string; help: string }> = {
  SEPTA: {
    name: 'SEPTA', url: officialTicketPage('SEPTA'),
    label: 'SEPTA payment options',
    help: 'Review the official payment options for your service. OneLine does not issue or validate tickets.',
  },
  NJ_TRANSIT: {
    name: 'NJ TRANSIT', url: officialTicketPage('NJ_TRANSIT'),
    label: 'NJ TRANSIT app & tickets',
    help: 'Use the official NJ TRANSIT app to choose your stations and purchase the appropriate ticket.',
  },
  LIRR: {
    name: 'Long Island Rail Road', url: officialTicketPage('LIRR'),
    label: 'MTA TrainTime & tickets',
    help: 'Use MTA TrainTime for LIRR ticket options. Confirm stations and ticket conditions with MTA.',
  },
  AMTRAK: {
    name: 'Amtrak', url: officialTicketPage('AMTRAK'),
    label: 'Amtrak booking & app',
    help: 'Book with Amtrak directly and confirm your selected train, travel date, and reservation conditions.',
  },
  GREYHOUND: { name: 'Greyhound', url: officialTicketPage('GREYHOUND'), label: 'Greyhound booking & tickets', help: 'Choose actual cities, terminals and travel dates with Greyhound. Sample plans do not confirm direct service, connections, availability or a ticket.' },
  FLIXBUS: { name: 'FlixBus', url: officialTicketPage('FLIXBUS'), label: 'FlixBus booking & tickets', help: 'Choose actual cities, terminals and travel dates with FlixBus. Sample plans do not confirm direct service, connections, availability or a ticket.' },
};

/** Moved to src/lib/purchase/official.ts; links themselves come from purchaseLinkForLeg. */
export { officialPurchaseUrl } from '../../lib/purchase/official';
