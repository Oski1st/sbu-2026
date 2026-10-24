import { originalDemoTrips } from './originalDemoTrips';
import { buildEastCoastTrips } from './eastCoast';
/** Legacy eager compatibility export: remove only after all shared consumers migrate. */
export const demoTrips = [...originalDemoTrips, ...buildEastCoastTrips()];
