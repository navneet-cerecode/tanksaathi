import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { IoTDataPlaneClient, PublishCommand } from "@aws-sdk/client-iot-data-plane";
import { SFNClient, SendTaskSuccessCommand, StopExecutionCommand } from "@aws-sdk/client-sfn";
import { Logger } from "@aws-lambda-powertools/logger";
import { Metrics, MetricUnit } from "@aws-lambda-powertools/metrics";
import {
  generateScenario,
  ID_PATTERN,
  SCENARIOS,
  telemetryTopic,
  toTelemetryMessage,
} from "@tanksaathi/core";
import type { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from "aws-lambda";
import { z } from "zod";
import { authorize, principalFromClaims, type Action, type Principal } from "../auth/authz";
import { ActionRequestSchema, planIncidentAction } from "../incidents/actions";
import { DynamoTankStore } from "../lib/dynamo-store";
import { ApiData } from "./data";
import { residentView, tankView } from "./views";

const logger = new Logger({ serviceName: "api" });
const metrics = new Metrics({ namespace: "TankSaathi", serviceName: "api" });
const ddb = new DynamoDBClient({});
const table = process.env.TABLE_NAME!;
const data = new ApiData(ddb, table);
const tankStore = new DynamoTankStore(ddb, table);
const sfn = new SFNClient({});
const iotData = new IoTDataPlaneClient({ endpoint: `https://${process.env.IOT_DATA_ENDPOINT}` });

const HOUR = 3_600_000;
const INCIDENT_ID = /^[a-z0-9-]{3,64}$/;

const json = (statusCode: number, body: unknown): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
  body: JSON.stringify(body),
});

const RefillSchema = z.strictObject({ plannedAt: z.iso.datetime({ offset: true }).nullable() });
const ScenarioSchema = z.strictObject({ scenario: z.enum(SCENARIOS) });

function parseBody(event: APIGatewayProxyEventV2WithJWTAuthorizer): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
  if (raw.length > 4_096) throw new HttpError(413, "body-too-large");
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError(400, "invalid-json");
  }
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code);
  }
}

function requireAllowed(principal: Principal, action: Action, buildingId: string) {
  const decision = authorize(principal, action, buildingId);
  logger.info("authorization", { action, buildingId, userId: principal.userId, allowed: decision.allowed, policies: decision.reasons });
  if (!decision.allowed) {
    metrics.addMetric("AuthorizationDenied", MetricUnit.Count, 1);
    throw new HttpError(403, "forbidden");
  }
}

export const handler = async (event: APIGatewayProxyEventV2WithJWTAuthorizer): Promise<APIGatewayProxyResultV2> => {
  try {
    const principal = principalFromClaims(event.requestContext.authorizer.jwt.claims);
    if (!principal) return json(403, { error: "no-building-or-role" });
    const { buildingId = "", tankId = "", incidentId = "" } = event.pathParameters ?? {};
    if (buildingId && !ID_PATTERN.test(buildingId)) return json(400, { error: "bad-building-id" });
    if (tankId && !ID_PATTERN.test(tankId)) return json(400, { error: "bad-tank-id" });
    if (incidentId && !INCIDENT_ID.test(incidentId)) return json(400, { error: "bad-incident-id" });
    const now = Date.now();

    switch (event.routeKey) {
      case "GET /me":
        return json(200, principal);

      case "GET /buildings/{buildingId}/status": {
        requireAllowed(principal, "viewStatus", buildingId);
        const meta = await data.building(buildingId);
        if (!meta) return json(404, { error: "unknown-building" });
        const [tank] = await data.tanks(buildingId);
        if (!tank) return json(404, { error: "no-tank" });
        const [stateItem, openIncident] = await Promise.all([data.stateItem(buildingId, tank.tankId), data.hasOpenIncident(buildingId, tank.tankId)]);
        return json(
          200,
          residentView({
            building: meta.config,
            state: stateItem?.state ?? null,
            computedAt: stateItem?.computedAt ?? now,
            channel: stateItem?.channel ?? null,
            openIncident,
            refillPlannedAt: meta.refillPlannedAt,
            now,
          }),
        );
      }

      case "GET /buildings/{buildingId}/tanks/{tankId}": {
        requireAllowed(principal, "viewTank", buildingId);
        const [meta, tank, stateItem] = await Promise.all([data.building(buildingId), data.tank(buildingId, tankId), data.stateItem(buildingId, tankId)]);
        if (!meta || !tank) return json(404, { error: "unknown-tank" });
        const readings = await tankStore.recentReadings(buildingId, tankId, now - 24 * HOUR);
        const view = tankView({
          tank,
          building: meta.config,
          readings,
          forecastMaxC: meta.config.forecastMaxC ?? null,
          lastResolvedAt: stateItem?.lastResolvedAt ?? null,
          channel: stateItem?.channel ?? null,
          now,
        });
        return json(200, { ...view, building: { buildingId, name: meta.config.name, utcOffsetMinutes: meta.config.utcOffsetMinutes }, refillPlannedAt: meta.refillPlannedAt });
      }

      case "GET /buildings/{buildingId}/incidents": {
        requireAllowed(principal, "viewIncidents", buildingId);
        const incidents = await data.incidents(buildingId);
        return json(200, { incidents: incidents.map(({ taskToken: _t, ...rest }) => rest) });
      }

      case "GET /buildings/{buildingId}/incidents/{incidentId}": {
        requireAllowed(principal, "viewIncidents", buildingId);
        const incident = await data.incident(buildingId, incidentId);
        if (!incident) return json(404, { error: "unknown-incident" });
        const { taskToken: _t, ...rest } = incident;
        return json(200, rest);
      }

      case "POST /buildings/{buildingId}/incidents/{incidentId}/actions": {
        requireAllowed(principal, "actOnIncident", buildingId);
        const parsed = ActionRequestSchema.safeParse(parseBody(event));
        if (!parsed.success) return json(400, { error: "invalid-action" });
        const request = parsed.data;
        const incident = await data.incident(buildingId, incidentId);
        if (!incident) return json(404, { error: "unknown-incident" });
        const plan = planIncidentAction({ status: incident.status, awaiting: incident.awaiting ?? null }, request);
        if (!plan.ok) return json(plan.status, { error: plan.error });

        const result = await data.applyAction({
          incident,
          from: plan.from,
          to: plan.to,
          now,
          entry: {
            at: now,
            action: request.action,
            actor: "caretaker",
            actorId: principal.userId,
            note: request.note || undefined,
            resolution: request.action === "resolve" ? request.resolution : undefined,
          },
        });
        if (result === "conflict") return json(409, { error: "changed-by-someone-else" });

        let workflow = "not-needed";
        if (plan.resume && incident.taskToken) {
          try {
            await sfn.send(
              new SendTaskSuccessCommand({
                taskToken: incident.taskToken,
                output: JSON.stringify({ action: request.action, resolution: request.action === "resolve" ? request.resolution : null, by: "caretaker" }),
              }),
            );
            workflow = "resumed";
          } catch (err) {
            // The record is the source of truth; a lapsed token only means the workflow already timed out.
            logger.warn("could not resume workflow", { incidentId, error: (err as Error).name });
            workflow = "token-expired";
          }
        }
        metrics.addMetric(`Incident${plan.to[0]!.toUpperCase()}${plan.to.slice(1)}`, MetricUnit.Count, 1);
        logger.info("incident action", { buildingId, incidentId, from: plan.from, to: plan.to, workflow });
        return json(200, { incidentId, status: plan.to, workflow });
      }

      case "PUT /buildings/{buildingId}/refill": {
        requireAllowed(principal, "planRefill", buildingId);
        const parsed = RefillSchema.safeParse(parseBody(event));
        if (!parsed.success) return json(400, { error: "invalid-refill" });
        const plannedAt = parsed.data.plannedAt === null ? null : Date.parse(parsed.data.plannedAt);
        if (plannedAt !== null && (plannedAt < now - HOUR || plannedAt > now + 72 * HOUR)) return json(400, { error: "refill-out-of-range" });
        await data.setRefillPlan(buildingId, plannedAt);
        return json(200, { refillPlannedAt: plannedAt });
      }

      case "POST /buildings/{buildingId}/demo/scenarios": {
        requireAllowed(principal, "runScenario", buildingId);
        const parsed = ScenarioSchema.safeParse(parseBody(event));
        if (!parsed.success) return json(400, { error: "invalid-scenario" });
        const [meta, tanks] = await Promise.all([data.building(buildingId), data.tanks(buildingId)]);
        const tank = tanks[0];
        if (!meta || !tank) return json(404, { error: "unknown-building" });
        const claim = await data.claimDemoRun(buildingId, now, 20_000, 60);
        if (claim !== "ok") return json(429, { error: claim });

        const scenario = generateScenario({
          id: parsed.data.scenario,
          tank,
          dailyDemandL: meta.config.dailyDemandL,
          utcOffsetMinutes: meta.config.utcOffsetMinutes,
          now,
        });
        await data.setForecast(buildingId, scenario.forecastMaxC);
        const deviceId = `sim-${buildingId}-${tank.tankId}`;
        await iotData.send(
          new PublishCommand({
            topic: telemetryTopic("sim", buildingId, tank.tankId),
            qos: 1,
            payload: new TextEncoder().encode(JSON.stringify(toTelemetryMessage(deviceId, scenario.readings))),
          }),
        );
        metrics.addMetric("SimulatorRuns", MetricUnit.Count, 1);
        logger.info("simulator scenario published", { buildingId, scenario: scenario.id, readings: scenario.readings.length });
        return json(202, { scenario: scenario.id, readings: scenario.readings.length, forecastMaxC: scenario.forecastMaxC, description: scenario.description, simulated: true });
      }

      case "POST /buildings/{buildingId}/demo/reset": {
        requireAllowed(principal, "resetDemo", buildingId);
        const tanks = await data.tanks(buildingId);
        const { removed, executions } = await data.resetDemo(buildingId, tanks.map((t) => t.tankId));
        for (const executionArn of executions) {
          await sfn.send(new StopExecutionCommand({ executionArn, cause: "Demo reset" })).catch(() => undefined);
        }
        logger.info("demo reset", { buildingId, removed, stoppedWorkflows: executions.length });
        return json(200, { removed, stoppedWorkflows: executions.length });
      }

      default:
        return json(404, { error: "no-route" });
    }
  } catch (err) {
    if (err instanceof HttpError) return json(err.status, { error: err.code });
    logger.error("unhandled", { error: err as Error });
    return json(500, { error: "internal" });
  } finally {
    metrics.publishStoredMetrics();
  }
};
