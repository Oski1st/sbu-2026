import type { Agency, Leg } from "../../types/transit";

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
};

/** Handles the concise clock strings used in the shared demo data. */
export function timeToMinutes(time: string): number | null {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
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
  const minutes = timeToMinutes(time);
  if (minutes === null) return time;

  const total = (minutes + minutesToAdd + 24 * 60) % (24 * 60);
  const hasPeriod = /\b(?:AM|PM)\b/i.test(time);
  if (!hasPeriod) return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;

  const period = total >= 12 * 60 ? "PM" : "AM";
  const hour = (Math.floor(total / 60) % 12) || 12;
  return `${hour}:${String(total % 60).padStart(2, "0")} ${period}`;
}
