export const DEFAULT_STALE_AFTER_MS = 20 * 60_000;

export interface Freshness {
  state: "none" | "fresh" | "stale";
  ageMs: number | null;
}

export function freshness(
  lastReadingAt: number | null,
  now: number,
  staleAfterMs = DEFAULT_STALE_AFTER_MS,
): Freshness {
  if (lastReadingAt === null) return { state: "none", ageMs: null };
  const ageMs = Math.max(0, now - lastReadingAt);
  return { state: ageMs > staleAfterMs ? "stale" : "fresh", ageMs };
}
