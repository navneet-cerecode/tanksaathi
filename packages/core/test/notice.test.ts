import { describe, expect, it } from "vitest";
import { formatHours, incidentNotice } from "../src/notice";

const detectedAt = Date.UTC(2026, 9, 7, 20, 20); // 01:50 IST on Oct 8
const base = {
  buildingName: "Demo Hostel Block A",
  tankName: "Roof tank",
  utcOffsetMinutes: 330,
  detectedAt,
  excessLph: 218.6,
  levelPctAtOpen: 27.4,
  hoursRemainingAtOpen: 4.04,
  severity: "medium" as const,
  simulated: true,
  appUrl: "https://example.test/incidents/roof-1-abc",
};

describe("incidentNotice", () => {
  it("writes an ASCII subject SNS will accept", () => {
    const { subject } = incidentNotice(base);
    expect(subject).toBe("TankSaathi: possible leak - Demo Hostel Block A, Roof tank");
    expect(subject.length).toBeLessThan(100);
    expect(/^[\x20-\x7e]+$/.test(subject)).toBe(true);
  });

  it("states when, how much and how long in plain words", () => {
    const { body } = incidentNotice(base);
    expect(body).toContain("Since 01:50 IST");
    expect(body).toContain("about 220 L/h more");
    expect(body).toContain("27%");
    expect(body).toContain("about 4 hours");
    expect(body).toContain("https://example.test/incidents/roof-1-abc");
  });

  it("flags simulated data, and only simulated data", () => {
    expect(incidentNotice(base).body).toContain("SIMULATED DATA");
    expect(incidentNotice({ ...base, simulated: false }).body).not.toContain("SIMULATED");
  });

  it("marks high-severity incidents as urgent in the subject", () => {
    expect(incidentNotice({ ...base, severity: "high" }).subject).toMatch(/^TankSaathi: URGENT possible leak/);
  });
});

describe("formatHours", () => {
  it.each([
    [null, "unknown"],
    [0, "less than 1 hour"],
    [0.6, "less than 1 hour"],
    [1.2, "about 1 hour"],
    [4.04, "about 4 hours"],
    [17.6, "about 18 hours"],
    [72, "more than 3 days"],
  ] as const)("%s → %s", (hours, text) => {
    expect(formatHours(hours)).toBe(text);
  });
});
