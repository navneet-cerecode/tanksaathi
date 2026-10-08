import {
  computeTankState,
  parseTelemetryTopic,
  TelemetryMessageSchema,
  type BuildingConfig,
  type Channel,
  type RawReading,
  type TankConfig,
  type TankState,
} from "@tanksaathi/core";

const MIN = 60_000;
const HOUR = 60 * MIN;

/** State is computed over this much history; it covers the simulator's longest story. */
export const LOOKBACK_MS = 30 * HOUR;
const MAX_FUTURE_MS = 10 * MIN;
const MAX_AGE_MS: Record<Channel, number> = { dev: 24 * HOUR, sim: 36 * HOUR };
/** A distance this far past the tank floor means a sensor fault, not water. */
const FLOOR_MARGIN_MM = 300;

export interface TankContext {
  building: BuildingConfig;
  tank: TankConfig;
  forecastMaxC: number | null;
}

export interface TankMeta {
  lastResolvedAt: number | null;
}

export interface StoredReading {
  t: number;
  seq: number;
  distanceMm: number;
  deviceId: string;
  channel: Channel;
}

export interface TankStore {
  getContext(buildingId: string, tankId: string): Promise<TankContext | null>;
  getMeta(buildingId: string, tankId: string): Promise<TankMeta>;
  /** Must be idempotent: the same (t, seq) overwrites itself. */
  putReadings(buildingId: string, tankId: string, readings: StoredReading[]): Promise<void>;
  recentReadings(buildingId: string, tankId: string, sinceMs: number): Promise<RawReading[]>;
  saveState(buildingId: string, tankId: string, state: TankState, computedAt: number, channel: Channel): Promise<void>;
}

export type RejectReason = "bad-topic" | "bad-payload" | "identity-mismatch" | "unknown-tank" | "no-valid-readings";

export type IngestOutcome =
  | {
      ok: true;
      buildingId: string;
      tankId: string;
      channel: Channel;
      accepted: number;
      rejected: number;
      state: TankState;
      context: TankContext;
    }
  | { ok: false; reason: RejectReason };

/**
 * Handle one IoT Rule invocation. The rule SQL adds `topic` and `clientId`
 * beside the device payload; building, tank and channel come only from the
 * topic, which the IoT policy pins to the publisher's identity.
 */
export async function processTelemetry(event: Record<string, unknown>, store: TankStore, now: number): Promise<IngestOutcome> {
  const { topic, clientId, ...payload } = event;
  const route = typeof topic === "string" ? parseTelemetryTopic(topic) : null;
  if (!route) return { ok: false, reason: "bad-topic" };

  const parsed = TelemetryMessageSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, reason: "bad-payload" };
  const message = parsed.data;

  const identityOk =
    route.channel === "dev" ? clientId === message.deviceId : message.deviceId.startsWith("sim-");
  if (!identityOk) return { ok: false, reason: "identity-mismatch" };

  const context = await store.getContext(route.buildingId, route.tankId);
  if (!context) return { ok: false, reason: "unknown-tank" };

  const floorMm = context.tank.sensorToFullMm + context.tank.heightMm + FLOOR_MARGIN_MM;
  const valid: StoredReading[] = [];
  for (const r of message.readings) {
    const t = Date.parse(r.measuredAt);
    const plausible = t <= now + MAX_FUTURE_MS && t >= now - MAX_AGE_MS[route.channel] && r.distanceMm <= floorMm;
    if (plausible) valid.push({ t, seq: r.seq, distanceMm: r.distanceMm, deviceId: message.deviceId, channel: route.channel });
  }
  if (valid.length === 0) return { ok: false, reason: "no-valid-readings" };

  await store.putReadings(route.buildingId, route.tankId, valid);
  const [readings, meta] = await Promise.all([
    store.recentReadings(route.buildingId, route.tankId, now - LOOKBACK_MS),
    store.getMeta(route.buildingId, route.tankId),
  ]);

  const state = computeTankState({
    tank: context.tank,
    building: context.building,
    readings,
    now,
    forecastMaxC: context.forecastMaxC,
    ignoreBefore: meta.lastResolvedAt ?? undefined,
  });
  await store.saveState(route.buildingId, route.tankId, state, now, route.channel);

  return {
    ok: true,
    buildingId: route.buildingId,
    tankId: route.tankId,
    channel: route.channel,
    accepted: valid.length,
    rejected: message.readings.length - valid.length,
    state,
    context,
  };
}
