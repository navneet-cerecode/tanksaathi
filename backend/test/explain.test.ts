import { describe, expect, it } from "vitest";
import { buildPrompt, explain } from "../src/workflow/explain-core";

const facts = {
  buildingName: "Demo Hostel Block A",
  utcOffsetMinutes: 330,
  detectedAt: Date.UTC(2026, 9, 7, 20, 20),
  excessLph: 218.6,
  levelPctAtOpen: 27.4,
  hoursRemainingAtOpen: 4.04,
  severity: "medium" as const,
};

const good = JSON.stringify({
  en: "Since 01:50 IST the tank has lost about 220 L/h more than usual.",
  hi: "01:50 बजे से टंकी से लगभग 220 लीटर प्रति घंटा ज़्यादा पानी कम हो रहा है।",
  checklist: ["Check the overflow pipe", "Check the float valve", "Check cisterns"],
});

describe("explain", () => {
  it("uses the model's text when it is valid", async () => {
    const e = await explain(facts, { enabled: true, invoke: async () => good });
    expect(e.source).toBe("bedrock");
    expect(e.checklist).toHaveLength(3);
  });

  it("accepts JSON wrapped in a code fence", async () => {
    const e = await explain(facts, { enabled: true, invoke: async () => "```json\n" + good + "\n```" });
    expect(e.source).toBe("bedrock");
  });

  it.each([
    ["not JSON", async () => "Sure! Here's an explanation."],
    ["markup", async () => good.replace("Since", "<b>Since</b>")],
    ["missing checklist", async () => JSON.stringify({ en: "a", hi: "b" })],
    ["a model error", async () => Promise.reject(new Error("throttled"))],
  ])("falls back to the standard text on %s", async (_label, invoke) => {
    const e = await explain(facts, { enabled: true, invoke });
    expect(e.source).toBe("standard");
  });

  it("never calls the model when disabled", async () => {
    let called = false;
    const e = await explain(facts, { enabled: false, invoke: async () => ((called = true), good) });
    expect(called).toBe(false);
    expect(e.source).toBe("standard");
  });
});

describe("buildPrompt", () => {
  it("sends only structured facts, with the decision already made", () => {
    const prompt = buildPrompt(facts);
    expect(prompt.user).toContain('"excessLph":220');
    expect(prompt.system).toMatch(/do not decide whether there is a leak/i);
    expect(prompt.system).toMatch(/JSON/);
  });
});
