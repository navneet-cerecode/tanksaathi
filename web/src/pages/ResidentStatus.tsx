import { CircleAlert, CircleCheck, Clock, Droplets } from "lucide-react";
import { useState } from "react";
import { ErrorBlock, LoadingBlock } from "@/components/bits";
import type { ResidentView } from "@/lib/api";
import { residentCopy, ui, type Lang } from "@/lib/copy";
import { ago, hhmm } from "@/lib/format";
import { useNow } from "@/lib/usePoll";
import { cn } from "@/lib/utils";

const TONE = {
  normal: { icon: CircleCheck, className: "text-water", band: "border-water" },
  conserve: { icon: Droplets, className: "text-amber-ink", band: "border-amber-ink" },
  "refill-planned": { icon: Clock, className: "text-amber-ink", band: "border-amber-ink" },
  incident: { icon: CircleAlert, className: "text-vermilion", band: "border-vermilion" },
} as const;

export function ResidentStatus({ view, error, onRetry }: { view: ResidentView | null; error: Error | null; onRetry: () => void }) {
  const [lang, setLang] = useState<Lang>("en");
  const now = useNow();
  if (!view) return error ? <ErrorBlock error={error} onRetry={onRetry} /> : <LoadingBlock />;
  const text = ui[lang];
  const copy = residentCopy[view.status][lang];
  const tone = TONE[view.status];
  const Icon = tone.icon;
  const time = view.refillPlannedAt ? hhmm(view.refillPlannedAt) : "";

  return (
    <div className="mx-auto max-w-md" lang={lang}>
      <p className="text-ink-2">{view.buildingName}</p>
      {view.noData ? (
        <p className="mt-6 text-title">{text.noData}</p>
      ) : (
        <section aria-live="polite" aria-atomic="true" className={cn("mt-4 border-l-4 pl-4", tone.band)}>
          <p className={cn("flex items-center gap-2 text-[1.75rem] font-semibold leading-[2.125rem]", tone.className)}>
            <Icon className="size-7 shrink-0" aria-hidden />
            {copy.word}
          </p>
          <p className="mt-2 text-title font-normal">{copy.line.replace("{time}", time)}</p>
        </section>
      )}
      {view.stale && <p className="mt-4 bg-amber-fill px-3 py-2 text-label">{text.stale}</p>}
      {view.updatedAt && (
        <p className="mt-4 text-caption text-ink-2" lang="en">
          {text.updated}: {ago(view.updatedAt, now)} · {hhmm(view.updatedAt)} IST
        </p>
      )}
      <button
        type="button"
        onClick={() => setLang(lang === "en" ? "hi" : "en")}
        lang={lang === "en" ? "hi" : "en"}
        className="mt-6 min-h-11 rounded-sm border border-ink px-4 text-label hover:bg-water-tint"
      >
        {text.language}
      </button>
    </div>
  );
}
