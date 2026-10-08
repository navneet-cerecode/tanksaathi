import { describe, expect, it } from "vitest";
import { projectHoursRemaining } from "../src/projection";

const FLAT = Array.from({ length: 24 }, () => 1 / 24);
const IST = 330;
const at1030Ist = Date.UTC(2026, 9, 8, 5, 0);

const base = {
  dailyDemandL: 2_400, // 100 L/h on a flat profile
  heatFactor: 1,
  now: at1030Ist,
  utcOffsetMinutes: IST,
  hourlyShare: FLAT,
};

describe("projectHoursRemaining", () => {
  it("projects from the demand profile when there is no observed rate", () => {
    const p = projectHoursRemaining({ ...base, usableLitres: 500, observedLph: null });
    expect(p.hoursHeatAdjusted).toBeCloseTo(5, 9);
    expect(p.hoursAtCurrentUse).toBeNull();
    expect(p.hoursConservative).toBeCloseTo(5, 9);
    expect(p.basis).toBe("heat-adjusted");
  });

  it("shortens the profile projection on a hotter forecast", () => {
    const p = projectHoursRemaining({ ...base, heatFactor: 1.25, usableLitres: 500, observedLph: null });
    expect(p.hoursHeatAdjusted).toBeCloseTo(4, 9);
  });

  it("uses the observed rate when it is the earlier of the two", () => {
    const p = projectHoursRemaining({ ...base, usableLitres: 500, observedLph: 250 });
    expect(p.hoursAtCurrentUse).toBeCloseTo(2, 9);
    expect(p.hoursConservative).toBeCloseTo(2, 9);
    expect(p.basis).toBe("current-use");
  });

  it("treats a zero observed rate as not draining", () => {
    const p = projectHoursRemaining({ ...base, usableLitres: 500, observedLph: 0 });
    expect(p.hoursAtCurrentUse).toBeNull();
    expect(p.hoursConservative).toBeCloseTo(5, 9);
  });

  it("caps the projection at the horizon", () => {
    const p = projectHoursRemaining({ ...base, usableLitres: 1_000_000, observedLph: null });
    expect(p.hoursHeatAdjusted).toBe(72);
    expect(p.capped).toBe(true);
  });

  it("walks the real hourly profile, starting with the part-hour left now", () => {
    // 10:30 IST: half of hour 10 at 0.050 × 2,400 = 120 L/h uses 60 L,
    // then hour 11 at 0.040 × 2,400 = 96 L/h drains the last 40 L.
    const p = projectHoursRemaining({
      usableLitres: 100,
      observedLph: null,
      dailyDemandL: 2_400,
      heatFactor: 1,
      now: at1030Ist,
      utcOffsetMinutes: IST,
    });
    expect(p.hoursHeatAdjusted).toBeCloseTo(0.5 + 40 / 96, 9);
  });

  it("reports zero hours for an already-empty tank", () => {
    const p = projectHoursRemaining({ ...base, usableLitres: 0, observedLph: 100 });
    expect(p.hoursConservative).toBe(0);
  });
});
