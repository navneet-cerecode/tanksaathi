import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { DynamoTankStore } from "../lib/dynamo-store";
import { processTelemetry } from "./process";

const logger = new Logger({ serviceName: "ingest" });
const metrics = new Metrics({ namespace: "TankSaathi", serviceName: "ingest" });
const store = new DynamoTankStore(new DynamoDBClient({}), process.env.TABLE_NAME!);

/**
 * Invoked asynchronously by the IoT Rule. Rejections are logged and counted,
 * not thrown: retrying a malformed message can't fix it. Unexpected errors
 * throw, so Lambda retries and then parks the event in the DLQ.
 */
export const handler = async (event: Record<string, unknown>) => {
  const outcome = await processTelemetry(event, store, Date.now());
  try {
    if (!outcome.ok) {
      logger.warn("telemetry rejected", { reason: outcome.reason, topic: event.topic });
      metrics.addMetric("TelemetryRejected", MetricUnit.Count, 1);
      return outcome;
    }
    const { buildingId, tankId, channel, accepted, rejected, state } = outcome;
    logger.info("telemetry stored", {
      buildingId,
      tankId,
      channel,
      accepted,
      rejected,
      levelPct: state.levelPct,
      hoursRemaining: state.projection?.hoursConservative ?? null,
      sustainedLossDetectedAt: state.anomaly.firstDetectedAt,
    });
    metrics.addMetric("ReadingsAccepted", MetricUnit.Count, accepted);
    if (rejected > 0) metrics.addMetric("ReadingsRejected", MetricUnit.Count, rejected);
    return { ok: true, buildingId, tankId, accepted, rejected };
  } finally {
    metrics.publishStoredMetrics();
  }
};
