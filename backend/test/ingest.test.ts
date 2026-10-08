import {
  DEMO_BUILDING,
  DEMO_TANK,
  generateScenario,
  SIM_DEVICE_ID,
  telemetryTopic,
  toTelemetryMessage,
  type ScenarioId,
} from "@tanksaathi/core";
import { beforeEach, describe, expect, it } from "vitest";
import { processTelemetry } from "../src/ingest/process";
import { MemoryStore } from "./support/memory-store";

const MIN = 60_000;
const now = Date.UTC(2026, 9, 8, 9, 30); // 15:00 IST
const simTopic = telemetryTopic("sim", DEMO_TANK.buildingId, DEMO_TANK.tankId);

function scenarioEvent(id: ScenarioId, extra: Record<string, unknown> = {}) {
  const s = generateScenario({ id, tank: DEMO_TANK, dailyDemandL: DEMO_BUILDING.dailyDemandL, utcOffsetMinutes: 330, now });
  return { ...toTelemetryMessage(SIM_DEVICE_ID, s.readings), topic: simTopic, clientId: SIM_DEVICE_ID, ...extra };
}

function singleReading(patch: Partial<{ t: number; distanceMm: number }> = {}, extra: Record<string, unknown> = {}) {
  const reading = { t: now - MIN, distanceMm: 800, ...patch };
  return { ...toTelemetryMessage(SIM_DEVICE_ID, [reading]), topic: simTopic, clientId: SIM_DEVICE_ID, ...extra };
}

let store: MemoryStore;
beforeEach(() => {
  store = new MemoryStore();
  store.addTank({ building: DEMO_BUILDING, tank: DEMO_TANK, forecastMaxC: 33 });
});

describe("processTelemetry", () => {
  it("rejects messages on topics outside the telemetry namespace", async () => {
    const result = await processTelemetry(singleReading({}, { topic: "tanksaathi/v1/admin/x/y/reading" }), store, now);
    expect(result).toEqual({ ok: false, reason: "bad-topic" });
  });

  it("rejects payloads that fail the schema", async () => {
    const event = { ...singleReading(), readings: [{ seq: 1, measuredAt: "soon", distanceMm: 800 }] };
    expect(await processTelemetry(event, store, now)).toEqual({ ok: false, reason: "bad-payload" });
  });

  it("requires a real device's MQTT client id to match the device id in the payload", async () => {
    const topic = telemetryTopic("dev", DEMO_TANK.buildingId, DEMO_TANK.tankId);
    const spoofed = { ...singleReading(), deviceId: "esp32-roof-1", topic, clientId: "esp32-other" };
    expect(await processTelemetry(spoofed, store, now)).toEqual({ ok: false, reason: "identity-mismatch" });

    const genuine = { ...singleReading(), deviceId: "esp32-roof-1", topic, clientId: "esp32-roof-1" };
    expect((await processTelemetry(genuine, store, now)).ok).toBe(true);
  });

  it("only accepts simulator device ids on the simulator channel", async () => {
    const event = { ...singleReading(), deviceId: "esp32-roof-1" };
    expect(await processTelemetry(event, store, now)).toEqual({ ok: false, reason: "identity-mismatch" });
  });

  it("rejects readings for a tank that isn't configured", async () => {
    const event = singleReading({}, { topic: telemetryTopic("sim", "unknown-building", "roof-1") });
    expect(await processTelemetry(event, store, now)).toEqual({ ok: false, reason: "unknown-tank" });
  });

  it("stores a scenario batch and saves the computed state", async () => {
    const event = scenarioEvent("normal");
    const result = await processTelemetry(event, store, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.accepted).toBe(event.readings.length);
    expect(store.count(DEMO_TANK.buildingId, DEMO_TANK.tankId)).toBe(event.readings.length);
    expect(store.states.get("demo-hostel-a#roof-1")?.levelPct).toBeGreaterThan(20);
  });

  it("stores nothing new when the same message is delivered twice", async () => {
    const event = scenarioEvent("normal");
    await processTelemetry(event, store, now);
    await processTelemetry(event, store, now);
    expect(store.count(DEMO_TANK.buildingId, DEMO_TANK.tankId)).toBe(event.readings.length);
  });

  it("drops readings from the future, from too long ago, and beyond the tank floor", async () => {
    const message = toTelemetryMessage(SIM_DEVICE_ID, [
      { t: now - MIN, distanceMm: 800 },
      { t: now + 11 * MIN, distanceMm: 800 },
      { t: now - 37 * 60 * MIN, distanceMm: 800 },
      { t: now - 2 * MIN, distanceMm: DEMO_TANK.sensorToFullMm + DEMO_TANK.heightMm + 301 },
    ]);
    const result = await processTelemetry({ ...message, topic: simTopic, clientId: SIM_DEVICE_ID }, store, now);
    expect(result.ok && [result.accepted, result.rejected]).toEqual([1, 3]);
  });

  it("refuses a batch where nothing survives the plausibility checks", async () => {
    const result = await processTelemetry(singleReading({ t: now + 30 * MIN }), store, now);
    expect(result).toEqual({ ok: false, reason: "no-valid-readings" });
  });

  it("finds the overnight leak in the simulator's leak scenario", async () => {
    const result = await processTelemetry(scenarioEvent("leak"), store, now);
    expect(result.ok && result.state.anomaly.firstDetectedAt).not.toBe(null);
  });

  it("ignores data from before the last resolved incident", async () => {
    store.addTank({ building: DEMO_BUILDING, tank: DEMO_TANK, forecastMaxC: 33 }, { lastResolvedAt: now - 45 * MIN });
    const result = await processTelemetry(scenarioEvent("recovery"), store, now);
    expect(result.ok && result.state.anomaly.firstDetectedAt).toBeNull();
  });
});
