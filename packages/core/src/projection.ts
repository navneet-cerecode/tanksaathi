import { DEFAULT_HOURLY_SHARE, localHour, profileLph } from "./profile";

const HOUR = 3_600_000;

export interface ProjectionInput {
  usableLitres: number;
  /** Measured recent outflow; null when there isn't enough data. */
  observedLph: number | null;
  dailyDemandL: number;
  heatFactor: number;
  now: number;
  utcOffsetMinutes: number;
  hourlyShare?: readonly number[];
  horizonHours?: number;
}

export interface Projection {
  /** Usable litres ÷ observed rate. Null when not draining or unknown. */
  hoursAtCurrentUse: number | null;
  /** Walk of the hourly demand profile scaled by the heat factor. */
  hoursHeatAdjusted: number;
  /** The earlier of the two — the number we show. */
  hoursConservative: number;
  basis: "current-use" | "heat-adjusted";
  /** True when the tank outlasts the horizon. */
  capped: boolean;
}

export function projectHoursRemaining({
  usableLitres,
  observedLph,
  dailyDemandL,
  heatFactor,
  now,
  utcOffsetMinutes,
  hourlyShare = DEFAULT_HOURLY_SHARE,
  horizonHours = 72,
}: ProjectionInput): Projection {
  const hoursAtCurrentUse = observedLph && observedLph > 0 ? Math.max(0, usableLitres) / observedLph : null;

  let remaining = Math.max(0, usableLitres);
  let hours = 0;
  let t = now;
  while (remaining > 0 && hours < horizonHours) {
    const msIntoHour = (t + utcOffsetMinutes * 60_000) % HOUR;
    const sliceH = Math.min((HOUR - msIntoHour) / HOUR, horizonHours - hours);
    const rate = profileLph(dailyDemandL, localHour(t, utcOffsetMinutes), hourlyShare) * heatFactor;
    if (rate > 0 && rate * sliceH >= remaining) {
      hours += remaining / rate;
      remaining = 0;
      break;
    }
    remaining -= rate * sliceH;
    hours += sliceH;
    t += sliceH * HOUR;
  }
  const capped = remaining > 0;
  const hoursHeatAdjusted = capped ? horizonHours : hours;

  const useCurrent = hoursAtCurrentUse !== null && hoursAtCurrentUse <= hoursHeatAdjusted;
  return {
    hoursAtCurrentUse,
    hoursHeatAdjusted,
    hoursConservative: useCurrent ? hoursAtCurrentUse : hoursHeatAdjusted,
    basis: useCurrent ? "current-use" : "heat-adjusted",
    capped: capped && !useCurrent,
  };
}
