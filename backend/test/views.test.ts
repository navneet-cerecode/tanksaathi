import { computeTankState, DEMO_BUILDING, DEMO_TANK, generateScenario, localHour, type ScenarioId } from "@tanksaathi/core";
import { describe, expect, it } from "vitest";
import { residentView, tankView } from "../src/api/views";

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = Date.UTC(2026, 9, 8, 9, 30); // 15:00 IST

function run(id: ScenarioId) {
  const s = generateScenario({ id, tank: DEMO_TANK, dailyDemandL: DEMO_BUILDING.dailyDemandL, utcOffsetMinutes: 330, now });
  const state = computeTankState({ tank: DEMO_TANK, building: DEMO_BUILDING, readings: s.readings, now, forecastMaxC: s.forecastMaxC });
  return { readings: s.readings, state, forecastMaxC: s.forecastMaxC };
}

describe("residentView", () => {
  const normal = run("normal");
  const base = { building: DEMO_BUILDING, state: normal.state, computedAt: now, channel: "sim" as const, openIncident: false, refillPlannedAt: null };

  it("says normal for a healthy tank and never exposes litres", () => {
    const view = residentView({ ...base, now });
    expect(view.status).toBe("normal");
    expect(JSON.stringify(view)).not.toMatch(/litre|usable|Lph/i);
  });

  it("shows an open incident to residents", () => {
    expect(residentView({ ...base, openIncident: true, now }).status).toBe("incident");
  });

  it("counts down the stored estimate between readings", () => {
    const hours = normal.state.projection!.hoursConservative;
    const later = now + (hours - 5) * HOUR;
    expect(residentView({ ...base, now: later }).status).toBe("conserve");
  });

  it("goes stale when the sensor stops, even without new data", () => {
    expect(residentView({ ...base, now: now + 21 * MIN }).stale).toBe(true);
    expect(residentView({ ...base, now: now + 5 * MIN }).stale).toBe(false);
  });

  it("shows a planned refill until an hour after its planned time", () => {
    expect(residentView({ ...base, refillPlannedAt: now + HOUR, now }).status).toBe("refill-planned");
    expect(residentView({ ...base, refillPlannedAt: now - 2 * HOUR, now }).status).toBe("normal");
  });

  it("tells residents when the data is simulated", () => {
    expect(residentView({ ...base, now }).simulated).toBe(true);
  });
});

describe("tankView", () => {
  it("returns a level series and hourly observed-versus-expected use", () => {
    const { readings, forecastMaxC } = run("leak");
    const view = tankView({ tank: DEMO_TANK, building: DEMO_BUILDING, readings, forecastMaxC, lastResolvedAt: null, channel: "sim", now });
    expect(view.series.length).toBe(readings.length);
    expect(view.series.every((p) => p.levelPct >= 0 && p.levelPct <= 100)).toBe(true);
    const night = view.hourly.filter((h) => localHour(h.from, 330) >= 1 && localHour(h.from, 330) < 5);
    expect(night.length).toBeGreaterThan(0);
    for (const h of night) expect(h.observedLph!).toBeGreaterThan(h.expectedLph * 3);
    expect(view.state.anomaly.firstDetectedAt).not.toBeNull();
    expect(view.simulated).toBe(true);
  });
});
