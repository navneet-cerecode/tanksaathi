import { DEFAULT_HOURLY_SHARE, localHour, profileLph } from "./profile";
import { outflowRateLph, type Reading } from "./rate";

export interface AnomalyConfig {
  windowMinutes: number;
  /** Consecutive flagged windows needed before we call it sustained. */
  sustainWindows: number;
  /** Local hours [start, end) when almost nobody should be drawing water. */
  quietStartHour: number;
  quietEndHour: number;
  quietMultiplier: number;
  activeMultiplier: number;
  /** Loss must also beat expected by this many L/h, so tiny baselines don't trip it. */
  minExcessLph: number;
  refillThresholdL: number;
}

export const DEFAULT_ANOMALY: AnomalyConfig = {
  windowMinutes: 15,
  sustainWindows: 3,
  quietStartHour: 0,
  quietEndHour: 5,
  quietMultiplier: 3,
  activeMultiplier: 2.5,
  minExcessLph: 150,
  refillThresholdL: 50,
};

export interface AnomalyInput {
  readings: Reading[];
  /** Evaluate the windows that end at this instant (usually the latest reading). */
  at: number;
  dailyDemandL: number;
  heatFactor: number;
  utcOffsetMinutes: number;
  hourlyShare?: readonly number[];
  config?: Partial<AnomalyConfig>;
}

export interface WindowCheck {
  from: number;
  to: number;
  observedLph: number | null;
  expectedLph: number;
  thresholdLph: number;
  quiet: boolean;
  flagged: boolean;
}

export interface Anomaly {
  detected: boolean;
  /** Oldest first. */
  windows: WindowCheck[];
  excessLph: number | null;
}

/**
 * Deterministic sustained-loss rule: every one of the last N windows must
 * show outflow well above what the demand profile expects for that hour.
 * Missing data never counts as a loss.
 */
export function detectSustainedLoss({
  readings,
  at,
  dailyDemandL,
  heatFactor,
  utcOffsetMinutes,
  hourlyShare = DEFAULT_HOURLY_SHARE,
  config,
}: AnomalyInput): Anomaly {
  const c = { ...DEFAULT_ANOMALY, ...config };
  const windowMs = c.windowMinutes * 60_000;
  const windows: WindowCheck[] = [];

  for (let k = c.sustainWindows - 1; k >= 0; k--) {
    const to = at - k * windowMs;
    const from = to - windowMs;
    const hour = localHour((from + to) / 2, utcOffsetMinutes);
    const quiet = hour >= c.quietStartHour && hour < c.quietEndHour;
    const expectedLph = profileLph(dailyDemandL, hour, hourlyShare) * heatFactor;
    const thresholdLph = Math.max(
      expectedLph * (quiet ? c.quietMultiplier : c.activeMultiplier),
      expectedLph + c.minExcessLph,
    );
    const observedLph = outflowRateLph(readings, from, to, {
      refillThresholdL: c.refillThresholdL,
      minCoverageMs: windowMs / 2,
    });
    windows.push({
      from,
      to,
      observedLph,
      expectedLph,
      thresholdLph,
      quiet,
      flagged: observedLph !== null && observedLph > thresholdLph,
    });
  }

  const detected = windows.every((w) => w.flagged);
  const excessLph = detected
    ? windows.reduce((sum, w) => sum + (w.observedLph! - w.expectedLph), 0) / windows.length
    : null;
  return { detected, windows, excessLph };
}
