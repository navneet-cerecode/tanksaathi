import {
  byTime,
  computeTankState,
  DEFAULT_STALE_AFTER_MS,
  freshness,
  levelFromDistance,
  localHour,
  outflowRateLph,
  profileLph,
  residentStatus,
  type BuildingConfig,
  type Channel,
  type RawReading,
  type ResidentStatus,
  type TankConfig,
  type TankState,
} from "@tanksaathi/core";

const HOUR = 3_600_000;

export interface ResidentView {
  buildingId: string;
  buildingName: string;
  status: ResidentStatus;
  stale: boolean;
  noData: boolean;
  updatedAt: number | null;
  refillPlannedAt: number | null;
  simulated: boolean;
}

/** Deliberately coarse: residents get a status word, never litres or incident details. */
export function residentView(input: {
  building: BuildingConfig;
  state: TankState | null;
  computedAt: number;
  channel: Channel | null;
  openIncident: boolean;
  refillPlannedAt: number | null;
  now: number;
}): ResidentView {
  const { building, state, computedAt, channel, openIncident, refillPlannedAt, now } = input;
  const staleAfterMs = (building.staleAfterMinutes ?? DEFAULT_STALE_AFTER_MS / 60_000) * 60_000;
  const fresh = freshness(state?.lastReadingAt ?? null, now, staleAfterMs);
  const stored = state?.projection?.hoursConservative;
  const hoursNow = stored === undefined ? null : Math.max(0, stored - (now - computedAt) / HOUR);
  const refillPlanned = refillPlannedAt !== null && refillPlannedAt >= now - HOUR;
  return {
    buildingId: building.buildingId,
    buildingName: building.name,
    status: residentStatus({ openIncident, hoursRemaining: hoursNow, refillPlanned }),
    stale: fresh.state === "stale",
    noData: fresh.state === "none",
    updatedAt: state?.lastReadingAt ?? null,
    refillPlannedAt: refillPlanned ? refillPlannedAt : null,
    simulated: channel === "sim",
  };
}

export interface HourlyUse {
  from: number;
  to: number;
  observedLph: number | null;
  expectedLph: number;
}

/** Caretaker detail: state recomputed at read time, the level series, and hourly use against the profile. */
export function tankView(input: {
  tank: TankConfig;
  building: BuildingConfig;
  readings: RawReading[];
  forecastMaxC: number | null;
  lastResolvedAt: number | null;
  channel: Channel | null;
  now: number;
}) {
  const { tank, building, readings, forecastMaxC, lastResolvedAt, channel, now } = input;
  const state = computeTankState({ tank, building, readings, now, forecastMaxC, ignoreBefore: lastResolvedAt ?? undefined });
  const sorted = [...readings].sort(byTime);
  const series = sorted.map((r) => ({ t: r.t, levelPct: levelFromDistance(tank, r.distanceMm).levelPct }));
  const litres = sorted.map((r) => ({ t: r.t, litres: levelFromDistance(tank, r.distanceMm).litres }));

  const hourly: HourlyUse[] = [];
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first && last) {
    const offset = building.utcOffsetMinutes * 60_000;
    const lastHourStart = Math.floor((last.t + offset) / HOUR) * HOUR - offset;
    for (let from = lastHourStart - 23 * HOUR; from <= lastHourStart; from += HOUR) {
      if (from < first.t) continue;
      hourly.push({
        from,
        to: from + HOUR,
        observedLph: outflowRateLph(litres, from, from + HOUR, { minCoverageMs: 30 * 60_000 }),
        expectedLph: profileLph(building.dailyDemandL, localHour(from, building.utcOffsetMinutes)) * state.heat.factor,
      });
    }
  }

  return {
    tank: { tankId: tank.tankId, name: tank.name, capacityL: tank.capacityL },
    state,
    series,
    hourly,
    simulated: channel === "sim",
  };
}
