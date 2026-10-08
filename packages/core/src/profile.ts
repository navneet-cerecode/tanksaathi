/**
 * ASSUMPTION: share of a residential building's daily use in each local hour,
 * with the usual Indian morning and evening peaks. A real deployment should
 * replace this with the building's own history.
 */
export const DEFAULT_HOURLY_SHARE: readonly number[] = [
  0.015, 0.008, 0.007, 0.007, 0.012, 0.035, // 00–05
  0.08, 0.095, 0.085, 0.065, 0.05, 0.04, //   06–11
  0.04, 0.04, 0.035, 0.03, 0.032, 0.04, //    12–17
  0.055, 0.065, 0.06, 0.045, 0.035, 0.024, // 18–23
];

export function profileLph(
  dailyDemandL: number,
  hour: number,
  hourlyShare: readonly number[] = DEFAULT_HOURLY_SHARE,
): number {
  return dailyDemandL * (hourlyShare[hour] ?? 0);
}

/** Local hour of day for a fixed UTC offset (India has no DST). */
export function localHour(epochMs: number, utcOffsetMinutes: number): number {
  return new Date(epochMs + utcOffsetMinutes * 60_000).getUTCHours();
}
