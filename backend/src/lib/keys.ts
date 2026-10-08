/**
 * Single-table layout.
 *
 *   BUILDING#<b> / META           building config + current forecast
 *   BUILDING#<b> / TANK#<t>       tank geometry
 *   TANK#<b>#<t> / R#<iso>#<seq>  one reading (TTL 7 days)
 *   TANK#<b>#<t> / STATE          latest computed state + lastResolvedAt
 */
export const buildingPk = (buildingId: string) => `BUILDING#${buildingId}`;
export const tankPk = (buildingId: string, tankId: string) => `TANK#${buildingId}#${tankId}`;
export const tankConfigSk = (tankId: string) => `TANK#${tankId}`;
export const META_SK = "META";
export const STATE_SK = "STATE";

const iso = (t: number) => new Date(t).toISOString();

/** ISO-8601 UTC strings sort lexicographically in time order. */
export const readingSk = (t: number, seq: number) => `R#${iso(t)}#${String(seq).padStart(12, "0")}`;
export const readingSkFloor = (t: number) => `R#${iso(t)}`;
export const READING_SK_CEILING = "R#~";
