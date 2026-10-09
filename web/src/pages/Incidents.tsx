import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { RESOLUTIONS, type Resolution } from "@tanksaathi/core";
import { ErrorBlock, LoadingBlock, Section } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError, type Incident, type IncidentAction, type IncidentStatus } from "@/lib/api";
import { formatHours, localTime } from "@/lib/format";
import { usePoll } from "@/lib/usePoll";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const STATUS_LABEL: Record<IncidentStatus, string> = {
  open: "Not acknowledged",
  acknowledged: "Acknowledged",
  inspecting: "Being inspected",
  resolved: "Resolved",
};

const RESOLUTION_LABEL: Record<Resolution, string> = {
  "leak-fixed": "Leak found and fixed",
  "tap-left-open": "A tap or valve was left open",
  "false-alarm": "False alarm: the use was expected",
  "sensor-fault": "The sensor was wrong",
  other: "Something else",
};

export function IncidentList({ incidents, error, onRetry }: { incidents: Incident[] | null; error: Error | null; onRetry: () => void }) {
  if (!incidents) return error ? <ErrorBlock error={error} onRetry={onRetry} /> : <LoadingBlock />;
  return (
    <div className="max-w-3xl">
      <h1 className="text-title font-semibold">Alerts</h1>
      {incidents.length === 0 ? (
        <p className="mt-3 text-ink-2">No alerts yet. When water keeps draining while the building should be quiet, an alert appears here and by email.</p>
      ) : (
        <ul className="mt-3">
          {incidents.map((i) => (
            <li key={i.incidentId} className="border-t border-rule">
              <Link to={`/incidents/${i.buildingId}/${i.incidentId}`} className="flex min-h-16 items-center justify-between gap-3 py-3 hover:bg-sim/50">
                <div>
                  <p className="font-medium">Possible leak · {i.tankId}</p>
                  <p className="text-caption text-ink-2">Detected {localTime(i.detectedAt)}</p>
                </div>
                <span className={cn("text-label font-medium", i.status === "resolved" ? "text-ink-2" : i.status === "open" ? "text-vermilion" : "text-amber-ink")}>
                  {STATUS_LABEL[i.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STEPS: IncidentStatus[] = ["open", "acknowledged", "inspecting", "resolved"];

export function IncidentDetail({ onChanged }: { onChanged: () => void }) {
  const { buildingId = "", incidentId = "" } = useParams();
  const { data, error, refresh } = usePoll(() => api.incident(buildingId, incidentId), 5_000, `${buildingId}/${incidentId}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const announce = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (data && announce.current) announce.current.textContent = `Incident status: ${STATUS_LABEL[data.status]}`;
  }, [data?.status]);

  if (!data) return error ? <ErrorBlock error={error} onRetry={refresh} /> : <LoadingBlock />;
  const i = data;

  async function act(action: IncidentAction, label: string) {
    setBusy(label);
    try {
      // The workflow parks its pause token a moment after each step; retry briefly.
      for (let attempt = 0; ; attempt++) {
        try {
          await api.act(i.buildingId, i.incidentId, action);
          break;
        } catch (err) {
          if (err instanceof ApiError && err.code === "workflow-not-ready" && attempt < 6) {
            await new Promise((r) => setTimeout(r, 1_000));
            continue;
          }
          throw err;
        }
      }
      toast.success(label === "resolve" ? "Marked as resolved" : label === "inspect" ? "Inspection started" : "Alert acknowledged");
      setResolveOpen(false);
      await refresh();
      onChanged();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      toast.error(code === "invalid-transition" || code === "changed-by-someone-else" ? "Someone already updated this alert. Showing the latest." : "Couldn't save that. Try again.");
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="max-w-3xl">
      <p ref={announce} role="status" className="sr-only" />
      <Link to="/incidents" className="text-label text-water underline underline-offset-4">
        All alerts
      </Link>
      <h1 className="mt-2 text-title font-semibold">Possible leak · {i.tankId}</h1>
      <p className="mt-1">
        Since {localTime(i.detectedAt)} the tank lost about {Math.round(i.excessLph / 10) * 10} L/h more than expected for at least 45 minutes.
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-y-2 text-label">
        <dt className="text-ink-2">Severity</dt>
        <dd className={i.severity === "high" ? "font-semibold text-vermilion" : ""}>{i.severity === "high" ? "Urgent" : "Medium"}</dd>
        <dt className="text-ink-2">Water left when opened</dt>
        <dd>
          {i.levelPctAtOpen === null ? "—" : `${Math.round(i.levelPctAtOpen)}%`}, {formatHours(i.hoursRemainingAtOpen)}
        </dd>
        <dt className="text-ink-2">Data</dt>
        <dd>{i.simulated ? "Sensor simulator" : "Tank sensor"}</dd>
      </dl>

      <ol aria-label="Progress" className="mt-6 grid grid-cols-4 border-y border-rule text-center text-caption">
        {STEPS.map((s, idx) => {
          const reached = STEPS.indexOf(i.status) >= idx;
          return (
            <li key={s} aria-current={i.status === s ? "step" : undefined} className={cn("py-2", reached ? "font-semibold text-ink" : "text-ink-2", i.status === s && "bg-water-tint")}>
              {STATUS_LABEL[s]}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        {i.status === "open" && (
          <Button variant="urgent" className="sm:flex-1" disabled={busy !== null} onClick={() => act({ action: "acknowledge" }, "acknowledge")}>
            {busy === "acknowledge" ? "Acknowledging…" : "Acknowledge alert"}
          </Button>
        )}
        {i.status === "acknowledged" && (
          <Button variant="secondary" className="sm:flex-1" disabled={busy !== null} onClick={() => act({ action: "inspect" }, "inspect")}>
            {busy === "inspect" ? "Saving…" : "Start inspection"}
          </Button>
        )}
        {(i.status === "acknowledged" || i.status === "inspecting") && (
          <Button className="sm:flex-1" disabled={busy !== null} onClick={() => setResolveOpen(true)}>
            Mark as resolved
          </Button>
        )}
      </div>

      {i.status !== "resolved" && <Explanation incident={i} />}

      <Section title="Timeline">
        <ol className="space-y-3">
          {i.timeline.map((e) => (
            <li key={`${e.at}-${e.action}`} className="grid grid-cols-[4.5rem_1fr] gap-3 text-label">
              <span className="font-mono text-caption text-ink-2">{localTime(e.at).slice(0, 5)}</span>
              <div>
                <p className="font-medium">
                  {e.action === "opened" ? "Alert opened by TankSaathi" : e.action === "acknowledge" ? "Acknowledged by caretaker" : e.action === "inspect" ? "Inspection started" : "Resolved"}
                  {e.resolution ? ` · ${RESOLUTION_LABEL[e.resolution]}` : ""}
                </p>
                {e.note && <p className="text-ink-2">{e.note}</p>}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <ResolveDialog open={resolveOpen} onOpenChange={setResolveOpen} busy={busy === "resolve"} onResolve={(resolution, note) => act({ action: "resolve", resolution, note: note || undefined }, "resolve")} />
    </div>
  );
}

function Explanation({ incident }: { incident: Incident }) {
  const [lang, setLang] = useState<"en" | "hi">("en");
  const e = incident.explanation;
  const checklist = e?.checklist ?? [
    "Look at the overflow pipe on the roof tank: is water running out?",
    "Check the float valve: is the inlet still running when the tank is full?",
    "Listen for toilet cisterns that keep refilling.",
    "Walk the bathrooms and kitchen for taps left open.",
  ];
  return (
    <Section title="What this means" className="mt-6">
      {e && (
        <>
          <p lang={lang} className="text-label">
            {lang === "en" ? e.en : e.hi}
          </p>
          <button type="button" lang={lang === "en" ? "hi" : "en"} onClick={() => setLang(lang === "en" ? "hi" : "en")} className="mt-1 min-h-11 text-label text-water underline underline-offset-4">
            {lang === "en" ? "हिन्दी में पढ़ें" : "Read in English"}
          </button>
        </>
      )}
      <h3 className="mt-3 text-label font-semibold">Check first</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-label">
        {checklist.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <p className="mt-2 text-caption text-ink-2">
        {e?.source === "bedrock" ? "AI-written summary (Amazon Bedrock) · check it against the readings" : "Standard message"}
      </p>
    </Section>
  );
}

function ResolveDialog({
  open,
  onOpenChange,
  busy,
  onResolve,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  busy: boolean;
  onResolve: (r: Resolution, note: string) => void;
}) {
  const [resolution, setResolution] = useState<Resolution | "">("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface">
        <DialogHeader>
          <DialogTitle>What did you find?</DialogTitle>
          <DialogDescription className="text-ink-2">This goes into the building's log. Residents only see that the alert is closed.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!resolution) return setError("Choose what you found.");
            onResolve(resolution, note.trim());
          }}
        >
          <RadioGroup value={resolution} onValueChange={(v) => { setResolution(v as Resolution); setError(null); }} aria-describedby={error ? "resolve-error" : undefined} className="gap-0">
            {RESOLUTIONS.map((r) => (
              <Label key={r} htmlFor={`r-${r}`} className="flex min-h-12 cursor-pointer items-center gap-3 border-t border-rule text-base font-normal">
                <RadioGroupItem id={`r-${r}`} value={r} className="size-5 border-ink-2" />
                {RESOLUTION_LABEL[r]}
              </Label>
            ))}
          </RadioGroup>
          {error && (
            <p id="resolve-error" role="alert" className="mt-2 text-label text-vermilion">
              {error}
            </p>
          )}
          <Label htmlFor="resolve-note" className="mt-4 block text-label">
            Note (optional)
          </Label>
          <Textarea id="resolve-note" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="mt-1.5 min-h-24 bg-surface text-base" aria-describedby="note-count" />
          <p id="note-count" className="mt-1 text-right text-caption text-ink-2">
            {note.length}/500
          </p>
          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Mark as resolved"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
