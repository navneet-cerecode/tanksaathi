import { localHour, profileLph } from "./profile";
import { distanceForLitres, type TankConfig } from "./tank";

/**
 * SENSOR SIMULATOR. Deterministic, seeded demo timelines. Nothing here is
 * field data; every reading produced by this module must be labelled
 * "Sensor simulator" wherever it is shown.
 */
export const SCENARIOS = ["normal", "heat", "leak", "stale", "recovery"] as const;
export type ScenarioId = (typeof SCENARIOS)[number];

export interface ScenarioInput {
  id: ScenarioId;
  tank: TankConfig;
  dailyDemandL: number;
  utcOffsetMinutes: number;
  now: number;
}

export interface SimReading {
  t: number;
  distanceMm: number;
}

export interface Scenario {
  id: ScenarioId;
  forecastMaxC: number;
  description: string;
  readings: SimReading[];
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MAX_READINGS = 119;

interface Plan {
  forecastMaxC: number;
  useMultiplier: number;
  leakLph: number;
  leakFrom: number | null;
  leakUntil: number | null;
  /** Ordinary morning municipal supply, pumped up from the sump. */
  morningRefill: boolean;
  /** Tanker refill after the leak is fixed: [from, until, L/h]. */
  extraRefill: [number, number, number] | null;
  dropAfter: number | null;
  description: string;
}

/** mulberry32: tiny seeded PRNG so every run of a scenario is identical. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** The story starts at the most recent 21:00 local that is at least 4 h ago, so it always spans a night. */
function storyStart(now: number, offsetMin: number): number {
  const local = now + offsetMin * MIN;
  let start = Math.floor(local / DAY) * DAY + 21 * HOUR;
  while (local - start < 4 * HOUR) start -= DAY;
  return start - offsetMin * MIN;
}

/** UTC epoch of the first `hour:minute` local time after `from`. */
function nextLocal(from: number, offsetMin: number, hour: number, minute = 0): number {
  const local = from + offsetMin * MIN;
  let t = Math.floor(local / DAY) * DAY + hour * HOUR + minute * MIN;
  if (t <= local) t += DAY;
  return t - offsetMin * MIN;
}

function plan(id: ScenarioId, start: number, now: number, offsetMin: number): Plan {
  const oneAm = nextLocal(start, offsetMin, 1);
  const leakFrom = oneAm <= now - HOUR ? oneAm : now - HOUR;
  const base: Plan = {
    forecastMaxC: 33,
    useMultiplier: 1,
    leakLph: 0,
    leakFrom: null,
    leakUntil: null,
    morningRefill: true,
    extraRefill: null,
    dropAfter: null,
    description: "Normal use on a 33 °C day, with the usual morning refill.",
  };
  switch (id) {
    case "normal":
      return base;
    case "heat":
      return {
        ...base,
        forecastMaxC: 42,
        useMultiplier: 1.2,
        description: "A 42 °C day: the building draws about 20% more (assumed), so the tank empties sooner.",
      };
    case "leak":
      return {
        ...base,
        leakLph: 220,
        leakFrom,
        description: "From 1 AM a running cistern or stuck float valve loses about 220 L/h while the building sleeps.",
      };
    case "stale":
      return {
        ...base,
        dropAfter: now - 50 * MIN,
        description: "The sensor stopped reporting 50 minutes ago.",
      };
    case "recovery":
      return {
        ...base,
        leakLph: 220,
        leakFrom,
        leakUntil: now - 40 * MIN,
        // A tanker unloading pump moves roughly 300 L/min.
        extraRefill: [now - 40 * MIN, now - 10 * MIN, 18_000],
        description: "The valve is fixed 40 minutes ago and a tanker refills the tank.",
      };
  }
}

export function generateScenario({ id, tank, dailyDemandL, utcOffsetMinutes, now }: ScenarioInput): Scenario {
  const start = storyStart(now, utcOffsetMinutes);
  const stepMs = (now - start) / (10 * MIN) <= MAX_READINGS ? 10 * MIN : 15 * MIN;
  const p = plan(id, start, now, utcOffsetMinutes);
  const random = seeded(SCENARIOS.indexOf(id) + 7);
  const fullL = tank.capacityL * 0.95;
  const refillFrom = nextLocal(start, utcOffsetMinutes, 5, 30);
  const refillUntil = refillFrom + HOUR;

  const times: number[] = [];
  for (let t = now; t >= start; t -= stepMs) times.unshift(t);

  let litres = tank.capacityL * 0.7;
  const readings: SimReading[] = [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i]!;
    if (i > 0) {
      const prev = times[i - 1]!;
      const hours = (t - prev) / HOUR;
      const jitter = 0.92 + 0.16 * random();
      litres -= profileLph(dailyDemandL, localHour(prev, utcOffsetMinutes)) * p.useMultiplier * jitter * hours;
      const leaking = p.leakFrom !== null && prev >= p.leakFrom && (p.leakUntil === null || prev < p.leakUntil);
      if (leaking) litres -= p.leakLph * hours;
      if (p.morningRefill && prev >= refillFrom && prev < refillUntil) litres = Math.min(fullL, litres + 4_000 * hours);
      if (p.extraRefill && prev >= p.extraRefill[0] && prev < p.extraRefill[1]) {
        litres = Math.min(fullL, litres + p.extraRefill[2] * hours);
      }
      litres = Math.max(0, litres);
    }
    if (p.dropAfter !== null && t > p.dropAfter) continue;
    const noiseMm = Math.round((random() - 0.5) * 4);
    readings.push({ t, distanceMm: Math.max(0, Math.round(distanceForLitres(tank, litres)) + noiseMm) });
  }

  return { id, forecastMaxC: p.forecastMaxC, description: p.description, readings };
}
