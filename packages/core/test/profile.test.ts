import { describe, expect, it } from "vitest";
import { DEFAULT_HOURLY_SHARE, localHour, profileLph } from "../src/profile";

describe("demand profile", () => {
  it("has 24 hourly shares that add up to the whole day", () => {
    expect(DEFAULT_HOURLY_SHARE).toHaveLength(24);
    const total = DEFAULT_HOURLY_SHARE.reduce((sum, share) => sum + share, 0);
    expect(total).toBeCloseTo(1, 9);
  });

  it("spreads the daily demand across the hours", () => {
    let total = 0;
    for (let hour = 0; hour < 24; hour++) total += profileLph(7_200, hour);
    expect(total).toBeCloseTo(7_200, 6);
  });

  it("peaks in the morning and is quiet at night", () => {
    expect(profileLph(7_200, 7)).toBeGreaterThan(profileLph(7_200, 2) * 5);
  });
});

describe("localHour", () => {
  it("converts UTC to the building's local hour (IST is UTC+5:30)", () => {
    expect(localHour(Date.UTC(2026, 9, 8, 20, 45), 330)).toBe(2); // 02:15 IST next day
    expect(localHour(Date.UTC(2026, 9, 8, 2, 30), 330)).toBe(8); // 08:00 IST
  });
});
