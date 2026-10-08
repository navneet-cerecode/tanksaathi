export type ResidentStatus = "normal" | "conserve" | "refill-planned" | "incident";

export interface ResidentStatusInput {
  openIncident: boolean;
  hoursRemaining: number | null;
  refillPlanned: boolean;
  conserveBelowHours?: number;
}

/** What residents see. Deliberately coarse: no litres, no incident details. */
export function residentStatus({
  openIncident,
  hoursRemaining,
  refillPlanned,
  conserveBelowHours = 6,
}: ResidentStatusInput): ResidentStatus {
  if (openIncident) return "incident";
  if (refillPlanned) return "refill-planned";
  if (hoursRemaining !== null && hoursRemaining < conserveBelowHours) return "conserve";
  return "normal";
}
