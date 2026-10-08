/**
 * Geometry of one rooftop tank with a top-mounted distance sensor
 * (ultrasonic or ToF). Assumes an upright prism or cylinder, so litres
 * scale linearly with water height.
 */
export interface TankConfig {
  buildingId: string;
  tankId: string;
  name: string;
  capacityL: number;
  /** Water column height from the tank floor to the full line. */
  heightMm: number;
  /** Sensor-to-surface distance when the tank is exactly full. */
  sensorToFullMm: number;
  /** Water below the outlet, which residents can never draw. */
  unusableBelowPct: number;
}

export interface Level {
  levelPct: number;
  litres: number;
  usableLitres: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function levelFromDistance(tank: TankConfig, distanceMm: number): Level {
  const waterMm = clamp(tank.heightMm - (distanceMm - tank.sensorToFullMm), 0, tank.heightMm);
  const levelPct = (waterMm / tank.heightMm) * 100;
  const litres = (tank.capacityL * levelPct) / 100;
  const unusableL = (tank.capacityL * tank.unusableBelowPct) / 100;
  return { levelPct, litres, usableLitres: Math.max(0, litres - unusableL) };
}

/** Inverse of levelFromDistance, used by the simulator. */
export function distanceForLitres(tank: TankConfig, litres: number): number {
  const waterMm = (clamp(litres, 0, tank.capacityL) / tank.capacityL) * tank.heightMm;
  return tank.sensorToFullMm + (tank.heightMm - waterMm);
}
