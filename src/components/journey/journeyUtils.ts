import type { Agency, Leg } from "../../types/transit";
import { formatTime } from "../../data/tripUtils";

export const agencyStyles: Record<Agency, { label: string; dot: string; badge: string; ring: string }> = {
  SEPTA: {
    label: "SEPTA",
    dot: "bg-[#1769aa]",
    badge: "bg-[#e9f3fb] text-[#0e568d]",
    ring: "ring-[#1769aa]/20",
  },
  NJ_TRANSIT: {
    label: "NJ TRANSIT",
    dot: "bg-[#f05a28]",
    badge: "bg-[#fff0e9] text-[#b83c14]",
    ring: "ring-[#f05a28]/20",
  },
  LIRR: {
    label: "LIRR",
    dot: "bg-[#2663a4]",
    badge: "bg-[#edf3fb] text-[#1d4d81]",
    ring: "ring-[#2663a4]/20",
  },
  AMTRAK: {
    label: "AMTRAK",
    dot: "bg-[#d71920]",
    badge: "bg-[#fcebec] text-[#ab1118]",
    ring: "ring-[#d71920]/20",
  },
  GREYHOUND: { label: "Greyhound", dot: "bg-[#28558a]", badge: "bg-[#eaf1fa] text-[#28558a]", ring: "ring-[#28558a]/20" },
  FLIXBUS: { label: "FlixBus", dot: "bg-[#4b7416]", badge: "bg-[#eef5df] text-[#4b7416]", ring: "ring-[#4b7416]/20" },
};

/** Normalizes either a local clock label or the shared ISO 8601 trip timestamp. */
export function displayTime(time: string): string {
  return Number.isNaN(Date.parse(time)) ? time : formatTime(time);
}

export function timeToMinutes(time: string): number | null {
  const normalizedTime = displayTime(time);
  const match = normalizedTime.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (period) {
    if (hours === 12) hours = 0;
    if (period === "PM") hours += 12;
  }

  return hours * 60 + minutes;
}

export function differenceInMinutes(start: string, end: string): number | null {
  if (start.includes("T") && end.includes("T")) {
    const elapsed = (Date.parse(end) - Date.parse(start)) / 60000;
    return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
  }
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);
  if (startMinutes === null || endMinutes === null) return null;

  const difference = endMinutes - startMinutes;
  return difference >= 0 ? difference : difference + 24 * 60;
}

export function legDuration(leg: Leg): string | null {
  const minutes = differenceInMinutes(leg.departure, leg.arrival);
  if (minutes === null) return null;
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ""}`.trim();
}

export function addMinutes(time: string, minutesToAdd: number): string {
  if (time.includes("T") && Number.isFinite(Date.parse(time))) return new Date(Date.parse(time) + minutesToAdd * 60000).toISOString();
  const minutes = timeToMinutes(time);
  if (minutes === null) return time;

  const total = (minutes + minutesToAdd + 24 * 60) % (24 * 60);
  const normalizedTime = displayTime(time);
  const hasPeriod = /\b(?:AM|PM)\b/i.test(normalizedTime);
  if (!hasPeriod) return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

  const period = total >= 12 * 60 ? "PM" : "AM";
  const hour = (Math.floor(total / 60) % 12) || 12;
  return `${hour}:${String(total % 60).padStart(2, "0")} ${period}`;
}

/** Calendar dates matter for overnight and multi-day sample journeys. */
export function displaySegmentTime(time: string): string {
  if (!time.includes("T") || !Number.isFinite(Date.parse(time))) return displayTime(time);
  return `${displayTime(time)} · ${new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" }).format(new Date(time))}`;
}
