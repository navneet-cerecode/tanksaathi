import { describe, expect, it } from "vitest";
import { heatFactor } from "../src/heat";

describe("heatFactor", () => {
  it.each([
    [null, 1.0, "unknown"],
    [34.9, 1.0, "normal"],
    [35, 1.1, "warm"],
    [39.9, 1.1, "warm"],
    [40, 1.2, "hot"],
    [43.9, 1.2, "hot"],
    [44, 1.3, "extreme"],
    [48, 1.3, "extreme"],
  ] as const)("maps a forecast max of %s °C to factor %s (%s)", (maxC, factor, band) => {
    expect(heatFactor(maxC)).toEqual({ factor, band });
  });
});
