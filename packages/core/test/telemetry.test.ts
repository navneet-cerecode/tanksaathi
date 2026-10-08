import { describe, expect, it } from "vitest";
import { parseTelemetryTopic, telemetryTopic, TelemetryMessageSchema } from "../src/telemetry";

const reading = { seq: 41, measuredAt: "2026-10-08T09:00:00.000Z", distanceMm: 812 };
const valid = { v: 1, deviceId: "sim-demo-hostel-a-roof-1", readings: [reading] };

describe("TelemetryMessageSchema", () => {
  it("accepts a well-formed message", () => {
    expect(TelemetryMessageSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects unknown fields so a payload can't smuggle in a building or source", () => {
    expect(TelemetryMessageSchema.safeParse({ ...valid, buildingId: "other" }).success).toBe(false);
    expect(TelemetryMessageSchema.safeParse({ ...valid, readings: [{ ...reading, source: "device" }] }).success).toBe(false);
  });

  it("rejects an empty batch and an oversized batch", () => {
    expect(TelemetryMessageSchema.safeParse({ ...valid, readings: [] }).success).toBe(false);
    const big = Array.from({ length: 121 }, (_, i) => ({ ...reading, seq: i }));
    expect(TelemetryMessageSchema.safeParse({ ...valid, readings: big }).success).toBe(false);
  });

  it.each([
    ["a non-ISO timestamp", { measuredAt: "yesterday" }],
    ["a negative sequence", { seq: -1 }],
    ["a fractional distance", { distanceMm: 812.5 }],
    ["an impossible distance", { distanceMm: 20_001 }],
  ])("rejects %s", (_label, patch) => {
    expect(TelemetryMessageSchema.safeParse({ ...valid, readings: [{ ...reading, ...patch }] }).success).toBe(false);
  });

  it("rejects an unsupported schema version", () => {
    expect(TelemetryMessageSchema.safeParse({ ...valid, v: 2 }).success).toBe(false);
  });
});

describe("telemetry topics", () => {
  it("round-trips a simulator topic", () => {
    const topic = telemetryTopic("sim", "demo-hostel-a", "roof-1");
    expect(topic).toBe("tanksaathi/v1/sim/demo-hostel-a/roof-1/reading");
    expect(parseTelemetryTopic(topic)).toEqual({ channel: "sim", buildingId: "demo-hostel-a", tankId: "roof-1" });
  });

  it("accepts the device channel", () => {
    expect(parseTelemetryTopic("tanksaathi/v1/dev/b-12/t-1/reading")?.channel).toBe("dev");
  });

  it.each([
    "other/v1/sim/demo-hostel-a/roof-1/reading",
    "tanksaathi/v2/sim/demo-hostel-a/roof-1/reading",
    "tanksaathi/v1/admin/demo-hostel-a/roof-1/reading",
    "tanksaathi/v1/sim/Demo_Hostel/roof-1/reading",
    "tanksaathi/v1/sim/demo-hostel-a/roof-1",
    "tanksaathi/v1/sim/demo-hostel-a/roof-1/reading/extra",
  ])("rejects %s", (topic) => {
    expect(parseTelemetryTopic(topic)).toBeNull();
  });
});
