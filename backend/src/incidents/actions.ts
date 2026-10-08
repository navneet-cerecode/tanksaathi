import { canTransition, RESOLUTIONS, type IncidentState } from "@tanksaathi/core";
import { z } from "zod";

const note = z.string().trim().max(500).optional();

export const ActionRequestSchema = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("acknowledge"), note }),
  z.strictObject({ action: z.literal("inspect"), note }),
  z.strictObject({ action: z.literal("resolve"), resolution: z.enum(RESOLUTIONS), note }),
]);
export type ActionRequest = z.infer<typeof ActionRequestSchema>;

export type Awaiting = "acknowledgement" | "resolution" | null;

export type ActionPlan =
  | { ok: true; from: IncidentState; to: IncidentState; resume: Awaiting }
  | { ok: false; status: 409; error: "invalid-transition" | "workflow-not-ready" };

const TARGET: Record<ActionRequest["action"], IncidentState> = {
  acknowledge: "acknowledged",
  inspect: "inspecting",
  resolve: "resolved",
};

/** Which workflow pause each action resumes; inspection is a note on the record only. */
const RESUMES: Record<ActionRequest["action"], Awaiting> = {
  acknowledge: "acknowledgement",
  inspect: null,
  resolve: "resolution",
};

export function planIncidentAction(
  incident: { status: IncidentState; awaiting: Awaiting },
  request: { action: ActionRequest["action"]; [field: string]: unknown },
): ActionPlan {
  const to = TARGET[request.action];
  if (!canTransition(incident.status, to)) return { ok: false, status: 409, error: "invalid-transition" };
  const resume = RESUMES[request.action];
  if (resume && incident.awaiting !== resume) return { ok: false, status: 409, error: "workflow-not-ready" };
  return { ok: true, from: incident.status, to, resume };
}
