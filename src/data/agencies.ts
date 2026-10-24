import type { Agency } from "../types";
export const agencies: Record<
  Agency,
  { name: string; shortName: string; color: string; purchaseUrl: string }
> = {
  SEPTA: {
    name: "SEPTA",
    shortName: "SEPTA",
    color: "#4276c7",
    purchaseUrl: "https://wwww.septa.org/fares/",
  },
  NJ_TRANSIT: {
    name: "NJ TRANSIT",
    shortName: "NJT",
    color: "#d87835",
    purchaseUrl: "https://www.njtransit.com/tickets/train-tickets",
  },
  LIRR: {
    name: "Long Island Rail Road",
    shortName: "LIRR",
    color: "#5372c1",
    purchaseUrl: "https://www.mta.info/traintime",
  },
  AMTRAK: {
    name: "Amtrak",
    shortName: "Amtrak",
    color: "#246b63",
    purchaseUrl: "https://www.amtrak.com/",
  },
};
