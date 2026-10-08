import { isAuthorized } from "@cedar-policy/cedar-wasm/nodejs";
import policies from "./policies.cedar";

export const ROLES = ["caretaker", "resident", "demo-operator"] as const;
export type Role = (typeof ROLES)[number];

export type Action = "viewStatus" | "viewTank" | "viewIncidents" | "actOnIncident" | "planRefill" | "runScenario" | "resetDemo";

export interface Principal {
  userId: string;
  roles: Role[];
  buildingId: string;
}

export interface Decision {
  allowed: boolean;
  /** @id names of the policies that allowed it. */
  reasons: string[];
}

// Cedar numbers policies from a text set policy0, policy1, ... in file order.
const policyNames = new Map([...policies.matchAll(/@id\("([^"]+)"\)/g)].map((m, i) => [`policy${i}`, m[1]!]));

const building = (id: string) => ({
  uid: { type: "TankSaathi::Building", id },
  attrs: { demo: id.startsWith("demo-") },
  parents: [],
});

export function authorize(principal: Principal, action: Action, buildingId: string): Decision {
  const entities = [
    {
      uid: { type: "TankSaathi::User", id: principal.userId },
      attrs: { roles: principal.roles },
      parents: [{ type: "TankSaathi::Building", id: principal.buildingId }],
    },
    building(principal.buildingId),
    ...(buildingId === principal.buildingId ? [] : [building(buildingId)]),
  ];
  const answer = isAuthorized({
    principal: { type: "TankSaathi::User", id: principal.userId },
    action: { type: "TankSaathi::Action", id: action },
    resource: { type: "TankSaathi::Building", id: buildingId },
    context: {},
    policies: { staticPolicies: policies },
    entities,
  });
  if (answer.type === "failure") {
    throw new Error(`Cedar evaluation failed: ${answer.errors.map((e) => e.message).join("; ")}`);
  }
  return {
    allowed: answer.response.decision === "allow",
    reasons: answer.response.diagnostics.reason.map((id) => policyNames.get(id) ?? id),
  };
}

/** Build the principal from verified Cognito ID-token claims. Null if the token can't act on anything. */
export function principalFromClaims(claims: Record<string, unknown>): Principal | null {
  const userId = claims.sub;
  const buildingId = claims["custom:buildingId"];
  const raw = claims["cognito:groups"];
  // HTTP API flattens array claims into a bracketed, space-separated string.
  const groups = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.replace(/^\[|\]$/g, "").split(/[\s,]+/) : [];
  const roles = groups.filter((g): g is Role => (ROLES as readonly string[]).includes(g));
  if (typeof userId !== "string" || typeof buildingId !== "string" || !buildingId || roles.length === 0) return null;
  return { userId, roles, buildingId };
}
