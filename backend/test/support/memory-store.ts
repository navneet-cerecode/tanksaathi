import type { RawReading, TankState } from "@tanksaathi/core";
import type { StoredReading, TankContext, TankMeta, TankStore } from "../../src/ingest/process";

/** In-memory TankStore for unit tests. Keys mirror the DynamoDB layout: one item per (time, seq). */
export class MemoryStore implements TankStore {
  readonly readings = new Map<string, Map<string, StoredReading>>();
  readonly states = new Map<string, TankState>();
  readonly contexts = new Map<string, TankContext>();
  readonly metas = new Map<string, TankMeta>();

  addTank(context: TankContext, meta: TankMeta = { lastResolvedAt: null }) {
    const key = `${context.tank.buildingId}#${context.tank.tankId}`;
    this.contexts.set(key, context);
    this.metas.set(key, meta);
  }

  async getContext(buildingId: string, tankId: string) {
    return this.contexts.get(`${buildingId}#${tankId}`) ?? null;
  }

  async getMeta(buildingId: string, tankId: string) {
    return this.metas.get(`${buildingId}#${tankId}`) ?? { lastResolvedAt: null };
  }

  async putReadings(buildingId: string, tankId: string, readings: StoredReading[]) {
    const key = `${buildingId}#${tankId}`;
    const items = this.readings.get(key) ?? new Map<string, StoredReading>();
    for (const r of readings) items.set(`${r.t}#${r.seq}`, r);
    this.readings.set(key, items);
  }

  async recentReadings(buildingId: string, tankId: string, sinceMs: number): Promise<RawReading[]> {
    const items = this.readings.get(`${buildingId}#${tankId}`) ?? new Map();
    return [...items.values()].filter((r) => r.t >= sinceMs).map((r) => ({ t: r.t, distanceMm: r.distanceMm }));
  }

  async saveState(buildingId: string, tankId: string, state: TankState) {
    this.states.set(`${buildingId}#${tankId}`, state);
  }

  count(buildingId: string, tankId: string) {
    return this.readings.get(`${buildingId}#${tankId}`)?.size ?? 0;
  }
}
