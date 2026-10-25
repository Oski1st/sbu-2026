import { todayInNewYork } from "../../data/searchState";

/** True for a real YYYY-MM-DD calendar date. */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** New York calendar date (YYYY-MM-DD) of an ISO timestamp, or undefined. */
export function easternDate(iso: string | undefined): string | undefined {
  if (!iso || !/^\d{4}-\d{2}-\d{2}T/.test(iso)) return undefined;
  const instant = new Date(iso);
  return Number.isFinite(instant.getTime()) ? todayInNewYork(instant) : undefined;
}

function utcDay(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day);
  return value.getTime();
}

export function addDays(date: string, days: number): string {
  const value = new Date(utcDay(date) + days * 86_400_000);
  return `${String(value.getUTCFullYear()).padStart(4, "0")}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((utcDay(to) - utcDay(from)) / 86_400_000);
}

/**
 * The calendar date to book a leg on. The Search date applies to the trip's first
 * departure; later legs keep their day offset (overnight trips). Without a Search
 * date, the leg's own (sample) date is used.
 */
export function purchaseDate(departure: string, searchDate?: string | null, tripStart?: string): string | undefined {
  const legDay = easternDate(departure);
  if (!isCalendarDate(searchDate)) return legDay;
  const startDay = easternDate(tripStart);
  return legDay && startDay ? addDays(searchDate, daysBetween(startDay, legDay)) : searchDate;
}

/** "Thu, Nov 12, 2026" for a YYYY-MM-DD date, independent of the viewer's zone. */
export function longDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" })
    .format(new Date(utcDay(date) + 12 * 3_600_000));
}

/** "Nov 12" for a YYYY-MM-DD date. */
export function shortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric" })
    .format(new Date(utcDay(date) + 12 * 3_600_000));
}

const KEY = "oneline:search-date";
let memory: string | undefined;

/** Remember this tab's Search date so Journey and Wallet links can use it. */
export function rememberSearchDate(date: string): void {
  if (!isCalendarDate(date)) return;
  memory = date;
  try {
    sessionStorage.setItem(KEY, date);
  } catch {
    /* Storage unavailable: keep the in-memory copy. */
  }
}

export function rememberedSearchDate(): string | undefined {
  try {
    const stored = sessionStorage.getItem(KEY);
    if (isCalendarDate(stored)) return stored;
  } catch {
    /* Storage unavailable. */
  }
  return memory;
}

export function forgetSearchDateForTests(): void {
  memory = undefined;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* Storage unavailable. */
  }
}
