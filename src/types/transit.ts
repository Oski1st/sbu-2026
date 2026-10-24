/** Shared contract. Times are ISO 8601 with an explicit UTC offset. */
export type Agency = "SEPTA" | "NJ_TRANSIT" | "LIRR" | "AMTRAK";
export interface Fare {
  amount: number;
  currency: "USD";
  status: "sample" | "verified";
}
export interface Leg {
  id: string;
  agency: Agency;
  line: string;
  from: string;
  to: string;
  departure: string;
  arrival: string;
  /** Official agency ticket information/booking page; not a purchased ticket. */
  purchaseUrl: string;
  fare?: Fare;
}
export interface Trip {
  id: string;
  origin: string;
  destination: string;
  durationMinutes: number;
  legs: Leg[];
  /** Optional for compatibility; every provided demo trip is explicitly sample. */
  dataStatus?: "sample" | "live";
  label?: string;
  description?: string;
}
