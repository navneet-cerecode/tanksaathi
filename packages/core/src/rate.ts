export interface Reading {
  /** Epoch milliseconds. */
  t: number;
  litres: number;
}

export interface RateOptions {
  /** A rise at least this big between two readings is a refill, not jitter. */
  refillThresholdL?: number;
  /** Below this much measured time in the window the rate is unknown. */
  minCoverageMs?: number;
}

const HOUR = 3_600_000;

export const byTime = (a: Reading, b: Reading) => a.t - b.t;

/**
 * Net outflow in litres per hour over the half-open window (fromMs, toMs].
 *
 * Each pair of consecutive readings is one interval, assigned to the window
 * by its midpoint, so adjacent windows never share an interval. Refill intervals are dropped from both the litres and the
 * time, because consumption during a refill can't be observed. Small rises
 * stay in, so sensor jitter cancels out instead of inflating the rate.
 */
export function outflowRateLph(
  readings: Reading[],
  fromMs: number,
  toMs: number,
  { refillThresholdL = 50, minCoverageMs = 15 * 60_000 }: RateOptions = {},
): number | null {
  const sorted = [...readings].sort(byTime);
  let netDropL = 0;
  let coveredMs = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const mid = (prev.t + cur.t) / 2;
    if (mid <= fromMs || mid > toMs) continue;
    const delta = cur.litres - prev.litres;
    if (delta >= refillThresholdL) continue;
    netDropL -= delta;
    coveredMs += cur.t - prev.t;
  }

  if (coveredMs < minCoverageMs) return null;
  return Math.max(0, netDropL / (coveredMs / HOUR));
}
