import type { Severity } from "./incident";

export interface NoticeInput {
  buildingName: string;
  tankName: string;
  utcOffsetMinutes: number;
  detectedAt: number;
  excessLph: number;
  levelPctAtOpen: number | null;
  hoursRemainingAtOpen: number | null;
  severity: Severity;
  simulated: boolean;
  appUrl: string;
}

export interface Notice {
  /** ASCII, under 100 characters, as SNS requires. */
  subject: string;
  body: string;
}

export function formatHours(hours: number | null): string {
  if (hours === null) return "unknown";
  if (hours >= 72) return "more than 3 days";
  if (hours < 1) return "less than 1 hour";
  const rounded = Math.round(hours);
  return rounded === 1 ? "about 1 hour" : `about ${rounded} hours`;
}

export function formatLocalTime(epochMs: number, utcOffsetMinutes: number): string {
  const hhmm = new Date(epochMs + utcOffsetMinutes * 60_000).toISOString().slice(11, 16);
  return utcOffsetMinutes === 330 ? `${hhmm} IST` : `${hhmm} local time`;
}

const ascii = (s: string) => s.replace(/[^\x20-\x7e]/g, "").slice(0, 99);

/** Deterministic caretaker alert. No model writes or decides any of this. */
export function incidentNotice(i: NoticeInput): Notice {
  const urgent = i.severity === "high" ? "URGENT " : "";
  const subject = ascii(`TankSaathi: ${urgent}possible leak - ${i.buildingName}, ${i.tankName}`);
  const excess = Math.round(i.excessLph / 10) * 10;
  const level = i.levelPctAtOpen === null ? "unknown" : `${Math.round(i.levelPctAtOpen)}%`;

  const lines = [
    `Possible leak at ${i.buildingName} - ${i.tankName}.`,
    "",
    `Since ${formatLocalTime(i.detectedAt, i.utcOffsetMinutes)} the tank has been losing about ${excess} L/h more than this building normally uses at that hour, for at least 45 minutes.`,
    `Water left: ${level}, ${formatHours(i.hoursRemainingAtOpen)} at the current rate if no refill arrives.`,
    `Severity: ${i.severity.toUpperCase()}.`,
    "",
    "Check first: the overflow pipe, the float valve, running toilet cisterns and open taps.",
    `Acknowledge in TankSaathi: ${i.appUrl}`,
  ];
  if (i.simulated) {
    lines.push("", "SIMULATED DATA: these readings come from the TankSaathi sensor simulator, not a real sensor.");
  }
  return { subject, body: lines.join("\n") };
}
