import { z } from "zod";

/** Building and tank ids: lowercase, digits, inner hyphens. Safe in MQTT topics and DynamoDB keys. */
export const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;
const DEVICE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{2,63}$/;

export const MAX_BATCH = 120;

export const TelemetryReadingSchema = z.strictObject({
  /** Monotonic per device; (deviceId, seq) is the dedupe key. */
  seq: z.int().nonnegative(),
  measuredAt: z.iso.datetime({ offset: true }),
  /** Raw sensor-to-surface distance, as an ESP32 + ultrasonic sensor would report it. */
  distanceMm: z.int().min(0).max(20_000),
});

/**
 * One MQTT message. A batch lets a device that lost connectivity upload its
 * buffer in order. Building, tank and source are deliberately absent: they
 * come from the topic, which the IoT policy pins to the device's identity.
 */
export const TelemetryMessageSchema = z.strictObject({
  v: z.literal(1),
  deviceId: z.string().regex(DEVICE_ID_PATTERN),
  readings: z.array(TelemetryReadingSchema).min(1).max(MAX_BATCH),
});

export type TelemetryReading = z.infer<typeof TelemetryReadingSchema>;
export type TelemetryMessage = z.infer<typeof TelemetryMessageSchema>;

export type Channel = "sim" | "dev";

export interface TelemetryTopic {
  channel: Channel;
  buildingId: string;
  tankId: string;
}

export function telemetryTopic(channel: Channel, buildingId: string, tankId: string): string {
  return `tanksaathi/v1/${channel}/${buildingId}/${tankId}/reading`;
}

export function parseTelemetryTopic(topic: string): TelemetryTopic | null {
  const parts = topic.split("/");
  if (parts.length !== 6) return null;
  const [root, version, channel, buildingId, tankId, leaf] = parts as [string, string, string, string, string, string];
  if (root !== "tanksaathi" || version !== "v1" || leaf !== "reading") return null;
  if (channel !== "sim" && channel !== "dev") return null;
  if (!ID_PATTERN.test(buildingId) || !ID_PATTERN.test(tankId)) return null;
  return { channel, buildingId, tankId };
}
