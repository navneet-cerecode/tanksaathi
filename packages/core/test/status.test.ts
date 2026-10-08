import { describe, expect, it } from "vitest";
import { freshness } from "../src/freshness";
import { canTransition, nextStates, severityFor } from "../src/incident";
import { residentStatus } from "../src/status";

const MIN = 60_000;
const now = Date.UTC(2026, 9, 8, 9, 0);

describe("freshness", () => {
  it("has no state before the first reading", () => {
    expect(freshness(null, now)).toEqual({ state: "none", ageMs: null });
  });

  it("is fresh up to and including the stale limit", () => {
    expect(freshness(now - 5 * MIN, now).state).toBe("fresh");
    expect(freshness(now - 20 * MIN, now).state).toBe("fresh");
  });

  it("is stale past the limit", () => {
    expect(freshness(now - 21 * MIN, now)).toEqual({ state: "stale", ageMs: 21 * MIN });
  });

  it("treats a reading stamped slightly in the future as fresh", () => {
    expect(freshness(now + 2 * MIN, now)).toEqual({ state: "fresh", ageMs: 0 });
  });
});

describe("residentStatus", () => {
  it("shows an open incident above everything else", () => {
    expect(residentStatus({ openIncident: true, hoursRemaining: 2, refillPlanned: true })).toBe("incident");
  });

  it("shows a planned refill when the caretaker has scheduled one", () => {
    expect(residentStatus({ openIncident: false, hoursRemaining: 3, refillPlanned: true })).toBe("refill-planned");
  });

  it("asks residents to conserve when fewer than six hours remain", () => {
    expect(residentStatus({ openIncident: false, hoursRemaining: 5.9, refillPlanned: false })).toBe("conserve");
  });

  it("is normal with enough water or no estimate", () => {
    expect(residentStatus({ openIncident: false, hoursRemaining: 6, refillPlanned: false })).toBe("normal");
    expect(residentStatus({ openIncident: false, hoursRemaining: null, refillPlanned: false })).toBe("normal");
  });
});

describe("incident lifecycle", () => {
  it.each([
    ["open", "acknowledged", true],
    ["acknowledged", "inspecting", true],
    ["acknowledged", "resolved", true],
    ["inspecting", "resolved", true],
    ["open", "resolved", false],
    ["open", "inspecting", false],
    ["inspecting", "acknowledged", false],
    ["resolved", "open", false],
  ] as const)("%s → %s allowed: %s", (from, to, allowed) => {
    expect(canTransition(from, to)).toBe(allowed);
  });

  it("ends at resolved", () => {
    expect(nextStates("resolved")).toEqual([]);
  });

  it("marks incidents high severity when three hours or less remain", () => {
    expect(severityFor(3)).toBe("high");
    expect(severityFor(3.1)).toBe("medium");
    expect(severityFor(null)).toBe("medium");
  });
});
