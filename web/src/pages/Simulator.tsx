import type { ScenarioId } from "@tanksaathi/core";
import { useState } from "react";
import { Link } from "react-router";
import { Section } from "@/components/bits";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { hhmm } from "@/lib/format";

const SCENARIOS: Array<{ id: ScenarioId; title: string; text: string }> = [
  { id: "normal", title: "Normal day", text: "33 °C, ordinary use with the usual morning refill." },
  { id: "heat", title: "Heat day", text: "42 °C: the building draws about 20% more (assumed), so the tank empties sooner." },
  { id: "leak", title: "Sustained leak", text: "From 1 AM a running cistern or stuck float valve loses about 220 L/h." },
  { id: "stale", title: "Stale sensor", text: "The sensor stops reporting 50 minutes before now." },
  { id: "recovery", title: "Recovery", text: "The valve is fixed and a tanker refills the tank. Resolve the alert first." },
];

interface LogEntry {
  at: number;
  text: string;
}

export function Simulator({ buildingId, onChanged }: { buildingId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const add = (text: string) => setLog((l) => [{ at: Date.now(), text }, ...l].slice(0, 8));

  async function run(id: ScenarioId) {
    setBusy(id);
    try {
      const r = await api.runScenario(buildingId, id);
      add(`Published "${id}": ${r.readings} readings over MQTT to AWS IoT Core.`);
      window.setTimeout(onChanged, 4_000);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      add(code === "too-soon" ? "Wait 20 seconds between runs." : code === "daily-limit" ? "Today's simulator limit is used up." : "The run failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function reset() {
    if (!window.confirm("Reset clears every reading and alert for this demo building, including the run you just made. Continue?")) return;
    setBusy("reset");
    try {
      const r = await api.resetDemo(buildingId);
      add(`Reset: removed ${r.removed} items and stopped ${r.stoppedWorkflows} workflow(s).`);
      onChanged();
    } catch {
      add("Reset failed. Try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-title font-semibold">Demo simulator</h1>
      <p className="mt-1 text-ink-2">
        Each run sends one batch of simulated tank readings through the same path a real sensor would use: AWS IoT Core, then the ingest Lambda. Nothing here is field data.
      </p>
      <ul className="mt-4">
        {SCENARIOS.map((s) => (
          <li key={s.id} className="flex flex-col gap-3 border-t border-rule py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{s.title}</p>
              <p className="text-label text-ink-2">{s.text}</p>
            </div>
            <Button variant="secondary" disabled={busy !== null} onClick={() => run(s.id)} className="sm:w-40">
              {busy === s.id ? "Sending…" : "Run"}
            </Button>
          </li>
        ))}
        <li className="flex flex-col gap-3 border-t border-rule py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Reset</p>
            <p className="text-label text-ink-2">Clears readings, alerts and running workflows for this demo building. Reset first, then run a scenario.</p>
          </div>
          <Button variant="ghost" disabled={busy !== null} onClick={reset} className="sm:w-40">
            {busy === "reset" ? "Resetting…" : "Reset demo"}
          </Button>
        </li>
      </ul>
      <Section title="Run log">
        {log.length === 0 ? (
          <p className="text-ink-2">Nothing run yet in this session.</p>
        ) : (
          <ol className="space-y-1 text-label" aria-live="polite">
            {log.map((e) => (
              <li key={e.at}>
                <span className="font-mono text-caption text-ink-2">{hhmm(e.at)}</span> {e.text}
              </li>
            ))}
          </ol>
        )}
        <Link to="/overview" className={`${buttonVariants({ variant: "link" })} mt-3 px-0`}>
          Open the caretaker overview
        </Link>
      </Section>
    </div>
  );
}
