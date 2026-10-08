import { describe, expect, it } from "vitest";
import { ActionRequestSchema, planIncidentAction } from "../src/incidents/actions";

describe("ActionRequestSchema", () => {
  it("requires a known resolution when resolving", () => {
    expect(ActionRequestSchema.safeParse({ action: "resolve" }).success).toBe(false);
    expect(ActionRequestSchema.safeParse({ action: "resolve", resolution: "magic" }).success).toBe(false);
    expect(ActionRequestSchema.safeParse({ action: "resolve", resolution: "leak-fixed" }).success).toBe(true);
  });

  it("caps notes and rejects unknown fields", () => {
    expect(ActionRequestSchema.safeParse({ action: "inspect", note: "x".repeat(501) }).success).toBe(false);
    expect(ActionRequestSchema.safeParse({ action: "acknowledge", status: "resolved" }).success).toBe(false);
  });
});

describe("planIncidentAction", () => {
  it("acknowledges an open incident and resumes the paused workflow", () => {
    expect(planIncidentAction({ status: "open", awaiting: "acknowledgement" }, { action: "acknowledge" })).toEqual({
      ok: true,
      from: "open",
      to: "acknowledged",
      resume: "acknowledgement",
    });
  });

  it("asks the caller to retry if the workflow hasn't parked its token yet", () => {
    expect(planIncidentAction({ status: "open", awaiting: null }, { action: "acknowledge" })).toEqual({
      ok: false,
      status: 409,
      error: "workflow-not-ready",
    });
  });

  it("records inspection without touching the workflow", () => {
    expect(planIncidentAction({ status: "acknowledged", awaiting: "resolution" }, { action: "inspect" })).toMatchObject({
      ok: true,
      to: "inspecting",
      resume: null,
    });
  });

  it.each(["acknowledged", "inspecting"] as const)("resolves from %s and resumes the workflow", (status) => {
    expect(
      planIncidentAction({ status, awaiting: "resolution" }, { action: "resolve", resolution: "leak-fixed" }),
    ).toMatchObject({ ok: true, to: "resolved", resume: "resolution" });
  });

  it.each([
    ["open", { action: "resolve", resolution: "leak-fixed" }],
    ["open", { action: "inspect" }],
    ["inspecting", { action: "acknowledge" }],
    ["resolved", { action: "acknowledge" }],
  ] as const)("refuses an illegal step from %s", (status, request) => {
    expect(planIncidentAction({ status, awaiting: null }, request)).toEqual({
      ok: false,
      status: 409,
      error: "invalid-transition",
    });
  });
});
