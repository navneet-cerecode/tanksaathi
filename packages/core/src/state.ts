import { DEFAULT_ANOMALY, detectSustainedLoss, type Anomaly, type AnomalyConfig } from "./anomaly";
import { DEFAULT_STALE_AFTER_MS, freshness, type Freshness } from "./freshness";
import { heatFactor, type Heat } from "./heat";
import { projectHoursRemaining, type Projection } from "./projection";
import { byTime, outflowRateLph, type Reading } from "./rate";
import { levelFromDistance, type TankConfig } from "./tank";

export interface BuildingConfig {
  buildingId: string;
  name: string;
  utcOffsetMinutes: number;
  /** Planning figure: residents × litres per person per day. */
  dailyDemandL: number;
  staleAfterMinutes?: number;
  /** Escalate an unacknowledged incident after this long (ASSUMPTION A9). */
  escalateAfterMinutes?: number;
  anomaly?: Partial<AnomalyConfig>;
}

export interface RawReading {
  t: number;
  distanceMm: number;
}

export interface TankStateInput {
  tank: TankConfig;
  building: BuildingConfig;
  readings: RawReading[];
  now: number;
  forecastMaxC: number | null;
  /** Readings at or before this instant (e.g. the last resolved incident) don't count toward rate or anomaly. */
  ignoreBefore?: number;
}

export interface TankState {
  lastReadingAt: number | null;
  levelPct: number | null;
  litres: number | null;
  usableLitres: number | null;
  observedLph: number | null;
  forecastMaxC: number | null;
  heat: Heat;
  projection: Projection | null;
  freshness: Freshness;
  anomaly: {
    /** Earliest reading time at which the sustained-loss rule held. */
    firstDetectedAt: number | null;
    excessLph: number | null;
    /** The windows as of the latest reading, for the "why" explanation. */
    latest: Anomaly | null;
  };
}

const HOUR = 3_600_000;

export function computeTankState({ tank, building, readings, now, forecastMaxC, ignoreBefore }: TankStateInput): TankState {
  const heat = heatFactor(forecastMaxC);
  const staleAfterMs = (building.staleAfterMinutes ?? DEFAULT_STALE_AFTER_MS / 60_000) * 60_000;
  const series: Reading[] = readings.map((r) => ({ t: r.t, litres: levelFromDistance(tank, r.distanceMm).litres })).sort(byTime);
  const latest = series[series.length - 1];

  if (!latest) {
    return {
      lastReadingAt: null,
      levelPct: null,
      litres: null,
      usableLitres: null,
      observedLph: null,
      forecastMaxC,
      heat,
      projection: null,
      freshness: freshness(null, now, staleAfterMs),
      anomaly: { firstDetectedAt: null, excessLph: null, latest: null },
    };
  }

  const level = levelFromDistance(tank, readings.reduce((a, b) => (b.t > a.t ? b : a)).distanceMm);
  const usable = ignoreBefore === undefined ? series : series.filter((r) => r.t > ignoreBefore);
  const refillThresholdL = building.anomaly?.refillThresholdL ?? DEFAULT_ANOMALY.refillThresholdL;
  const observedLph = outflowRateLph(usable, latest.t - HOUR, latest.t, { refillThresholdL });

  const projection = projectHoursRemaining({
    usableLitres: level.usableLitres,
    observedLph,
    dailyDemandL: building.dailyDemandL,
    heatFactor: heat.factor,
    now,
    utcOffsetMinutes: building.utcOffsetMinutes,
  });

  const detect = (at: number) =>
    detectSustainedLoss({
      readings: usable,
      at,
      dailyDemandL: building.dailyDemandL,
      heatFactor: heat.factor,
      utcOffsetMinutes: building.utcOffsetMinutes,
      config: building.anomaly,
    });

  let firstDetectedAt: number | null = null;
  let excessLph: number | null = null;
  for (const r of usable) {
    if (r.t < latest.t - 24 * HOUR) continue;
    const result = detect(r.t);
    if (result.detected) {
      firstDetectedAt = r.t;
      excessLph = result.excessLph;
      break;
    }
  }

  return {
    lastReadingAt: latest.t,
    levelPct: level.levelPct,
    litres: level.litres,
    usableLitres: level.usableLitres,
    observedLph,
    forecastMaxC,
    heat,
    projection,
    freshness: freshness(latest.t, now, staleAfterMs),
    anomaly: { firstDetectedAt, excessLph, latest: detect(latest.t) },
  };
}
