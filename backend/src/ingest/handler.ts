import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { EventBridgeClient } from "@aws-sdk/client-eventbridge";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import { incidentNotice } from "@tanksaathi/core";
import { openIncidentIfNeeded, type Incident } from "../incidents/open";
import { DynamoTankStore } from "../lib/dynamo-store";
import { publishIncidentOpened } from "../lib/events";
import { DynamoIncidentStore } from "../lib/incident-store";
import { processTelemetry, type TankContext } from "./process";

const logger = new Logger({ serviceName: "ingest" });
const metrics = new Metrics({ namespace: "TankSaathi", serviceName: "ingest" });
const ddb = new DynamoDBClient({});
const eventBridge = new EventBridgeClient({});
const table = process.env.TABLE_NAME!;
const busName = process.env.EVENT_BUS_NAME!;
const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
const store = new DynamoTankStore(ddb, table);
const incidents = new DynamoIncidentStore(ddb, table);

function announcer(context: TankContext) {
  return {
    incidentOpened: (incident: Incident) =>
      publishIncidentOpened(eventBridge, busName, {
        ...incident,
        escalateAfterSeconds: (context.building.escalateAfterMinutes ?? 30) * 60,
        buildingName: context.building.name,
        utcOffsetMinutes: context.building.utcOffsetMinutes,
        notice: incidentNotice({
          buildingName: context.building.name,
          tankName: context.tank.name,
          utcOffsetMinutes: context.building.utcOffsetMinutes,
          detectedAt: incident.detectedAt,
          excessLph: incident.excessLph,
          levelPctAtOpen: incident.levelPctAtOpen,
          hoursRemainingAtOpen: incident.hoursRemainingAtOpen,
          severity: incident.severity,
          simulated: incident.simulated,
          appUrl: `${appUrl}/incidents/${incident.buildingId}/${incident.incidentId}`,
        }),
      }),
  };
}

/**
 * Invoked asynchronously by the IoT Rule. Rejections are logged and counted,
 * not thrown: retrying a malformed message can't fix it. Unexpected errors
 * throw, so Lambda retries and then parks the event in the DLQ.
 */
export const handler = async (event: Record<string, unknown>) => {
  const now = Date.now();
  try {
    const outcome = await processTelemetry(event, store, now);
    if (!outcome.ok) {
      logger.warn("telemetry rejected", { reason: outcome.reason, topic: event.topic });
      metrics.addMetric("TelemetryRejected", MetricUnit.Count, 1);
      return outcome;
    }
    const { buildingId, tankId, channel, accepted, rejected, state, context } = outcome;
    metrics.addMetric("ReadingsAccepted", MetricUnit.Count, accepted);
    if (rejected > 0) metrics.addMetric("ReadingsRejected", MetricUnit.Count, rejected);

    const incident = await openIncidentIfNeeded(
      { buildingId, tankId, channel, state, now },
      { incidents, events: announcer(context) },
    );
    if (incident.action === "opened" || incident.action === "re-sent") metrics.addMetric("IncidentsOpened", MetricUnit.Count, 1);

    logger.info("telemetry stored", {
      buildingId,
      tankId,
      channel,
      accepted,
      rejected,
      levelPct: state.levelPct,
      hoursRemaining: state.projection?.hoursConservative ?? null,
      sustainedLossDetectedAt: state.anomaly.firstDetectedAt,
      incident,
    });
    return { ok: true, buildingId, tankId, accepted, rejected, incident };
  } finally {
    metrics.publishStoredMetrics();
  }
};
