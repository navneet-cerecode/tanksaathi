import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { buildingPk, incidentSk } from "../lib/keys";

const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const table = process.env.TABLE_NAME!;

const Input = z.strictObject({
  buildingId: z.string().min(1),
  incidentId: z.string().min(1),
  awaiting: z.enum(["acknowledgement", "resolution"]),
  taskToken: z.string().min(1),
});

/**
 * Called by the state machine with .waitForTaskToken. Parks the token on the
 * incident so the caretaker's API action can resume the workflow.
 */
export const handler = async (event: unknown) => {
  const { buildingId, incidentId, awaiting, taskToken } = Input.parse(event);
  await doc.send(
    new UpdateCommand({
      TableName: table,
      Key: { PK: buildingPk(buildingId), SK: incidentSk(incidentId) },
      UpdateExpression: "SET taskToken = :token, awaiting = :awaiting, awaitingSince = :now",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: { ":token": taskToken, ":awaiting": awaiting, ":now": Date.now() },
    }),
  );
  return { registered: awaiting };
};
