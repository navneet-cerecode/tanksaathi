import type { Resolution, ResidentStatus, ScenarioId, Severity, TankState } from "@tanksaathi/core";
import { currentSession } from "./auth";
import { config } from "./config";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const session = await currentSession();
  if (!session) throw new ApiError(401, "signed-out");
  const res = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: { authorization: session.idToken, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) throw new ApiError(res.status, data?.error ?? `http-${res.status}`);
  return data as T;
}

export interface ResidentView {
  buildingId: string;
  buildingName: string;
  status: ResidentStatus;
  stale: boolean;
  noData: boolean;
  updatedAt: number | null;
  refillPlannedAt: number | null;
  simulated: boolean;
}

export interface HourlyUse {
  from: number;
  to: number;
  observedLph: number | null;
  expectedLph: number;
}

export interface TankView {
  tank: { tankId: string; name: string; capacityL: number };
  building: { buildingId: string; name: string; utcOffsetMinutes: number };
  state: TankState;
  series: Array<{ t: number; levelPct: number }>;
  hourly: HourlyUse[];
  simulated: boolean;
  refillPlannedAt: number | null;
}

export type IncidentStatus = "open" | "acknowledged" | "inspecting" | "resolved";

export interface TimelineEntry {
  at: number;
  action: string;
  actor: string;
  note?: string;
  resolution?: Resolution;
}

export interface Incident {
  incidentId: string;
  buildingId: string;
  tankId: string;
  status: IncidentStatus;
  severity: Severity;
  simulated: boolean;
  detectedAt: number;
  openedAt: number;
  excessLph: number;
  hoursRemainingAtOpen: number | null;
  levelPctAtOpen: number | null;
  awaiting?: "acknowledgement" | "resolution" | null;
  timeline: TimelineEntry[];
  resolution?: Resolution;
  resolvedAt?: number;
  explanation?: { source: "standard" | "bedrock"; en: string; hi: string; checklist: string[] };
}

export type IncidentAction =
  | { action: "acknowledge"; note?: string }
  | { action: "inspect"; note?: string }
  | { action: "resolve"; resolution: Resolution; note?: string };

const b = (buildingId: string) => `/buildings/${encodeURIComponent(buildingId)}`;

export const api = {
  status: (buildingId: string) => request<ResidentView>("GET", `${b(buildingId)}/status`),
  tank: (buildingId: string, tankId: string) => request<TankView>("GET", `${b(buildingId)}/tanks/${encodeURIComponent(tankId)}`),
  incidents: (buildingId: string) => request<{ incidents: Incident[] }>("GET", `${b(buildingId)}/incidents`),
  incident: (buildingId: string, incidentId: string) =>
    request<Incident>("GET", `${b(buildingId)}/incidents/${encodeURIComponent(incidentId)}`),
  act: (buildingId: string, incidentId: string, action: IncidentAction) =>
    request<{ status: IncidentStatus; workflow: string }>("POST", `${b(buildingId)}/incidents/${encodeURIComponent(incidentId)}/actions`, action),
  planRefill: (buildingId: string, plannedAt: string | null) => request<{ refillPlannedAt: number | null }>("PUT", `${b(buildingId)}/refill`, { plannedAt }),
  runScenario: (buildingId: string, scenario: ScenarioId) =>
    request<{ scenario: ScenarioId; readings: number; description: string; forecastMaxC: number }>("POST", `${b(buildingId)}/demo/scenarios`, { scenario }),
  resetDemo: (buildingId: string) => request<{ removed: number; stoppedWorkflows: number }>("POST", `${b(buildingId)}/demo/reset`),
};
