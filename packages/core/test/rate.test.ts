import { describe, expect, it } from "vitest";
import { outflowRateLph, type Reading } from "../src/rate";

const MIN = 60_000;
const t0 = Date.UTC(2026, 9, 8, 6, 0); // 11:30 IST

function series(points: Array<[minutes: number, litres: number]>): Reading[] {
  return points.map(([m, litres]) => ({ t: t0 + m * MIN, litres }));
}

describe("outflowRateLph", () => {
  it("measures a steady decline in litres per hour", () => {
    const readings = series([[0, 5_000], [15, 4_975], [30, 4_950], [45, 4_925], [60, 4_900]]);
    expect(outflowRateLph(readings, t0, t0 + 60 * MIN)).toBeCloseTo(100, 6);
  });

  it("returns zero for a flat level", () => {
    const readings = series([[0, 5_000], [30, 5_000], [60, 5_000]]);
    expect(outflowRateLph(readings, t0, t0 + 60 * MIN)).toBe(0);
  });

  it("returns null when the window holds less than the minimum coverage", () => {
    const readings = series([[0, 5_000], [10, 4_990]]);
    expect(outflowRateLph(readings, t0, t0 + 60 * MIN)).toBeNull();
  });

  it("ignores refill intervals instead of counting them as negative use", () => {
    // 50 L out in 30 min, a 30 min refill (+1,000 L), then 50 L out in 30 min.
    const readings = series([[0, 5_000], [30, 4_950], [60, 5_950], [90, 5_900]]);
    expect(outflowRateLph(readings, t0, t0 + 90 * MIN)).toBeCloseTo(100, 6);
  });

  it("lets small sensor jitter cancel out rather than inflating the rate", () => {
    // Net 100 L/h decline; the 30-min reading jitters 5 L upward.
    // Summing only the drops would report 105 L/h.
    const readings = series([[0, 5_000], [15, 4_970], [30, 4_975], [45, 4_925], [60, 4_900]]);
    expect(outflowRateLph(readings, t0, t0 + 60 * MIN)).toBeCloseTo(100, 6);
  });

  it("gives the same answer for out-of-order input", () => {
    const ordered = series([[0, 5_000], [15, 4_975], [30, 4_950], [45, 4_925], [60, 4_900]]);
    const shuffled = [ordered[3]!, ordered[0]!, ordered[4]!, ordered[2]!, ordered[1]!];
    expect(outflowRateLph(shuffled, t0, t0 + 60 * MIN)).toBeCloseTo(100, 6);
  });

  it("only counts intervals whose midpoint falls inside the window", () => {
    const readings = series([[0, 5_000], [60, 4_000], [75, 3_975], [90, 3_950]]);
    // The 1,000 L drop between 0 and 60 min sits outside [60, 90].
    expect(outflowRateLph(readings, t0 + 60 * MIN, t0 + 90 * MIN)).toBeCloseTo(100, 6);
  });
});
