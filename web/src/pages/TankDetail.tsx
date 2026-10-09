import { DEFAULT_ANOMALY } from "@tanksaathi/core";
import { AssumptionTag, ErrorBlock, FreshnessStamp, LoadingBlock, Section } from "@/components/bits";
import { HourlyUseChart, LevelChart } from "@/components/charts";
import type { TankView } from "@/lib/api";
import { localTime } from "@/lib/format";

export function TankDetail({ view, error, onRetry }: { view: TankView | null; error: Error | null; onRetry: () => void }) {
  if (!view) return error ? <ErrorBlock error={error} onRetry={onRetry} /> : <LoadingBlock />;
  const { state, building, tank, series, hourly } = view;
  const offset = building.utcOffsetMinutes;
  const a = DEFAULT_ANOMALY;
  const latest = state.anomaly.latest;

  return (
    <div className="max-w-3xl">
      <h1 className="text-title font-semibold">{tank.name}</h1>
      <p className="text-ink-2">
        {building.name} · {tank.capacityL.toLocaleString("en-IN")} L tank
      </p>
      <div className="mt-1">
        <FreshnessStamp at={state.lastReadingAt} stale={state.freshness.state === "stale"} />
      </div>
      {view.simulated && <p className="mt-2 text-caption text-ink-2">These readings come from the TankSaathi sensor simulator.</p>}

      <Section title="Level, last 24 hours" className="mt-4">
        <LevelChart series={series} offset={offset} />
      </Section>

      <Section title="Use each hour against what we expect">
        <HourlyUseChart hourly={hourly} offset={offset} />
      </Section>

      <Section title="How the leak alert decides">
        <div className="space-y-3 text-label">
          <p>
            Every reading, TankSaathi checks the last {a.sustainWindows} windows of {a.windowMinutes} minutes. Each window counts as unusual only if the tank lost
            more than {a.quietMultiplier}× the expected amount between {a.quietStartHour}:00 and {a.quietEndHour}:00 (when almost nobody draws water), or{" "}
            {a.activeMultiplier}× during the day, and at least {a.minExcessLph} L/h above it. An alert opens only when all {a.sustainWindows} windows are unusual
            — about {a.sustainWindows * a.windowMinutes} minutes of steady loss. Refills and missing data never count as loss.
            <AssumptionTag />
          </p>
          {state.anomaly.firstDetectedAt !== null ? (
            <p className="font-medium text-vermilion">
              The rule fired at {localTime(state.anomaly.firstDetectedAt, offset)}: about {Math.round((state.anomaly.excessLph ?? 0) / 10) * 10} L/h above expected.
            </p>
          ) : (
            <p>The rule hasn't fired in the last 24 hours.</p>
          )}
          {latest && (
            <table className="w-full text-caption">
              <caption className="mb-1 text-left text-ink-2">Latest three windows</caption>
              <thead>
                <tr className="border-b border-rule text-left text-ink-2">
                  <th className="py-1 font-medium">Window (IST)</th>
                  <th className="py-1 font-medium">Observed</th>
                  <th className="py-1 font-medium">Limit</th>
                  <th className="py-1 font-medium">Unusual?</th>
                </tr>
              </thead>
              <tbody>
                {latest.windows.map((w) => (
                  <tr key={w.from} className="border-b border-rule/60">
                    <td className="py-1">
                      {localTime(w.from, offset).slice(0, 5)}–{localTime(w.to, offset).slice(0, 5)}
                    </td>
                    <td className="py-1">{w.observedLph === null ? "no data" : `${Math.round(w.observedLph)} L/h`}</td>
                    <td className="py-1">{Math.round(w.thresholdLph)} L/h</td>
                    <td className="py-1">{w.flagged ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Section>
    </div>
  );
}
