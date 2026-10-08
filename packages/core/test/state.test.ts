import { describe, expect, it } from "vitest";
import { localHour } from "../src/profile";
import { generateScenario, SCENARIOS } from "../src/scenarios";
import { computeTankState, type BuildingConfig } from "../src/state";
import type { TankConfig } from "../src/tank";

const tank: TankConfig = {
  buildingId: "demo-hostel-a",
  tankId: "roof-1",
  name: "Roof tank 1",
  capacityL: 10_000,
  heightMm: 1_500,
  sensorToFullMm: 200,
  unusableBelowPct: 8,
};
const building: BuildingConfig = {
  buildingId: "demo-hostel-a",
  name: "Demo Hostel Block A",
  utcOffsetMinutes: 330,
  dailyDemandL: 7_200,
};
const MIN = 60_000;
// 15:00 IST, a typical recording time.
const now = Date.UTC(2026, 9, 8, 9, 30);

function scenario(id: (typeof SCENARIOS)[number], at = now) {
  return generateScenario({ id, tank, dailyDemandL: building.dailyDemandL, utcOffsetMinutes: 330, now: at });
}

function stateFor(id: (typeof SCENARIOS)[number], ignoreBefore?: number) {
  const s = scenario(id);
  return computeTankState({ tank, building, readings: s.readings, now, forecastMaxC: s.forecastMaxC, ignoreBefore });
}

describe("generateScenario", () => {
  it("is deterministic", () => {
    expect(scenario("leak")).toEqual(scenario("leak"));
  });

  it.each(Array.from({ length: 24 }, (_, h) => h))(
    "fits one MQTT batch with readings at most 15 min apart when run at %s:00 IST",
    (hour) => {
      const at = Date.UTC(2026, 9, 8, hour, 0) - 330 * MIN;
      const { readings } = scenario("leak", at);
      expect(readings.length).toBeLessThanOrEqual(120);
      for (let i = 1; i < readings.length; i++) {
        expect(readings[i]!.t - readings[i - 1]!.t).toBeLessThanOrEqual(15 * MIN);
      }
      expect(readings[readings.length - 1]!.t).toBe(at);
    },
  );

  it("produces integer distances within the sensor range", () => {
    for (const id of SCENARIOS) {
      for (const r of scenario(id).readings) {
        expect(Number.isInteger(r.distanceMm)).toBe(true);
        expect(r.distanceMm).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("computeTankState over the demo scenarios", () => {
  it("shows a healthy tank and no anomaly for normal use", () => {
    const state = stateFor("normal");
    expect(state.anomaly.firstDetectedAt).toBeNull();
    expect(state.freshness.state).toBe("fresh");
    expect(state.levelPct).toBeGreaterThan(20);
    expect(state.projection!.hoursConservative).toBeGreaterThan(6);
  });

  it("projects fewer hours on the heat day than on a normal day", () => {
    const normal = stateFor("normal");
    const heat = stateFor("heat");
    expect(heat.heat.band).toBe("hot");
    expect(heat.projection!.hoursConservative).toBeLessThan(normal.projection!.hoursConservative);
  });

  it("detects the overnight leak while the building is quiet", () => {
    const state = stateFor("leak");
    expect(state.anomaly.firstDetectedAt).not.toBeNull();
    const hour = localHour(state.anomaly.firstDetectedAt!, 330);
    expect(hour).toBeGreaterThanOrEqual(0);
    expect(hour).toBeLessThan(5);
    expect(state.anomaly.excessLph).toBeGreaterThan(150);
  });

  it("marks the stale-sensor scenario as stale", () => {
    expect(stateFor("stale").freshness.state).toBe("stale");
  });

  it("does not re-detect a leak that was resolved before recovery", () => {
    const resolvedAt = now - 45 * MIN;
    const state = stateFor("recovery", resolvedAt);
    expect(state.anomaly.firstDetectedAt).toBeNull();
    expect(state.levelPct).toBeGreaterThan(80);
  });

  it("gives the same answer for shuffled readings", () => {
    const s = scenario("leak");
    const shuffled = [...s.readings].reverse();
    const a = computeTankState({ tank, building, readings: s.readings, now, forecastMaxC: s.forecastMaxC });
    const b = computeTankState({ tank, building, readings: shuffled, now, forecastMaxC: s.forecastMaxC });
    expect(b).toEqual(a);
  });

  it("returns an empty state before any reading arrives", () => {
    const state = computeTankState({ tank, building, readings: [], now, forecastMaxC: null });
    expect(state.lastReadingAt).toBeNull();
    expect(state.freshness.state).toBe("none");
    expect(state.projection).toBeNull();
    expect(state.anomaly.firstDetectedAt).toBeNull();
  });
});
