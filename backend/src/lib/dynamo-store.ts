import { ConditionalCheckFailedException, type DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  BatchWriteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  type BatchWriteCommandInput,
  type BatchWriteCommandOutput,
} from "@aws-sdk/lib-dynamodb";
import type { BuildingConfig, RawReading, TankConfig, TankState } from "@tanksaathi/core";
import type { StoredReading, TankContext, TankMeta, TankStore } from "../ingest/process";
import { buildingPk, META_SK, READING_SK_CEILING, readingSk, readingSkFloor, STATE_SK, tankConfigSk, tankPk } from "./keys";

const READING_TTL_S = 7 * 24 * 3600;

export class DynamoTankStore implements TankStore {
  private readonly doc: DynamoDBDocumentClient;

  constructor(client: DynamoDBClient, private readonly table: string) {
    this.doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  }

  async getContext(buildingId: string, tankId: string): Promise<TankContext | null> {
    const [meta, tank] = await Promise.all([
      this.doc.send(new GetCommand({ TableName: this.table, Key: { PK: buildingPk(buildingId), SK: META_SK } })),
      this.doc.send(new GetCommand({ TableName: this.table, Key: { PK: buildingPk(buildingId), SK: tankConfigSk(tankId) } })),
    ]);
    if (!meta.Item || !tank.Item) return null;
    const { forecastMaxC, ...building } = meta.Item.config as BuildingConfig & { forecastMaxC?: number | null };
    return { building, tank: tank.Item.config as TankConfig, forecastMaxC: forecastMaxC ?? null };
  }

  async getMeta(buildingId: string, tankId: string): Promise<TankMeta> {
    const res = await this.doc.send(
      new GetCommand({
        TableName: this.table,
        Key: { PK: tankPk(buildingId, tankId), SK: STATE_SK },
        ProjectionExpression: "lastResolvedAt",
      }),
    );
    return { lastResolvedAt: (res.Item?.lastResolvedAt as number | undefined) ?? null };
  }

  async putReadings(buildingId: string, tankId: string, readings: StoredReading[]): Promise<void> {
    const pk = tankPk(buildingId, tankId);
    for (let i = 0; i < readings.length; i += 25) {
      let requests: BatchWriteCommandInput["RequestItems"] = {
        [this.table]: readings.slice(i, i + 25).map((r) => ({
          PutRequest: {
            Item: { PK: pk, SK: readingSk(r.t, r.seq), ...r, expiresAt: Math.floor(r.t / 1000) + READING_TTL_S },
          },
        })),
      };
      for (let attempt = 0; requests && Object.keys(requests).length > 0; attempt++) {
        if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 50 * 2 ** attempt));
        if (attempt === 6) throw new Error("DynamoDB kept returning unprocessed readings");
        const res: BatchWriteCommandOutput = await this.doc.send(new BatchWriteCommand({ RequestItems: requests }));
        requests = res.UnprocessedItems;
      }
    }
  }

  async recentReadings(buildingId: string, tankId: string, sinceMs: number): Promise<RawReading[]> {
    const out: RawReading[] = [];
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.doc.send(
        new QueryCommand({
          TableName: this.table,
          KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
          ExpressionAttributeValues: { ":pk": tankPk(buildingId, tankId), ":from": readingSkFloor(sinceMs), ":to": READING_SK_CEILING },
          ProjectionExpression: "t, distanceMm",
          ExclusiveStartKey: startKey,
        }),
      );
      for (const item of res.Items ?? []) out.push({ t: item.t as number, distanceMm: item.distanceMm as number });
      startKey = res.LastEvaluatedKey;
    } while (startKey);
    return out;
  }

  /** Never lets an older computation overwrite a newer one. */
  async saveState(buildingId: string, tankId: string, state: TankState, computedAt: number): Promise<void> {
    try {
      await this.doc.send(
        new UpdateCommand({
          TableName: this.table,
          Key: { PK: tankPk(buildingId, tankId), SK: STATE_SK },
          UpdateExpression: "SET #state = :state, computedAt = :computedAt, lastReadingAt = :last",
          ConditionExpression: "attribute_not_exists(lastReadingAt) OR lastReadingAt <= :last",
          ExpressionAttributeNames: { "#state": "state" },
          ExpressionAttributeValues: { ":state": state, ":computedAt": computedAt, ":last": state.lastReadingAt ?? 0 },
        }),
      );
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err;
    }
  }
}
