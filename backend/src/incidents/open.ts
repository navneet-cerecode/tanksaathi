import { severityFor, type Channel, type IncidentState, type IncidentType, type Severity, type TankState } from "@tanksaathi/core";

export interface Incident {
  incidentId: string;
  buildingId: string;
  tankId: string;
  type: IncidentType;
  status: IncidentState;
  severity: Severity;
  /** True when the triggering readings came from the sensor simulator. */
  simulated: boolean;
  detectedAt: number;
  openedAt: number;
  excessLph: number;
  hoursRemainingAtOpen: number | null;
  levelPctAtOpen: number | null;
}

/** Marks the one open incident a tank may have. */
export interface OpenLock {
  incidentId: string;
  eventSentAt: number | null;
}

export interface IncidentStore {
  getOpenLock(buildingId: string, tankId: string): Promise<OpenLock | null>;
  /** Atomically writes the incident and the tank's open lock; "exists" if a lock is already held. */
  createIncident(incident: Incident): Promise<"created" | "exists">;
  markEventSent(buildingId: string, tankId: string, incidentId: string, at: number): Promise<void>;
}

export interface EventPublisher {
  incidentOpened(incident: Incident): Promise<void>;
}

export type OpenResult =
  | { action: "none" }
  | { action: "opened" | "re-sent" | "already-open"; incidentId: string };

/** Same detection, same id: replays can't mint a second incident. */
export const incidentIdFor = (tankId: string, detectedAt: number) => `${tankId}-${detectedAt.toString(36)}`;

export async function openIncidentIfNeeded(
  input: { buildingId: string; tankId: string; channel: Channel; state: TankState; now: number },
  deps: { incidents: IncidentStore; events: EventPublisher },
): Promise<OpenResult> {
  const { buildingId, tankId, channel, state, now } = input;
  const detectedAt = state.anomaly.firstDetectedAt;
  if (detectedAt === null) return { action: "none" };

  const incident: Incident = {
    incidentId: incidentIdFor(tankId, detectedAt),
    buildingId,
    tankId,
    type: "sustained-loss",
    status: "open",
    severity: severityFor(state.projection?.hoursConservative ?? null),
    simulated: channel === "sim",
    detectedAt,
    openedAt: now,
    excessLph: state.anomaly.excessLph ?? 0,
    hoursRemainingAtOpen: state.projection?.hoursConservative ?? null,
    levelPctAtOpen: state.levelPct,
  };

  let lock = await deps.incidents.getOpenLock(buildingId, tankId);
  if (!lock && (await deps.incidents.createIncident(incident)) === "created") {
    await announce(incident, deps, now);
    return { action: "opened", incidentId: incident.incidentId };
  }
  lock ??= await deps.incidents.getOpenLock(buildingId, tankId);
  if (!lock) throw new Error("open lock vanished between create and read");

  if (lock.incidentId === incident.incidentId && lock.eventSentAt === null) {
    await announce(incident, deps, now);
    return { action: "re-sent", incidentId: incident.incidentId };
  }
  return { action: "already-open", incidentId: lock.incidentId };
}

/** Publish first, then mark: a failed publish leaves eventSentAt empty so the Lambda retry re-sends it. */
async function announce(incident: Incident, deps: { incidents: IncidentStore; events: EventPublisher }, now: number) {
  await deps.events.incidentOpened(incident);
  await deps.incidents.markEventSent(incident.buildingId, incident.tankId, incident.incidentId, now);
}
