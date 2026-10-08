import { TransactionCanceledException, type DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, TransactWriteCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import type { Incident, IncidentStore, OpenLock } from "../incidents/open";
import { buildingPk, incidentSk, openLockSk, tankPk } from "./keys";

export class DynamoIncidentStore implements IncidentStore {
  private readonly doc: DynamoDBDocumentClient;

  constructor(client: DynamoDBClient, private readonly table: string) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async getOpenLock(buildingId: string, tankId: string): Promise<OpenLock | null> {
    const res = await this.doc.send(
      new GetCommand({ TableName: this.table, Key: { PK: tankPk(buildingId, tankId), SK: openLockSk("sustained-loss") }, ConsistentRead: true }),
    );
    if (!res.Item) return null;
    return { incidentId: res.Item.incidentId as string, eventSentAt: (res.Item.eventSentAt as number | undefined) ?? null };
  }

  async createIncident(incident: Incident): Promise<"created" | "exists"> {
    try {
      await this.doc.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Put: {
                TableName: this.table,
                Item: {
                  PK: tankPk(incident.buildingId, incident.tankId),
                  SK: openLockSk(incident.type),
                  incidentId: incident.incidentId,
                  openedAt: incident.openedAt,
                },
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
            {
              Put: {
                TableName: this.table,
                Item: {
                  PK: buildingPk(incident.buildingId),
                  SK: incidentSk(incident.incidentId),
                  ...incident,
                  timeline: [{ at: incident.openedAt, action: "opened", actor: "TankSaathi" }],
                },
                ConditionExpression: "attribute_not_exists(PK)",
              },
            },
          ],
        }),
      );
      return "created";
    } catch (err) {
      if (err instanceof TransactionCanceledException) return "exists";
      throw err;
    }
  }

  async markEventSent(buildingId: string, tankId: string, incidentId: string, at: number): Promise<void> {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { PK: tankPk(buildingId, tankId), SK: openLockSk("sustained-loss") },
        UpdateExpression: "SET eventSentAt = :at",
        ConditionExpression: "incidentId = :id",
        ExpressionAttributeValues: { ":at": at, ":id": incidentId },
      }),
    );
  }
}
