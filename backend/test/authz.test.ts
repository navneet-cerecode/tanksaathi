import { describe, expect, it } from "vitest";
import { authorize, principalFromClaims, type Action, type Principal } from "../src/auth/authz";

const resident: Principal = { userId: "u-res", roles: ["resident"], buildingId: "demo-hostel-a" };
const caretaker: Principal = { userId: "u-care", roles: ["caretaker"], buildingId: "demo-hostel-a" };
const operator: Principal = { userId: "u-op", roles: ["caretaker", "demo-operator"], buildingId: "demo-hostel-a" };
const realOperator: Principal = { userId: "u-op2", roles: ["demo-operator"], buildingId: "real-hostel" };

const caretakerActions: Action[] = ["viewTank", "viewIncidents", "actOnIncident", "planRefill"];

describe("authorize (Cedar policies)", () => {
  it("lets residents see only their own building's simplified status", () => {
    expect(authorize(resident, "viewStatus", "demo-hostel-a").allowed).toBe(true);
    expect(authorize(resident, "viewStatus", "demo-hostel-b").allowed).toBe(false);
  });

  it.each(caretakerActions)("keeps residents away from %s", (action) => {
    expect(authorize(resident, action, "demo-hostel-a").allowed).toBe(false);
  });

  it.each(caretakerActions)("lets a caretaker %s in their own building only", (action) => {
    expect(authorize(caretaker, action, "demo-hostel-a").allowed).toBe(true);
    expect(authorize(caretaker, action, "demo-hostel-b").allowed).toBe(false);
  });

  it("lets caretakers see the resident status too", () => {
    expect(authorize(caretaker, "viewStatus", "demo-hostel-a").allowed).toBe(true);
  });

  it("keeps the simulator controls from ordinary caretakers", () => {
    expect(authorize(caretaker, "runScenario", "demo-hostel-a").allowed).toBe(false);
    expect(authorize(caretaker, "resetDemo", "demo-hostel-a").allowed).toBe(false);
  });

  it("lets the demo operator drive the simulator on their demo building", () => {
    expect(authorize(operator, "runScenario", "demo-hostel-a").allowed).toBe(true);
    expect(authorize(operator, "resetDemo", "demo-hostel-a").allowed).toBe(true);
    expect(authorize(operator, "runScenario", "demo-hostel-b").allowed).toBe(false);
  });

  it("never runs the simulator against a building that isn't a demo", () => {
    expect(authorize(realOperator, "runScenario", "real-hostel").allowed).toBe(false);
  });

  it("names the policy that allowed a request", () => {
    expect(authorize(caretaker, "actOnIncident", "demo-hostel-a").reasons).toEqual(["caretaker-own-building"]);
  });
});

describe("principalFromClaims", () => {
  it("reads HTTP API's bracketed group string", () => {
    expect(
      principalFromClaims({ sub: "u1", "cognito:groups": "[caretaker demo-operator]", "custom:buildingId": "demo-hostel-a" }),
    ).toEqual({ userId: "u1", roles: ["caretaker", "demo-operator"], buildingId: "demo-hostel-a" });
  });

  it("reads a group array and ignores unknown groups", () => {
    expect(principalFromClaims({ sub: "u1", "cognito:groups": ["resident", "admins"], "custom:buildingId": "demo-hostel-a" })?.roles).toEqual([
      "resident",
    ]);
  });

  it("rejects tokens without a building or a known role", () => {
    expect(principalFromClaims({ sub: "u1", "cognito:groups": "[caretaker]" })).toBeNull();
    expect(principalFromClaims({ sub: "u1", "cognito:groups": "[admins]", "custom:buildingId": "demo-hostel-a" })).toBeNull();
    expect(principalFromClaims({ sub: "u1", "custom:buildingId": "demo-hostel-a" })).toBeNull();
  });
});
