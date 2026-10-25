import type { Leg } from "../types/transit";

/**
 * Amtrak session booking URLs expire after about five minutes, so OneLine never
 * stores one. src/lib/purchase builds Amtrak's non-expiring From/To/Date search
 * link when it can; otherwise booking actions open this stable page. Either way
 * the trip details are copied at click time.
 */
export const AMTRAK_BOOKING_URL = "https://www.amtrak.com/";

export const AMTRAK_HANDOFF_NOTE =
  "Amtrak booking links expire after a few minutes, so OneLine opens Amtrak's booking page. Your trip details are copied — enter them in From, To and Date.";

export type AmtrakTripDetails = Partial<Pick<Leg, "from" | "to" | "departure" | "line">> & {
  train?: string;
  /** YYYY-MM-DD travel date (the Search date); replaces the sample departure's date. */
  date?: string;
};

const zone = "America/New_York";
const calendarFormat = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });
const dateFormat = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit" });

/** Station names use " · " internally; swap it so it can't be confused with the field separator. */
const clean = (value?: string) => (value ?? "").replace(/\s*·\s*/g, ", ").replace(/\s+/g, " ").trim();

/** e.g. "Amtrak · Philadelphia, 30th Street → New York Penn Station · Sat, Oct 24, 2026 · dep 8:30 AM · Northeast Regional" */
export function amtrakTripText(details: AmtrakTripDetails): string {
  const from = clean(details.from);
  const to = clean(details.to);
  const parts = ["Amtrak"];
  if (from && to) parts.push(`${from} → ${to}`);
  else if (from) parts.push(`From ${from}`);
  else if (to) parts.push(`To ${to}`);
  const departure = details.departure ?? "";
  const parsed = /^\d{4}-\d{2}-\d{2}T/.test(departure) ? new Date(departure) : null;
  const date = parsed && Number.isFinite(parsed.getTime()) ? parsed : null;
  // The Search date (YYYY-MM-DD) replaces the sample date; the sample departure time stays.
  const travel = details.date && /^\d{4}-\d{2}-\d{2}$/.test(details.date) ? new Date(`${details.date}T12:00:00Z`) : null;
  if (travel && Number.isFinite(travel.getTime())) parts.push(calendarFormat.format(travel));
  else if (date) parts.push(dateFormat.format(date));
  if (date) {
    parts.push(`dep ${timeFormat.format(date).replace(/ /g, " ")}`);
  }
  const train = clean(details.train);
  if (train) parts.push(`Train ${train}`);
  const line = clean(details.line);
  if (line) parts.push(line);
  return parts.join(" · ");
}

/**
 * Copies with the async Clipboard API. Without it, selects the visible text
 * field and tries the legacy copy command. Resolves false when the user must copy manually.
 */
export async function copyTripText(text: string, field?: HTMLInputElement | null): Promise<boolean> {
  const clipboard = typeof navigator === "undefined" ? undefined : navigator.clipboard;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      /* Permission denied or document unfocused: fall through to the visible field. */
    }
  }
  if (!field) return false;
  field.focus();
  field.select();
  try {
    return typeof document !== "undefined" && document.execCommand("copy");
  } catch {
    return false;
  }
}
