import type { Leg, Trip } from "../types";
import { agencies } from "./agencies";
const time = (hhmm: string) => `2026-10-24T${hhmm}:00-04:00`;
const leg = (
  id: string,
  agency: Leg["agency"],
  line: string,
  from: string,
  to: string,
  departure: string,
  arrival: string,
  amount?: number,
): Leg => ({
  id,
  agency,
  line,
  from,
  to,
  departure: time(departure),
  arrival: time(arrival),
  purchaseUrl: agencies[agency].purchaseUrl,
  ...(amount === undefined
    ? {}
    : { fare: { amount, currency: "USD", status: "sample" } }),
});
/** Illustrative itineraries only. These are NOT timetables, fare quotes, or live arrivals.
 * Network references: https://www.njtransit.com/getting-new-york-train
 * https://www.amtrak.com/stations/phl · https://www.mta.info/stations/stony-brook
 * Zero-dollar continuation legs share the preceding illustrative LIRR fare.
 * LIRR train changes are modeled as separate legs, including Huntington.
 */
export const originalDemoTrips: Trip[] = [
  {
    id: "regional-connection",
    origin: "Philadelphia",
    destination: "Stony Brook",
    durationMinutes: 315,
    dataStatus: "sample",
    label: "The scenic connection",
    description: "A little more time. A lot more possibility.",
    legs: [
      leg(
        "regional-1",
        "SEPTA",
        "Trenton Line",
        "Philadelphia · 30th Street",
        "Trenton Transit Center",
        "08:00",
        "08:55",
        10,
      ),
      leg(
        "regional-2",
        "NJ_TRANSIT",
        "Northeast Corridor",
        "Trenton Transit Center",
        "New York Penn Station",
        "09:10",
        "10:40",
        20,
      ),
      leg(
        "regional-3",
        "LIRR",
        "Port Jefferson Branch",
        "New York Penn Station",
        "Huntington",
        "11:00",
        "12:10",
        16,
      ),
      leg(
        "regional-4",
        "LIRR",
        "Port Jefferson Branch",
        "Huntington",
        "Stony Brook",
        "12:25",
        "13:15",
        0,
      ),
    ],
  },
  {
    id: "amtrak-connection",
    origin: "Philadelphia",
    destination: "Stony Brook",
    durationMinutes: 250,
    dataStatus: "sample",
    label: "The express connection",
    description: "Trade a transfer for a little more breathing room.",
    legs: [
      leg(
        "express-1",
        "AMTRAK",
        "Northeast Regional",
        "Philadelphia · 30th Street",
        "New York Penn Station",
        "08:30",
        "09:50",
        45,
      ),
      leg(
        "express-2",
        "LIRR",
        "Port Jefferson Branch",
        "New York Penn Station",
        "Huntington",
        "10:10",
        "11:20",
        16,
      ),
      leg(
        "express-3",
        "LIRR",
        "Port Jefferson Branch",
        "Huntington",
        "Stony Brook",
        "11:45",
        "12:40",
        0,
      ),
    ],
  },
];
