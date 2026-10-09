import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { buildingPk, incidentSk } from "../lib/keys";
import { explain } from "./explain-core";

const logger = new Logger({ serviceName: "explain" });
const metrics = new Metrics({ namespace: "TankSaathi", serviceName: "explain" });
const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } });
const bedrock = new BedrockRuntimeClient({});
const enabled = process.env.BEDROCK_ENABLED === "true";
const modelId = process.env.BEDROCK_MODEL_ID!;

interface Detail {
  incidentId: string;
  buildingId: string;
  buildingName: string;
  utcOffsetMinutes: number;
  detectedAt: number;
  excessLph: number;
  levelPctAtOpen: number | null;
  hoursRemainingAtOpen: number | null;
  severity: "high" | "medium";
}

/** Step Functions task: attach a plain-language EN/HI explanation to the incident. Never decides anything. */
export const handler = async ({ detail }: { detail: Detail }) => {
  const explanation = await explain(detail, {
    enabled,
    invoke: async ({ system, user }) => {
      const res = await bedrock.send(
        new ConverseCommand({
          modelId,
          system: [{ text: system }],
          messages: [{ role: "user", content: [{ text: user }] }],
          inferenceConfig: { maxTokens: 500, temperature: 0.2 },
        }),
      );
      return res.output?.message?.content?.[0]?.text ?? "";
    },
  });
  await doc.send(
    new UpdateCommand({
      TableName: process.env.TABLE_NAME!,
      Key: { PK: buildingPk(detail.buildingId), SK: incidentSk(detail.incidentId) },
      UpdateExpression: "SET explanation = :e",
      ConditionExpression: "attribute_exists(PK)",
      ExpressionAttributeValues: { ":e": explanation },
    }),
  );
  metrics.addMetric(explanation.source === "bedrock" ? "ExplanationsFromBedrock" : "ExplanationsStandard", MetricUnit.Count, 1);
  metrics.publishStoredMetrics();
  logger.info("explanation attached", { incidentId: detail.incidentId, source: explanation.source, bedrockEnabled: enabled });
  return { source: explanation.source };
};
