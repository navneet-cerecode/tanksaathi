import { describe, expect, it } from "vitest";
import { buildingPk, readingSk, readingSkFloor, tankConfigSk, tankPk } from "../src/lib/keys";

describe("DynamoDB keys", () => {
  it("scopes every tank item under its building", () => {
    expect(tankPk("demo-hostel-a", "roof-1")).toBe("TANK#demo-hostel-a#roof-1");
    expect(buildingPk("demo-hostel-a")).toBe("BUILDING#demo-hostel-a");
    expect(tankConfigSk("roof-1")).toBe("TANK#roof-1");
  });

  it("sorts reading keys by time, then sequence", () => {
    const keys = [
      readingSk(Date.UTC(2026, 9, 8, 9, 0), 5),
      readingSk(Date.UTC(2026, 9, 7, 23, 59), 999_999),
      readingSk(Date.UTC(2026, 9, 8, 9, 0), 40),
      readingSk(Date.UTC(2026, 9, 10, 0, 0), 1),
    ];
    expect([...keys].sort()).toEqual([keys[1], keys[0], keys[2], keys[3]]);
  });

  it("gives a range floor that sorts before every reading at or after that time", () => {
    const t = Date.UTC(2026, 9, 8, 9, 0);
    expect(readingSkFloor(t) <= readingSk(t, 0)).toBe(true);
    expect(readingSkFloor(t) > readingSk(t - 1, 99)).toBe(true);
  });
});
