import { describe, expect, it } from "vitest";
import { ExplanationSchema, standardExplanation } from "../src/explain";

const facts = {
  buildingName: "Demo Hostel Block A",
  utcOffsetMinutes: 330,
  detectedAt: Date.UTC(2026, 9, 7, 20, 20), // 01:50 IST
  excessLph: 218.6,
  levelPctAtOpen: 27.4,
  hoursRemainingAtOpen: 4.04,
  severity: "medium" as const,
};

describe("standardExplanation", () => {
  it("explains the finding in English with the key numbers", () => {
    const e = standardExplanation(facts);
    expect(e.source).toBe("standard");
    expect(e.en).toContain("01:50 IST");
    expect(e.en).toContain("220 L/h");
    expect(e.en).toContain("about 4 hours");
  });

  it("explains it in Hindi with the same numbers", () => {
    const e = standardExplanation(facts);
    expect(e.hi).toContain("01:50");
    expect(e.hi).toContain("220");
    expect(/[ऀ-ॿ]/.test(e.hi)).toBe(true);
  });

  it("gives a short, concrete checklist", () => {
    const e = standardExplanation(facts);
    expect(e.checklist.length).toBeGreaterThanOrEqual(3);
    expect(e.checklist.length).toBeLessThanOrEqual(5);
  });

  it("produces something the schema accepts", () => {
    expect(ExplanationSchema.safeParse(standardExplanation(facts)).success).toBe(true);
  });
});

describe("ExplanationSchema", () => {
  it("rejects model output that is too long or carries markup", () => {
    const ok = standardExplanation(facts);
    expect(ExplanationSchema.safeParse({ ...ok, en: "x".repeat(601) }).success).toBe(false);
    expect(ExplanationSchema.safeParse({ ...ok, en: "<script>alert(1)</script>" }).success).toBe(false);
    expect(ExplanationSchema.safeParse({ ...ok, checklist: [] }).success).toBe(false);
  });
});
