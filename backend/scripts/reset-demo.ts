// Deletes every reading, state, lock and incident for one demo building's tank,
// then re-seeds its config. Refuses anything that isn't a demo building.
// Usage: npx tsx scripts/reset-demo.ts [buildingId] [tableName]
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { BatchWriteCommand, DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { buildingPk, tankPk } from "../src/lib/keys";

const buildingId = process.argv[2] ?? "demo-hostel-a";
const table = process.argv[3] ?? "tanksaathi-dev";
if (!buildingId.startsWith("demo-")) throw new Error("reset only touches demo buildings");

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-south-1" }));

async function deleteWhere(pk: string, skPrefix: string) {
  let deleted = 0;
  let startKey: Record<string, unknown> | undefined;
  do {
    const page = await doc.send(
      new QueryCommand({
        TableName: table,
        KeyConditionExpression: skPrefix ? "PK = :pk AND begins_with(SK, :sk)" : "PK = :pk",
        ExpressionAttributeValues: skPrefix ? { ":pk": pk, ":sk": skPrefix } : { ":pk": pk },
        ProjectionExpression: "PK, SK",
        ExclusiveStartKey: startKey,
      }),
    );
    const keys = page.Items ?? [];
    for (let i = 0; i < keys.length; i += 25) {
      await doc.send(
        new BatchWriteCommand({
          RequestItems: { [table]: keys.slice(i, i + 25).map((Key) => ({ DeleteRequest: { Key } })) },
        }),
      );
    }
    deleted += keys.length;
    startKey = page.LastEvaluatedKey;
  } while (startKey);
  return deleted;
}

const tankItems = await deleteWhere(tankPk(buildingId, "roof-1"), "");
const incidents = await deleteWhere(buildingPk(buildingId), "INCIDENT#");
console.log(`reset ${buildingId}: removed ${tankItems} tank items and ${incidents} incidents`);
