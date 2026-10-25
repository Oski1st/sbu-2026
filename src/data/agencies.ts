import type { Agency } from "../types";
import { AMTRAK_BOOKING_URL } from "../lib/amtrakHandoff";
export const agencies: Record<
  Agency,
  {
    name: string;
    shortName: string;
    color: string;
    purchaseUrl: string;
    mode: "rail" | "bus";
  }
> = {
  SEPTA: {
    mode: "rail",
    name: "SEPTA",
    shortName: "SEPTA",
    color: "#4276c7",
    purchaseUrl: "https://www.septa.org/fares/",
  },
  NJ_TRANSIT: {
    mode: "rail",
    name: "NJ TRANSIT",
    shortName: "NJT",
    color: "#d87835",
    purchaseUrl: "https://www.njtransit.com/tickets/train-tickets",
  },
  LIRR: {
    mode: "rail",
    name: "Long Island Rail Road",
    shortName: "LIRR",
    color: "#5372c1",
    purchaseUrl: "https://www.mta.info/traintime",
  },
  AMTRAK: {
    mode: "rail",
    name: "Amtrak",
    shortName: "Amtrak",
    color: "#246b63",
    purchaseUrl: AMTRAK_BOOKING_URL,
  },
  GREYHOUND: {
    name: "Greyhound",
    shortName: "Greyhound",
    color: "#28558a",
    mode: "bus",
    purchaseUrl: "https://www.greyhound.com/",
  },
  FLIXBUS: {
    name: "FlixBus",
    shortName: "FlixBus",
    color: "#4b7416",
    mode: "bus",
    purchaseUrl: "https://www.flixbus.com/",
  },
};
