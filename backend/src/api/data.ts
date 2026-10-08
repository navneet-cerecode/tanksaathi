import { TransactionCanceledException, type DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { BuildingConfig, Channel, IncidentState, Resolution, TankConfig, TankState } from "@tanksaathi/core";
import type { Awaiting } from "../incidents/actions";
import type { Incident } from "../incidents/open";
import { buildingPk, incidentSk, META_SK, openLockSk, STATE_SK, tankConfigSk, tankPk } from "../lib/keys";

export interface BuildingMeta {
  config: BuildingConfig & { forecastMaxC?: number | null };
  refillPlannedAt: number | null;
}

export interface StateItem {
  state: TankState | null;
  computedAt: number;
  channel: Channel | null;
  lastResolvedAt: number | null;
}

export interface TimelineEntry {
  at: number;
  action: string;
  actor: string;
  actorId?: string;
  note?: string;
  resolution?: Resolution;
}

export interface IncidentRecord extends Incident {
  timeline: TimelineEntry[];
  awaiting: Awaiting;
  taskToken?: string;
  workflowExecution?: string;
  workflowClosedAt?: string;
  resolution?: Resolution;
  resolvedAt?: number;
}

export class ApiData {
  readonly doc: DynamoDBDocumentClient;

  constructor(client: DynamoDBClient, readonly table: string) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  private async get(PK: string, SK: string) {
    return (await this.doc.send(new GetCommand({ TableName: this.table, Key: { PK, SK }, ConsistentRead: true }))).Item;
  }

  async building(buildingId: string): Promise<BuildingMeta | null> {
    const item = await this.get(buildingPk(buildingId), META_SK);
    return item ? { config: item.config, refillPlannedAt: item.refillPlannedAt ?? null } : null;
  }

  async tank(buildingId: string, tankId: string): Promise<TankConfig | null> {
    return ((await this.get(buildingPk(buildingId), tankConfigSk(tankId)))?.config as TankConfig | undefined) ?? null;
  }

  async tanks(buildingId: string): Promise<TankConfig[]> {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": buildingPk(buildingId), ":sk": "TANK#" },
      }),
    );
    return (res.Items ?? []).map((i) => i.config as TankConfig);
  }

  async stateItem(buildingId: string, tankId: string): Promise<StateItem | null> {
    const item = await this.get(tankPk(buildingId, tankId), STATE_SK);
    if (!item) return null;
    return { state: item.state ?? null, computedAt: item.computedAt ?? 0, channel: item.channel ?? null, lastResolvedAt: item.lastResolvedAt ?? null };
  }

  async hasOpenIncident(buildingId: string, tankId: string): Promise<boolean> {
    return Boolean(await this.get(tankPk(buildingId, tankId), openLockSk("sustained-loss")));
  }

  async incidents(buildingId: string): Promise<IncidentRecord[]> {
    const res = await this.doc.send(
      new QueryCommand({
        TableName: this.table,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
        ExpressionAttributeValues: { ":pk": buildingPk(buildingId), ":sk": "INCIDENT#" },
      }),
    );
    return ((res.Items ?? []) as IncidentRecord[]).sort((a, b) => b.openedAt - a.openedAt).slice(0, 20);
  }

  async incident(buildingId: string, incidentId: string): Promise<IncidentRecord | null> {
    return ((await this.get(buildingPk(buildingId), incidentSk(incidentId))) as IncidentRecord | undefined) ?? null;
  }

  /** Moves the incident on only if nobody else moved it first. Resolving also frees the tank's open lock. */
  async applyAction(input: {
    incident: IncidentRecord;
    from: IncidentState;
    to: IncidentState;
    entry: TimelineEntry;
    now: number;
  }): Promise<"applied" | "conflict"> {
    const { incident, from, to, entry, now } = input;
    const key = { PK: buildingPk(incident.buildingId), SK: incidentSk(incident.incidentId) };
    const set = ["#status = :to", "updatedAt = :now", "timeline = list_append(timeline, :entry)"];
    const values: Record<string, unknown> = { ":to": to, ":from": from, ":now": now, ":entry": [entry] };
    if (to === "acknowledged") set.push("acknowledgedAt = :now");
    if (to === "resolved") {
      set.push("resolvedAt = :now", "resolution = :resolution");
      values[":resolution"] = entry.resolution;
    }
    const update = {
      TableName: this.table,
      Key: key,
      UpdateExpression: `SET ${set.join(", ")}`,
      ConditionExpression: "#status = :from",
      ExpressionAttributeNames: { "#status": "status" },
      ExpressionAttributeValues: values,
    };
    try {
      if (to !== "resolved") {
        await this.doc.send(new UpdateCommand(update));
      } else {
        await this.doc.send(
          new TransactWriteCommand({
            TransactItems: [
              { Update: update },
              {
                Delete: {
                  TableName: this.table,
                  Key: { PK: tankPk(incident.buildingId, incident.tankId), SK: openLockSk(incident.type) },
                  ConditionExpression: "incidentId = :id",
                  ExpressionAttributeValues: { ":id": incident.incidentId },
                },
              },
              {
                Update: {
                  TableName: this.table,
                  Key: { PK: tankPk(incident.buildingId, incident.tankId), SK: STATE_SK },
                  UpdateExpression: "SET lastResolvedAt = :now",
                  ExpressionAttributeValues: { ":now": now },
                },
              },
            ],
          }),
        );
      }
      return "applied";
    } catch (err) {
      if (err instanceof TransactionCanceledException || (err as Error).name === "ConditionalCheckFailedException") return "conflict";
      throw err;
    }
  }

  async setRefillPlan(buildingId: string, plannedAt: number | null) {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { PK: buildingPk(buildingId), SK: META_SK },
        UpdateExpression: plannedAt === null ? "REMOVE refillPlannedAt" : "SET refillPlannedAt = :t",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: plannedAt === null ? undefined : { ":t": plannedAt },
      }),
    );
  }

  async setForecast(buildingId: string, forecastMaxC: number) {
    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { PK: buildingPk(buildingId), SK: META_SK },
        UpdateExpression: "SET config.forecastMaxC = :f",
        ConditionExpression: "attribute_exists(PK)",
        ExpressionAttributeValues: { ":f": forecastMaxC },
      }),
    );
  }

  /**
   * Cost guard for the simulator: one run per `minGapMs` and at most
   * `maxPerDay` per building per UTC day. Optimistic: a concurrent run loses.
   */
  async claimDemoRun(buildingId: string, now: number, minGapMs: number, maxPerDay: number): Promise<"ok" | "too-soon" | "daily-limit"> {
    const key = { PK: buildingPk(buildingId), SK: "DEMO#rate" };
    const item = await this.get(key.PK, key.SK);
    const day = new Date(now).toISOString().slice(0, 10);
    if (item && now - item.lastRunAt < minGapMs) return "too-soon";
    const runs = item?.day === day ? item.runs : 0;
    if (runs >= maxPerDay) return "daily-limit";
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.table,
          Key: key,
          UpdateExpression: "SET lastRunAt = :now, #day = :day, runs = :runs",
          ConditionExpression: item ? "lastRunAt = :prev" : "attribute_not_exists(PK)",
          ExpressionAttributeNames: { "#day": "day" },
          ExpressionAttributeValues: { ":now": now, ":day": day, ":runs": runs + 1, ...(item ? { ":prev": item.lastRunAt } : {}) },
        }),
      );
      return "ok";
    } catch (err) {
      if ((err as Error).name === "ConditionalCheckFailedException") return "too-soon";
      throw err;
    }
  }

  /** Removes a demo building's readings, state, locks and incidents. Returns the running workflows to stop. */
  async resetDemo(buildingId: string, tankIds: string[]): Promise<{ removed: number; executions: string[] }> {
    if (!buildingId.startsWith("demo-")) throw new Error("reset only touches demo buildings");
    const incidents = await this.incidents(buildingId);
    const executions = incidents.filter((i) => i.workflowExecution && !i.workflowClosedAt).map((i) => i.workflowExecution!);
    let removed = 0;
    const targets: Array<[string, string | null]> = [
      ...tankIds.map((t): [string, string | null] => [tankPk(buildingId, t), null]),
      [buildingPk(buildingId), "INCIDENT#"],
    ];
    for (const [pk, prefix] of targets) {
      let startKey: Record<string, unknown> | undefined;
      do {
        const page = await this.doc.send(
          new QueryCommand({
            TableName: this.table,
            KeyConditionExpression: prefix ? "PK = :pk AND begins_with(SK, :sk)" : "PK = :pk",
            ExpressionAttributeValues: prefix ? { ":pk": pk, ":sk": prefix } : { ":pk": pk },
            ProjectionExpression: "PK, SK",
            ExclusiveStartKey: startKey,
          }),
        );
        const keys = page.Items ?? [];
        for (let i = 0; i < keys.length; i += 25) {
          await this.doc.send(new BatchWriteCommand({ RequestItems: { [this.table]: keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } })) } }));
        }
        removed += keys.length;
        startKey = page.LastEvaluatedKey;
      } while (startKey);
    }
    await this.doc.send(
      new UpdateCommand({
        TableName: this.table,
        Key: { PK: buildingPk(buildingId), SK: META_SK },
        UpdateExpression: "SET config.forecastMaxC = :f REMOVE refillPlannedAt",
        ExpressionAttributeValues: { ":f": 33 },
      }),
    );
    return { removed, executions };
  }
}
