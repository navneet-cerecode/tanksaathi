import { computeTankState, DEMO_BUILDING, DEMO_TANK, generateScenario, type TankState } from "@tanksaathi/core";
import { beforeEach, describe, expect, it } from "vitest";
import {
  incidentIdFor,
  openIncidentIfNeeded,
  type EventPublisher,
  type Incident,
  type IncidentStore,
  type OpenLock,
} from "../src/incidents/open";

const now = Date.UTC(2026, 9, 8, 9, 30);

function stateFor(id: "normal" | "leak"): TankState {
  const s = generateScenario({ id, tank: DEMO_TANK, dailyDemandL: DEMO_BUILDING.dailyDemandL, utcOffsetMinutes: 330, now });
  return computeTankState({ tank: DEMO_TANK, building: DEMO_BUILDING, readings: s.readings, now, forecastMaxC: s.forecastMaxC });
}

class FakeIncidents implements IncidentStore {
  incidents = new Map<string, Incident>();
  lock: OpenLock | null = null;
  async getOpenLock() {
    return this.lock;
  }
  async createIncident(incident: Incident) {
    if (this.lock) return "exists" as const;
    this.lock = { incidentId: incident.incidentId, eventSentAt: null };
    this.incidents.set(incident.incidentId, incident);
    return "created" as const;
  }
  async markEventSent(_b: string, _t: string, incidentId: string, at: number) {
    if (this.lock?.incidentId === incidentId) this.lock = { ...this.lock, eventSentAt: at };
  }
}

class FakeEvents implements EventPublisher {
  sent: Incident[] = [];
  failNext = false;
  async incidentOpened(incident: Incident) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("EventBridge unavailable");
    }
    this.sent.push(incident);
  }
}

let incidents: FakeIncidents;
let events: FakeEvents;
const base = { buildingId: DEMO_TANK.buildingId, tankId: DEMO_TANK.tankId, channel: "sim" as const, now };

beforeEach(() => {
  incidents = new FakeIncidents();
  events = new FakeEvents();
});

describe("openIncidentIfNeeded", () => {
  it("does nothing when the sustained-loss rule has not fired", async () => {
    const result = await openIncidentIfNeeded({ ...base, state: stateFor("normal") }, { incidents, events });
    expect(result.action).toBe("none");
    expect(events.sent).toHaveLength(0);
  });

  it("opens one incident and announces it", async () => {
    const state = stateFor("leak");
    const result = await openIncidentIfNeeded({ ...base, state }, { incidents, events });
    expect(result).toEqual({ action: "opened", incidentId: incidentIdFor("roof-1", state.anomaly.firstDetectedAt!) });
    expect(events.sent).toHaveLength(1);
    expect(incidents.lock?.eventSentAt).toBe(now);
  });

  it("records what the deterministic rule saw, and that it came from the simulator", async () => {
    const state = stateFor("leak");
    await openIncidentIfNeeded({ ...base, state }, { incidents, events });
    const incident = events.sent[0]!;
    expect(incident).toMatchObject({
      type: "sustained-loss",
      status: "open",
      simulated: true,
      detectedAt: state.anomaly.firstDetectedAt,
      openedAt: now,
    });
    expect(incident.excessLph).toBeGreaterThan(150);
    expect(["high", "medium"]).toContain(incident.severity);
  });

  it("does not open or announce twice when the same readings arrive again", async () => {
    const state = stateFor("leak");
    await openIncidentIfNeeded({ ...base, state }, { incidents, events });
    const again = await openIncidentIfNeeded({ ...base, state }, { incidents, events });
    expect(again.action).toBe("already-open");
    expect(events.sent).toHaveLength(1);
  });

  it("re-announces an incident whose first announcement failed", async () => {
    const state = stateFor("leak");
    events.failNext = true;
    await expect(openIncidentIfNeeded({ ...base, state }, { incidents, events })).rejects.toThrow("EventBridge unavailable");
    expect(incidents.lock?.eventSentAt).toBeNull();

    const retry = await openIncidentIfNeeded({ ...base, state }, { incidents, events });
    expect(retry.action).toBe("re-sent");
    expect(events.sent).toHaveLength(1);
  });

  it("leaves a different open incident alone", async () => {
    incidents.lock = { incidentId: "roof-1-older", eventSentAt: now - 1 };
    const result = await openIncidentIfNeeded({ ...base, state: stateFor("leak") }, { incidents, events });
    expect(result).toEqual({ action: "already-open", incidentId: "roof-1-older" });
    expect(events.sent).toHaveLength(0);
  });
});
