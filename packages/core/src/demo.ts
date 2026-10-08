import type { BuildingConfig } from "./state";
import type { TankConfig } from "./tank";

/** Fictional demo building used by the seed script, simulator and tests. */
export const DEMO_BUILDING: BuildingConfig = {
  buildingId: "demo-hostel-a",
  name: "Demo Hostel Block A",
  utcOffsetMinutes: 330,
  // 80 residents × 90 L (ASSUMPTION A6).
  dailyDemandL: 7_200,
};

export const DEMO_TANK: TankConfig = {
  buildingId: "demo-hostel-a",
  tankId: "roof-1",
  name: "Roof tank",
  capacityL: 10_000,
  heightMm: 1_500,
  sensorToFullMm: 200,
  unusableBelowPct: 8,
};

/** Second building, used only to prove that buildings can't see each other's data. */
export const ISOLATION_BUILDING: BuildingConfig = {
  buildingId: "demo-hostel-b",
  name: "Demo Hostel Block B",
  utcOffsetMinutes: 330,
  dailyDemandL: 4_500,
};

export const ISOLATION_TANK: TankConfig = {
  ...DEMO_TANK,
  buildingId: "demo-hostel-b",
  capacityL: 6_000,
};

export const SIM_DEVICE_ID = `sim-${DEMO_TANK.buildingId}-${DEMO_TANK.tankId}`;
