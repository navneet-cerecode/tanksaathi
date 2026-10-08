// Security check: the simulator's certificate must NOT be able to publish
// telemetry for another building, or on the real-device channel.
// IoT Core answers an unauthorised publish by closing the connection.
// Usage: npx tsx scripts/check-topic-isolation.ts
import { readFileSync } from "node:fs";
import mqtt from "mqtt";
import { SIM_DEVICE_ID, telemetryTopic, toTelemetryMessage } from "@tanksaathi/core";

const forbidden = [
  telemetryTopic("sim", "demo-hostel-b", "roof-1"),
  telemetryTopic("dev", "demo-hostel-a", "roof-1"),
];

function attempt(topic: string): Promise<"denied" | "allowed"> {
  return new Promise((resolve) => {
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
    const payload = JSON.stringify(toTelemetryMessage(SIM_DEVICE_ID, [{ t: Date.now(), distanceMm: 900 }]));
    let settled = false;
    const done = (r: "denied" | "allowed") => {
      if (settled) return;
      settled = true;
      client.end(true);
      resolve(r);
    };
    client.on("close", () => done("denied"));
    client.on("error", () => done("denied"));
    client.on("connect", () => {
      client.publish(topic, payload, { qos: 1 }, (err) => done(err ? "denied" : "allowed"));
      setTimeout(() => done("denied"), 8_000);
    });
  });
}

let failed = false;
for (const topic of forbidden) {
  const result = await attempt(topic);
  console.log(`${result === "denied" ? "PASS" : "FAIL"}  ${result}: ${topic}`);
  if (result !== "denied") failed = true;
}
process.exit(failed ? 1 : 0);
