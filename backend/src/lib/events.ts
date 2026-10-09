import { PutEventsCommand, type EventBridgeClient } from "@aws-sdk/client-eventbridge";
import type { Notice } from "@tanksaathi/core";
import type { Incident } from "../incidents/open";

export const EVENT_SOURCE = "tanksaathi.ingest";

export interface IncidentOpenedDetail extends Incident {
  notice: Notice;
  escalateAfterSeconds: number;
  buildingName: string;
  utcOffsetMinutes: number;
}

export async function publishIncidentOpened(client: EventBridgeClient, busName: string, detail: IncidentOpenedDetail) {
  const res = await client.send(
    new PutEventsCommand({
      Entries: [{ EventBusName: busName, Source: EVENT_SOURCE, DetailType: "IncidentOpened", Detail: JSON.stringify(detail) }],
    }),
  );
  if (res.FailedEntryCount) {
    throw new Error(`EventBridge rejected IncidentOpened: ${res.Entries?.[0]?.ErrorCode ?? "unknown"}`);
  }
}
