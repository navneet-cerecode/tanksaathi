import { useState } from "react";
import { Link } from "react-router";
import { AssumptionTag, ErrorBlock, FreshnessStamp, IncidentStrip, LoadingBlock, Section, StaleBanner, statusSentence } from "@/components/bits";
import { TankGauge } from "@/components/TankGauge";
import { Button, buttonVariants } from "@/components/ui/button";
import { api, type Incident, type TankView } from "@/lib/api";
import { hoursFigure, litres, localTime, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

const HEAT_COPY: Record<string, string> = {
  warm: "about 10% more use",
  hot: "about 20% more use",
  extreme: "about 30% more use",
};

export function Overview({
  view,
  incidents,
  error,
  onRetry,
  onChanged,
}: {
  view: TankView | null;
  incidents: Incident[];
  error: Error | null;
  onRetry: () => void;
  onChanged: () => void;
}) {
  if (!view) return error ? <ErrorBlock error={error} onRetry={onRetry} /> : <LoadingBlock />;
  const { state, building, tank } = view;
  const stale = state.freshness.state === "stale";
  const open = incidents.find((i) => i.status !== "resolved");
  const hours = state.projection?.hoursConservative ?? null;
  const fig = hoursFigure(hours);
  const heatText = HEAT_COPY[state.heat.band];

  return (
    <div className="grid gap-x-10 md:grid-cols-12">
      <div className="md:col-span-5">
        <h1 className="text-title font-semibold">{building.name}</h1>
        <p className="text-ink-2">{tank.name}</p>
        <div className="mt-1">
          <FreshnessStamp at={state.lastReadingAt} stale={stale} />
        </div>

        {stale && (
          <div className="mt-3">
            <StaleBanner at={state.lastReadingAt} />
          </div>
        )}

        <div className="mt-4 flex items-end gap-4">
          <div className="flex-1">
            <p role="status" aria-atomic="true">
              {statusSentence(hours, state.projection?.capped ?? false)}
            </p>
            <p className={cn("mt-2 text-figure font-semibold", stale && "text-ink-2")}>
              {fig.value}
              <span className="ml-1 text-title font-medium">{fig.unit}</span>
            </p>
            <p className="text-label text-ink-2">
              {pct(state.levelPct)} · {litres(state.usableLitres)} usable
            </p>
            {state.observedLph !== null && <p className="text-label text-ink-2">Using about {Math.round(state.observedLph / 10) * 10} L/h now</p>}
          </div>
          <TankGauge levelPct={state.levelPct} stale={stale} />
        </div>

        <p className="mt-4 text-caption text-ink-2">
          {state.forecastMaxC === null
            ? "No temperature forecast, so no heat adjustment."
            : heatText
              ? `Forecast ${state.forecastMaxC} °C: we plan for ${heatText} today.`
              : `Forecast ${state.forecastMaxC} °C: no heat adjustment.`}
          {heatText && <AssumptionTag />}
        </p>
      </div>

      <div className="md:col-span-7">
        {open ? (
          <div className="mt-6 md:mt-0">
            <IncidentStrip incident={open} />
          </div>
        ) : (
          <Section title="Alerts" className="mt-6 md:mt-0 md:border-t-0 md:pt-0">
            <p className="text-ink-2">No open alerts. TankSaathi watches for water loss that keeps going when the building should be quiet.</p>
          </Section>
        )}
        <RefillPlan buildingId={building.buildingId} plannedAt={view.refillPlannedAt} onChanged={onChanged} />
        <Section title="History">
          <Link to="/tank" className={buttonVariants({ variant: "secondary" })}>
            See the last 24 hours
          </Link>
        </Section>
      </div>
    </div>
  );
}

function RefillPlan({ buildingId, plannedAt, onChanged }: { buildingId: string; plannedAt: number | null; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    try {
      await api.planRefill(buildingId, next);
      setEditing(false);
      onChanged();
    } catch {
      setError("Couldn't save the refill time. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function toIso(hhmmLocal: string) {
    // Today in IST at the chosen time; if it's already past, tomorrow.
    const [h, m] = hhmmLocal.split(":").map(Number);
    const nowIst = new Date(Date.now() + 330 * 60_000);
    let t = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate(), h!, m!) - 330 * 60_000;
    if (t < Date.now() - 60 * 60_000) t += 24 * 3_600_000;
    return new Date(t).toISOString();
  }

  return (
    <Section title="Refill">
      {plannedAt && !editing ? (
        <div className="flex flex-wrap items-center gap-3">
          <p>Refill planned for {localTime(plannedAt)}. Residents can see this.</p>
          <Button variant="ghost" size="sm" onClick={() => save(null)} disabled={busy}>
            Clear
          </Button>
        </div>
      ) : editing ? (
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!time) return setError("Choose a time.");
            void save(toIso(time));
          }}
        >
          <div>
            <label htmlFor="refill-time" className="mb-1.5 block text-label">
              Refill time (IST)
            </label>
            <input id="refill-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-12 rounded-sm border border-ink-2 bg-surface px-3" />
          </div>
          <Button type="submit" disabled={busy}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setEditing(true)}>
          Plan a refill
        </Button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-label text-vermilion">
          {error}
        </p>
      )}
    </Section>
  );
}
