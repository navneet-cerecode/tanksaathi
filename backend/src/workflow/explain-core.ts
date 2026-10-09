import { ExplanationSchema, formatLocalTime, standardExplanation, type ExplainFacts, type Explanation } from "@tanksaathi/core";

/**
 * The model only rewrites a finding the deterministic rule already made.
 * It receives numbers and enums, never free text from users, and its output
 * must pass the same schema as the standard text or it is discarded.
 */
export function buildPrompt(f: ExplainFacts) {
  const facts = {
    building: f.buildingName,
    detectedAtLocal: formatLocalTime(f.detectedAt, f.utcOffsetMinutes),
    excessLph: Math.round(f.excessLph / 10) * 10,
    levelPct: f.levelPctAtOpen === null ? null : Math.round(f.levelPctAtOpen),
    hoursLeft: f.hoursRemainingAtOpen === null ? null : Math.round(f.hoursRemainingAtOpen * 10) / 10,
    severity: f.severity,
  };
  return {
    system:
      "You write short, calm messages for a hostel caretaker about a rooftop water tank. " +
      "A rule has already found sustained water loss; do not decide whether there is a leak and do not add numbers that are not in the facts. " +
      'Reply with JSON only: {"en": string (max 3 sentences), "hi": string (the same in simple Hindi), "checklist": array of 3 to 5 short things to check first}. No markup.',
    user: JSON.stringify(facts),
  };
}

function parse(text: string): Explanation | null {
  const json = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = ExplanationSchema.safeParse({ ...JSON.parse(json), source: "bedrock" });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function explain(
  facts: ExplainFacts,
  model: { enabled: boolean; invoke: (prompt: ReturnType<typeof buildPrompt>) => Promise<string> },
): Promise<Explanation> {
  if (!model.enabled) return standardExplanation(facts);
  try {
    return parse(await model.invoke(buildPrompt(facts))) ?? standardExplanation(facts);
  } catch {
    return standardExplanation(facts);
  }
}
