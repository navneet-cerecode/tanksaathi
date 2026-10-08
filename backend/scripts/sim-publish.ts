// SENSOR SIMULATOR — device runner. Connects to AWS IoT Core over MQTT/TLS
// with the simulator thing's own X.509 certificate (exactly as an ESP32 would)
// and publishes one scenario as a single ordered batch.
// Usage: npx tsx scripts/sim-publish.ts <normal|heat|leak|stale|recovery>
import { readFileSync } from "node:fs";
import mqtt from "mqtt";
import {
  DEMO_BUILDING,
  DEMO_TANK,
  generateScenario,
  SCENARIOS,
  SIM_DEVICE_ID,
  telemetryTopic,
  toTelemetryMessage,
  type ScenarioId,
} from "@tanksaathi/core";

const id = (process.argv[2] ?? "normal") as ScenarioId;
if (!SCENARIOS.includes(id)) throw new Error(`scenario must be one of ${SCENARIOS.join(", ")}`);

const scenario = generateScenario({
  id,
  tank: DEMO_TANK,
  dailyDemandL: DEMO_BUILDING.dailyDemandL,
  utcOffsetMinutes: DEMO_BUILDING.utcOffsetMinutes,
  now: Date.now(),
});
const topic = telemetryTopic("sim", DEMO_TANK.buildingId, DEMO_TANK.tankId);
const message = toTelemetryMessage(SIM_DEVICE_ID, scenario.readings);
const payload = JSON.stringify(message);

const client = mqtt.connect({
  protocol: "mqtts",
  host: readFileSync("certs/endpoint.txt", "utf8").trim(),
  port: 8883,
  clientId: SIM_DEVICE_ID,
  cert: readFileSync("certs/device.cert.pem"),
  key: readFileSync("certs/device.private.key"),
  ca: readFileSync("certs/AmazonRootCA1.pem"),
  reconnectPeriod: 0,
  connectTimeout: 10_000,
});

client.on("error", (err) => {
  console.error("MQTT error:", err.message);
  process.exit(1);
});

client.on("connect", () => {
  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error("publish failed:", err.message);
      process.exit(1);
    }
    console.log(`[Sensor simulator] ${id}: ${message.readings.length} readings, ${payload.length} bytes → ${topic}`);
    console.log(scenario.description);
    client.end();
  });
});
