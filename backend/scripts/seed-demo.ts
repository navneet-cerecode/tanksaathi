// Writes the fictional demo buildings and tanks into the table.
// Usage: npx tsx scripts/seed-demo.ts [tableName]
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { DEMO_BUILDING, DEMO_TANK, ISOLATION_BUILDING, ISOLATION_TANK } from "@tanksaathi/core";
import { buildingPk, META_SK, tankConfigSk } from "../src/lib/keys";

const table = process.argv[2] ?? "tanksaathi-dev";
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "ap-south-1" }));

for (const [building, tank] of [
  [DEMO_BUILDING, DEMO_TANK],
  [ISOLATION_BUILDING, ISOLATION_TANK],
] as const) {
  await doc.send(
    new PutCommand({
      TableName: table,
      Item: { PK: buildingPk(building.buildingId), SK: META_SK, config: { ...building, forecastMaxC: 33 } },
    }),
  );
  await doc.send(
    new PutCommand({ TableName: table, Item: { PK: buildingPk(building.buildingId), SK: tankConfigSk(tank.tankId), config: tank } }),
  );
  console.log(`seeded ${building.buildingId}/${tank.tankId}`);
}
