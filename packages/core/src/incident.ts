export type IncidentState = "open" | "acknowledged" | "inspecting" | "resolved";
export type IncidentType = "sustained-loss";
export type Severity = "high" | "medium";

export const RESOLUTIONS = ["leak-fixed", "tap-left-open", "false-alarm", "sensor-fault", "other"] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

const TRANSITIONS: Record<IncidentState, IncidentState[]> = {
  open: ["acknowledged"],
  acknowledged: ["inspecting", "resolved"],
  inspecting: ["resolved"],
  resolved: [],
};

export function nextStates(state: IncidentState): IncidentState[] {
  return TRANSITIONS[state];
}

export function canTransition(from: IncidentState, to: IncidentState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function severityFor(hoursRemaining: number | null): Severity {
  return hoursRemaining !== null && hoursRemaining <= 3 ? "high" : "medium";
}
