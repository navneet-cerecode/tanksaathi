import { describe, expect, it } from "vitest";
import { distanceForLitres, levelFromDistance, type TankConfig } from "../src/tank";

const tank: TankConfig = {
  buildingId: "demo-hostel-a",
  tankId: "roof-1",
  name: "Roof tank 1",
  capacityL: 10_000,
  heightMm: 1_500,
  sensorToFullMm: 200,
  unusableBelowPct: 8,
};

describe("levelFromDistance", () => {
  it("reads a full tank when the water surface sits at the full line", () => {
    const level = levelFromDistance(tank, 200);
    expect(level.levelPct).toBe(100);
    expect(level.litres).toBe(10_000);
  });

  it("reads an empty tank when the surface is a full height below the full line", () => {
    const level = levelFromDistance(tank, 200 + 1_500);
    expect(level.levelPct).toBe(0);
    expect(level.litres).toBe(0);
    expect(level.usableLitres).toBe(0);
  });

  it("reads half a tank halfway down", () => {
    const level = levelFromDistance(tank, 200 + 750);
    expect(level.levelPct).toBeCloseTo(50, 5);
    expect(level.litres).toBeCloseTo(5_000, 5);
  });

  it("clamps splashes above the full line to 100%", () => {
    expect(levelFromDistance(tank, 120).levelPct).toBe(100);
  });

  it("clamps readings below the tank floor to 0%", () => {
    expect(levelFromDistance(tank, 5_000).levelPct).toBe(0);
  });

  it("excludes the water below the outlet from usable litres", () => {
    const level = levelFromDistance(tank, 200 + 750);
    expect(level.usableLitres).toBeCloseTo(5_000 - 800, 5);
  });
});

describe("distanceForLitres", () => {
  it("is the inverse of levelFromDistance", () => {
    for (const litres of [0, 1_234, 5_000, 9_999, 10_000]) {
      const distance = distanceForLitres(tank, litres);
      expect(levelFromDistance(tank, distance).litres).toBeCloseTo(litres, 5);
    }
  });
});
