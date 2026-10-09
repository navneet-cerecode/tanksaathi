import { AlertTriangle, Clock, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Incident } from "@/lib/api";
import { config } from "@/lib/config";
import { ago, formatHours, localTime } from "@/lib/format";
import { useNow } from "@/lib/usePoll";
import { cn } from "@/lib/utils";

export function FreshnessStamp({ at, stale }: { at: number | null; stale: boolean }) {
  const now = useNow();
  return (
    <p className={cn("flex items-center gap-1.5 text-caption", stale ? "text-amber-ink" : "text-ink-2")}>
      <Clock className="size-3.5" aria-hidden />
      {at === null ? "No reading yet" : `Reading ${ago(at, now)} · ${localTime(at)}`}
    </p>
  );
}

export function StaleBanner({ at }: { at: number | null }) {
  const now = useNow();
  return (
    <div role="status" className="flex gap-2 bg-amber-fill px-4 py-3 text-label">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        Last reading {ago(at, now)}, so this estimate may be wrong. Check the sensor and its power.
      </p>
    </div>
  );
}

export function AssumptionTag() {
  return (
    <a
      href={`${config.repoUrl}/blob/main/ASSUMPTIONS.md`}
      target="_blank"
      rel="noreferrer"
      className="ml-1.5 inline-flex rounded-sm border border-amber-ink px-1.5 text-[0.6875rem] leading-5 font-medium text-amber-ink hover:bg-amber-fill/40"
    >
      Assumption
    </a>
  );
}

export function IncidentStrip({ incident }: { incident: Incident }) {
  const urgent = incident.severity === "high";
  return (
    <section
      aria-labelledby="incident-strip-title"
      className="animate-in fade-in slide-in-from-top-2 border-t-[3px] border-vermilion bg-vermilion-tint px-4 py-3 duration-200"
    >
      <h2 id="incident-strip-title" className="flex items-center gap-1.5 text-label font-semibold text-vermilion">
        <AlertTriangle className="size-4" aria-hidden />
        Possible leak{urgent ? " · urgent" : ""}
      </h2>
      <p className="mt-1 text-label">
        Since {localTime(incident.detectedAt)} the tank has lost about {Math.round(incident.excessLph / 10) * 10} L/h more than
        expected.
        {incident.status === "open" ? " Nobody has acknowledged it yet." : ` Status: ${incident.status}.`}
      </p>
      <Link
        to={`/incidents/${incident.buildingId}/${incident.incidentId}`}
        className={cn(buttonVariants({ variant: urgent ? "urgent" : "default" }), "mt-3 w-full")}
      >
        Review alert
      </Link>
    </section>
  );
}

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("border-t border-rule py-4", className)}>
      <h2 className="mb-3 text-heading font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function LoadingBlock() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4">
      <Skeleton className="h-6 w-2/3 bg-sim" />
      <Skeleton className="h-16 w-1/3 bg-sim" />
      <Skeleton className="h-32 w-full bg-sim" />
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const status = (error as { status?: number }).status;
  const message =
    status === 403
      ? "Your account can't see this building."
      : status === 404
        ? "We couldn't find that."
        : "We couldn't reach TankSaathi. Check your connection.";
  return (
    <div role="alert" className="space-y-3 border-t border-rule py-4">
      <p>{message}</p>
      <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function statusSentence(hours: number | null, capped: boolean): string {
  if (hours === null) return "We don't have enough readings to estimate yet.";
  if (capped) return "More than 3 days of water left at today's use.";
  return `${formatHours(hours).replace(/^about/, "About").replace(/^less/, "Less")} of water left at today's use, if no refill arrives.`;
}
