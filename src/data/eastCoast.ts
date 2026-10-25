import type { Agency, Leg, Trip } from "../types";
import { agencies } from "./agencies";

/** Coverage is a sample planning catalogue, not a list of verified bookable services. */
export const cities = [
  ["portland", "Portland", "ME"],
  ["boston", "Boston", "MA"],
  ["providence", "Providence", "RI"],
  ["hartford", "Hartford", "CT"],
  ["new-haven", "New Haven", "CT"],
  ["albany", "Albany", "NY"],
  ["new-york", "New York", "NY"],
  ["stony-brook", "Stony Brook", "NY"],
  ["trenton", "Trenton", "NJ"],
  ["philadelphia", "Philadelphia", "PA"],
  ["baltimore", "Baltimore", "MD"],
  ["washington", "Washington, DC", "DC"],
  ["richmond", "Richmond", "VA"],
  ["norfolk", "Norfolk", "VA"],
  ["raleigh", "Raleigh", "NC"],
  ["charlotte", "Charlotte", "NC"],
  ["fayetteville", "Fayetteville", "NC"],
  ["charleston", "Charleston", "SC"],
  ["savannah", "Savannah", "GA"],
  ["jacksonville", "Jacksonville", "FL"],
  ["orlando", "Orlando", "FL"],
  ["tampa", "Tampa", "FL"],
  ["fort-lauderdale", "Fort Lauderdale", "FL"],
  ["miami", "Miami", "FL"],
].map(([id, name, state]) => ({ id, name, state }));

const normalize = (value: string) =>
  value.toLowerCase().trim().replace(/[.,]/g, "").replace(/\s+/g, " ");
const aliases: Record<string, string> = {
  nyc: "new-york",
  "new york city": "new-york",
  philly: "philadelphia",
  dc: "washington",
  "washington dc": "washington",
  "washington d c": "washington",
  "portland maine": "portland",
  "portland me": "portland",
  "long island": "stony-brook",
};
export function resolveCity(value: string) {
  const key = normalize(value);
  return cities.find(
    (city) =>
      city.id === aliases[key] ||
      city.id === key ||
      normalize(city.name) === key ||
      normalize(`${city.name}, ${city.state}`) === key,
  );
}

type Edge = {
  from: string;
  to: string;
  minutes: number;
  agency: Agency;
  line: string;
};
const rail: Edge[] = [];
const bus: Omit<Edge, "agency">[] = [];
function corridor(
  target: Edge[],
  stops: string[],
  minutes: number[],
  line: string,
  agency: Agency = "AMTRAK",
) {
  stops
    .slice(1)
    .forEach((to, i) =>
      target.push({ from: stops[i], to, minutes: minutes[i], agency, line }),
    );
}
corridor(rail, ["portland", "boston"], [150], "Downeaster · sample");
corridor(
  rail,
  [
    "boston",
    "providence",
    "new-haven",
    "new-york",
    "trenton",
    "philadelphia",
    "baltimore",
    "washington",
  ],
  [40, 95, 100, 55, 30, 65, 40],
  "Northeast Regional · sample",
);
corridor(rail, ["hartford", "new-haven"], [45], "Hartford Line · sample");
corridor(rail, ["albany", "new-york"], [155], "Empire Service · sample");
corridor(
  rail,
  [
    "washington",
    "richmond",
    "fayetteville",
    "charleston",
    "savannah",
    "jacksonville",
    "orlando",
    "fort-lauderdale",
    "miami",
  ],
  [130, 240, 190, 105, 155, 190, 260, 45],
  "Silver Meteor corridor · sample",
);
corridor(
  rail,
  ["richmond", "raleigh", "charlotte"],
  [230, 190],
  "Carolinian · sample",
);
corridor(rail, ["richmond", "norfolk"], [140], "Northeast Regional · sample");
corridor(rail, ["orlando", "tampa"], [120], "Florida rail corridor · sample");
corridor(
  rail,
  ["new-york", "stony-brook"],
  [180],
  "LIRR connection concept · changes to confirm",
  "LIRR",
);

function busCorridor(stops: string[], minutes: number[]) {
  stops
    .slice(1)
    .forEach((to, i) =>
      bus.push({
        from: stops[i],
        to,
        minutes: minutes[i],
        line: "Intercity coach corridor · sample",
      }),
    );
}
busCorridor(
  [
    "portland",
    "boston",
    "providence",
    "new-york",
    "trenton",
    "philadelphia",
    "baltimore",
    "washington",
    "richmond",
    "raleigh",
    "fayetteville",
    "charleston",
    "savannah",
    "jacksonville",
    "orlando",
    "fort-lauderdale",
    "miami",
  ],
  [135, 65, 210, 90, 50, 115, 60, 130, 180, 80, 200, 115, 145, 155, 205, 55],
);
busCorridor(["boston", "hartford", "new-haven", "new-york"], [120, 55, 110]);
busCorridor(["albany", "new-york"], [170]);
busCorridor(["richmond", "norfolk"], [120]);
busCorridor(["raleigh", "charlotte"], [180]);
busCorridor(["orlando", "tampa"], [110]);

/** Static concept graph export for on-demand routing; no trips computed here. */
export function getConceptEdges(profile: "AMTRAK" | "GREYHOUND" | "FLIXBUS"): Edge[] {
  const forward: Edge[] = profile === "AMTRAK" ? rail
    : [...bus.map(edge => ({ ...edge, agency: profile })), ...rail.filter(edge => edge.agency === "LIRR")];
  return forward.flatMap(edge => [{ ...edge }, { ...edge, from: edge.to, to: edge.from }]);
}

/** Dijkstra on an illustrative city graph; it makes no claim about actual service availability. */
function pathBetween(
  edges: Edge[],
  origin: string,
  destination: string,
): Edge[] | undefined {
  const distance = new Map<string, number>([[origin, 0]]);
  const previous = new Map<string, Edge>();
  const remaining = new Set(cities.map((c) => c.id));
  while (remaining.size) {
    const current = [...remaining].sort(
      (a, b) => (distance.get(a) ?? Infinity) - (distance.get(b) ?? Infinity),
    )[0];
    if (!distance.has(current)) break;
    remaining.delete(current);
    if (current === destination) break;
    for (const edge of edges.filter(
      (e) => e.from === current && remaining.has(e.to),
    )) {
      const cost = distance.get(current)! + edge.minutes;
      if (cost < (distance.get(edge.to) ?? Infinity)) {
        distance.set(edge.to, cost);
        previous.set(edge.to, edge);
      }
    }
  }
  if (!previous.has(destination)) return undefined;
  const path: Edge[] = [];
  for (let node = destination; node !== origin; ) {
    const edge = previous.get(node);
    if (!edge) return undefined;
    path.unshift(edge);
    node = edge.from;
  }
  return path;
}

const cityName = (id: string) => cities.find((c) => c.id === id)!.name;
export const samplePlanningNote =
  "City-level concept only. Times, connections and operator coverage are illustrative, not verified services. Confirm terminals, station changes, schedules, fares and availability with each operator before booking.";
const start = Date.parse("2026-10-24T08:00:00-04:00");

export function buildEastCoastTrips(): Trip[] {
  const trips: Trip[] = [];
  for (const profile of ["AMTRAK", "GREYHOUND", "FLIXBUS"] as const) {
    const forward: Edge[] =
      profile === "AMTRAK"
        ? rail
        : [
            ...bus.map((edge) => ({ ...edge, agency: profile })),
            ...rail.filter((edge) => edge.agency === "LIRR"),
          ];
    const edges = forward.flatMap((edge) => [
      edge,
      { ...edge, from: edge.to, to: edge.from },
    ]);
    for (const from of cities)
      for (const to of cities) {
        if (from.id === to.id) continue;
        // Preserve the original fully specified hackathon demo and its stable IDs.
        if (from.id === "philadelphia" && to.id === "stony-brook") continue;
        const path = pathBetween(edges, from.id, to.id);
        if (!path) continue;
        const id = `east-${from.id}--${to.id}--${profile.toLowerCase()}`;
        // Consecutive same-service edges form a conceptual corridor leg, not a claim of a direct train/bus.
        const groups: Edge[] = [];
        for (const edge of path) {
          const last = groups.at(-1);
          if (last && last.agency === edge.agency && last.line === edge.line) {
            last.to = edge.to;
            last.minutes += edge.minutes;
          } else groups.push({ ...edge });
        }
        let elapsed =
          profile === "GREYHOUND" ? 30 : profile === "FLIXBUS" ? 60 : 0;
        const offset = elapsed;
        const legs: Leg[] = groups.map((edge, i) => {
          if (i) elapsed += 60; // Illustrative connection interval, not minimum-transfer guidance.
          const departure = new Date(start + elapsed * 60000).toISOString();
          elapsed += edge.minutes;
          return {
            id: `${id}-${i + 1}`,
            agency: edge.agency,
            mode: agencies[edge.agency].mode,
            line: edge.line,
            from: cityName(edge.from),
            to: cityName(edge.to),
            departure,
            arrival: new Date(start + elapsed * 60000).toISOString(),
            purchaseUrl: agencies[edge.agency].purchaseUrl,
          };
        });
        if (profile !== "AMTRAK" && !legs.some((leg) => leg.agency === profile))
          continue;
        const primaryAgency =
          profile === "AMTRAK" && legs.every((leg) => leg.agency === "LIRR")
            ? "LIRR"
            : profile;
        trips.push({
          id,
          origin: from.name,
          destination: to.name,
          durationMinutes: elapsed - offset,
          legs,
          dataStatus: "sample",
          label: `${agencies[primaryAgency].name} ${agencies[primaryAgency].mode === "rail" ? "rail" : "coach"} concept`,
          description:
            "Check actual services and fares with the operator.",
          planningNote: samplePlanningNote,
        });
      }
  }
  return trips;
}

export const featuredCorridors = [
  {
    origin: "Boston",
    destination: "New York",
    label: "Show sample trips",
    region: "NEW ENGLAND",
  },
  {
    origin: "New York",
    destination: "Washington, DC",
    label: "Show sample trips",
    region: "MID-ATLANTIC",
  },
  {
    origin: "Raleigh",
    destination: "Charlotte",
    label: "Show sample trips",
    region: "THE CAROLINAS",
  },
  {
    origin: "Orlando",
    destination: "Miami",
    label: "Show sample trips",
    region: "FLORIDA",
  },
];
