export type HeatBand = "unknown" | "normal" | "warm" | "hot" | "extreme";

export interface Heat {
  factor: number;
  band: HeatBand;
}

/**
 * ASSUMPTION, not a measured relationship: hotter days raise building water
 * use. The 40 °C step follows IMD's plains heatwave threshold; the factors
 * themselves are configurable placeholders until a real building's data
 * calibrates them. The UI must label them as an assumption.
 */
export const HEAT_BANDS: ReadonlyArray<{ fromC: number; factor: number; band: HeatBand }> = [
  { fromC: 44, factor: 1.3, band: "extreme" },
  { fromC: 40, factor: 1.2, band: "hot" },
  { fromC: 35, factor: 1.1, band: "warm" },
];

export function heatFactor(forecastMaxC: number | null): Heat {
  if (forecastMaxC === null) return { factor: 1.0, band: "unknown" };
  const match = HEAT_BANDS.find((b) => forecastMaxC >= b.fromC);
  return match ? { factor: match.factor, band: match.band } : { factor: 1.0, band: "normal" };
}
