import { describe, expect, it } from "vitest";
import { detectSustainedLoss } from "../src/anomaly";
import type { Reading } from "../src/rate";

const MIN = 60_000;
const IST = 330;
const istToUtc = (hour: number, minute = 0) => Date.UTC(2026, 9, 8, hour, minute) - IST * MIN;

/** Readings every 5 min from `startMs`, draining at `lph`. */
function draining(startMs: number, minutes: number, startL: number, lph: number): Reading[] {
  const out: Reading[] = [];
  for (let m = 0; m <= minutes; m += 5) out.push({ t: startMs + m * MIN, litres: startL - (lph * m) / 60 });
  return out;
}

const common = { dailyDemandL: 7_200, heatFactor: 1, utcOffsetMinutes: IST };

describe("detectSustainedLoss", () => {
  it("stays quiet for normal night-time use", () => {
    const readings = draining(istToUtc(2, 0), 60, 6_000, 50);
    const result = detectSustainedLoss({ ...common, readings, at: istToUtc(3, 0) });
    expect(result.detected).toBe(false);
    expect(result.windows).toHaveLength(3);
    expect(result.windows.every((w) => w.quiet)).toBe(true);
  });

  it("detects 45 minutes of night-time loss far above expected", () => {
    const readings = draining(istToUtc(2, 0), 60, 6_000, 400);
    const result = detectSustainedLoss({ ...common, readings, at: istToUtc(3, 0) });
    expect(result.detected).toBe(true);
    // Expected at 02:xx is 0.007 × 7,200 = 50.4 L/h.
    expect(result.excessLph).toBeCloseTo(400 - 50.4, 6);
  });

  it("does not fire until the loss has lasted every window", () => {
    const normal = draining(istToUtc(2, 0), 30, 6_000, 50);
    const last = normal[normal.length - 1]!;
    const leak = draining(last.t, 30, last.litres, 400).slice(1);
    const result = detectSustainedLoss({ ...common, readings: [...normal, ...leak], at: istToUtc(3, 0) });
    expect(result.windows.map((w) => w.flagged)).toEqual([false, true, true]);
    expect(result.detected).toBe(false);
  });

  it("does not flag the normal morning peak", () => {
    const readings = draining(istToUtc(7, 0), 60, 8_000, 0.095 * 7_200);
    const result = detectSustainedLoss({ ...common, readings, at: istToUtc(8, 0) });
    expect(result.detected).toBe(false);
    expect(result.windows.every((w) => !w.quiet)).toBe(true);
  });

  it("ignores a refill that lands inside the night windows", () => {
    const before = draining(istToUtc(2, 0), 25, 6_000, 50);
    const last = before[before.length - 1]!;
    const refilled = { t: last.t + 5 * MIN, litres: last.litres + 1_500 };
    const after = draining(refilled.t, 30, refilled.litres, 50).slice(1);
    const result = detectSustainedLoss({ ...common, readings: [...before, refilled, ...after], at: istToUtc(3, 0) });
    expect(result.detected).toBe(false);
  });

  it("refuses to decide from sparse data", () => {
    const readings: Reading[] = [0, 30, 60].map((m) => ({ t: istToUtc(2, m), litres: 6_000 - m * 10 }));
    const result = detectSustainedLoss({ ...common, readings, at: istToUtc(3, 0) });
    expect(result.windows.some((w) => w.observedLph === null)).toBe(true);
    expect(result.detected).toBe(false);
  });

  it("raises the expected baseline on a hot day", () => {
    const readings = draining(istToUtc(2, 0), 60, 6_000, 400);
    const cool = detectSustainedLoss({ ...common, readings, at: istToUtc(3, 0) });
    const hot = detectSustainedLoss({ ...common, heatFactor: 1.2, readings, at: istToUtc(3, 0) });
    expect(hot.windows[0]!.expectedLph).toBeCloseTo(cool.windows[0]!.expectedLph * 1.2, 9);
  });
});
