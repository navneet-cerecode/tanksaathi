import { formatHours, formatLocalTime } from "@tanksaathi/core";

export { formatHours, formatLocalTime };

const IST = 330;

export const localTime = (t: number, offset = IST) => formatLocalTime(t, offset);

/** "15:02" without the zone, for chart ticks and dense lists. */
export const hhmm = (t: number, offset = IST) => new Date(t + offset * 60_000).toISOString().slice(11, 16);

export function ago(t: number | null, now: number): string {
  if (t === null) return "never";
  const min = Math.max(0, Math.round((now - t) / 60_000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

/** Hindi relative time for the resident screen. */
export function agoHi(t: number | null, now: number): string {
  if (t === null) return "कभी नहीं";
  const min = Math.max(0, Math.round((now - t) / 60_000));
  if (min < 1) return "अभी";
  if (min < 60) return `${min} मिनट पहले`;
  return `${Math.round(min / 60)} घंटे पहले`;
}

export const litres = (l: number | null) => (l === null ? "—" : `${Math.round(l).toLocaleString("en-IN")} L`);
export const pct = (p: number | null) => (p === null ? "—" : `${Math.round(p)}%`);

/** Short figure for the big number: "9 h", "<1 h", "3 d+". */
export function hoursFigure(h: number | null): { value: string; unit: string } {
  if (h === null) return { value: "—", unit: "" };
  if (h >= 72) return { value: "3", unit: "days +" };
  if (h < 1) return { value: "<1", unit: "h" };
  return { value: String(Math.round(h)), unit: "h" };
}
