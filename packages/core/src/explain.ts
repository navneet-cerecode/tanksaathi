import { z } from "zod";
import type { Severity } from "./incident";
import { formatHours, formatLocalTime } from "./notice";

export interface ExplainFacts {
  buildingName: string;
  utcOffsetMinutes: number;
  detectedAt: number;
  excessLph: number;
  levelPctAtOpen: number | null;
  hoursRemainingAtOpen: number | null;
  severity: Severity;
}

const plain = z
  .string()
  .trim()
  .min(1)
  .max(600)
  .refine((s) => !/[<>]/.test(s), "no markup");

/** Shape every explanation must have, whether templated or model-written. */
export const ExplanationSchema = z.strictObject({
  source: z.enum(["standard", "bedrock"]),
  en: plain,
  hi: plain,
  checklist: z.array(plain.pipe(z.string().max(160))).min(3).max(5),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

const HOURS_HI = (h: number | null) => {
  if (h === null) return "पता नहीं";
  if (h >= 72) return "3 दिन से ज़्यादा";
  if (h < 1) return "1 घंटे से कम";
  return `लगभग ${Math.round(h)} घंटे`;
};

/** Deterministic explanation, always available. Hindi needs native review (ASSUMPTIONS.md A12). */
export function standardExplanation(f: ExplainFacts): Explanation {
  const at = formatLocalTime(f.detectedAt, f.utcOffsetMinutes);
  const hhmm = at.slice(0, 5);
  const excess = Math.round(f.excessLph / 10) * 10;
  const level = f.levelPctAtOpen === null ? null : Math.round(f.levelPctAtOpen);
  return {
    source: "standard",
    en:
      `Since ${at} the roof tank at ${f.buildingName} has been losing about ${excess} L/h more than the building normally uses at that hour, ` +
      `for at least 45 minutes in a row. ` +
      (level === null ? "" : `It was at ${level}% with ${formatHours(f.hoursRemainingAtOpen)} of water left if nothing changes. `) +
      `This pattern usually means water is escaping rather than being used.`,
    hi:
      `${hhmm} बजे से ${f.buildingName} की छत की टंकी से सामान्य से लगभग ${excess} लीटर प्रति घंटा ज़्यादा पानी कम हो रहा है, लगातार कम से कम 45 मिनट से। ` +
      (level === null ? "" : `टंकी ${level}% भरी थी, यानी ${HOURS_HI(f.hoursRemainingAtOpen)} का पानी बचा है। `) +
      `ऐसा आमतौर पर तब होता है जब पानी कहीं बह रहा हो।`,
    checklist: [
      "Look at the overflow pipe on the roof tank: is water running out?",
      "Check the float valve: is the inlet still running when the tank is full?",
      "Listen for toilet cisterns that keep refilling.",
      "Walk the bathrooms and kitchen for taps left open.",
    ],
  };
}
