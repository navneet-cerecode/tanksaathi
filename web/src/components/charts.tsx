import { useState } from "react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HourlyUse } from "@/lib/api";
import { hhmm } from "@/lib/format";

const axis = { stroke: "var(--ink-2)", fontSize: 12, tickLine: false } as const;

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} aria-expanded={open} className="min-h-11 text-label text-water underline underline-offset-4 hover:text-ink">
      {open ? "Hide table" : "Show as table"}
    </button>
  );
}

function Tip({ active, payload, rows }: { active?: boolean; payload?: Array<{ payload: Record<string, number | null> }>; rows: (p: Record<string, number | null>) => string[] }) {
  if (!active || !payload?.[0]) return null;
  return (
    <div className="rounded-sm border border-rule bg-surface px-3 py-2 text-caption shadow-sheet">
      {rows(payload[0].payload).map((r) => (
        <p key={r}>{r}</p>
      ))}
    </div>
  );
}

/** Single series: tank level over the last 24 h. */
export function LevelChart({ series, offset }: { series: Array<{ t: number; levelPct: number }>; offset: number }) {
  const [table, setTable] = useState(false);
  if (series.length < 2) return <p className="text-ink-2">Not enough readings to draw a chart yet.</p>;
  const first = series[0]!;
  const last = series[series.length - 1]!;
  const min = series.reduce((a, b) => (b.levelPct < a.levelPct ? b : a));
  return (
    <figure>
      <figcaption className="mb-2 text-label">
        From {Math.round(first.levelPct)}% at {hhmm(first.t, offset)} to {Math.round(last.levelPct)}% at {hhmm(last.t, offset)}; lowest {Math.round(min.levelPct)}% at{" "}
        {hhmm(min.t, offset)}.
      </figcaption>
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer>
          <ComposedChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--rule)" vertical={false} />
            <XAxis dataKey="t" type="number" domain={["dataMin", "dataMax"]} scale="time" tickFormatter={(t) => hhmm(t, offset)} {...axis} minTickGap={32} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickFormatter={(v) => `${v}%`} {...axis} />
            <Tooltip content={<Tip rows={(p) => [`${hhmm(p.t!, offset)} IST`, `Level ${Math.round(p.levelPct!)}%`]} />} />
            <Area type="monotone" dataKey="levelPct" stroke="var(--ink)" strokeWidth={2} fill="var(--water-tint)" isAnimationActive={false} dot={false} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <TableToggle open={table} onToggle={() => setTable(!table)} />
      {table && (
        <table className="mt-2 w-full text-caption">
          <thead>
            <tr className="border-b border-rule text-left text-ink-2">
              <th className="py-1 font-medium">Time (IST)</th>
              <th className="py-1 font-medium">Level</th>
            </tr>
          </thead>
          <tbody>
            {series.filter((_, i) => i % 3 === 0 || i === series.length - 1).map((p) => (
              <tr key={p.t} className="border-b border-rule/60">
                <td className="py-1">{hhmm(p.t, offset)}</td>
                <td className="py-1">{Math.round(p.levelPct)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}

const FLAG_FACTOR = 3;

/** Observed hourly outflow against the demand profile; hours far above expected are labelled. */
export function HourlyUseChart({ hourly, offset }: { hourly: HourlyUse[]; offset: number }) {
  const [table, setTable] = useState(false);
  const rows = hourly.map((h) => ({
    ...h,
    mid: h.from + 30 * 60_000,
    flagged: h.observedLph !== null && h.observedLph > h.expectedLph * FLAG_FACTOR,
  }));
  const flagged = rows.filter((r) => r.flagged);
  if (rows.length === 0) return <p className="text-ink-2">Not enough readings yet.</p>;
  return (
    <figure>
      <figcaption className="mb-2 text-label">
        {flagged.length === 0
          ? "Every hour's use was within the normal range for that time of day."
          : `${flagged.length} hour${flagged.length > 1 ? "s" : ""} used more than ${FLAG_FACTOR}× the expected amount, starting ${hhmm(flagged[0]!.from, offset)}.`}
      </figcaption>
      <div className="mb-2 flex flex-wrap gap-4 text-caption text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-[2px] bg-chart-observed" aria-hidden /> Observed use (litres per hour)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 border-t-2 border-dashed border-chart-expected" aria-hidden /> Expected for that hour
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-[2px] bg-vermilion" aria-hidden /> Above expected
        </span>
      </div>
      <div className="h-56 w-full" aria-hidden>
        <ResponsiveContainer>
          <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }} barCategoryGap={2}>
            <CartesianGrid stroke="var(--rule)" vertical={false} />
            <XAxis dataKey="mid" type="number" domain={["dataMin - 1800000", "dataMax + 1800000"]} scale="time" tickFormatter={(t) => hhmm(t - 30 * 60_000, offset)} {...axis} minTickGap={28} />
            <YAxis tickFormatter={(v) => `${v}`} {...axis} />
            <Tooltip
              content={
                <Tip
                  rows={(p) => [
                    `${hhmm(p.from!, offset)}–${hhmm(p.to!, offset)} IST`,
                    `Observed ${p.observedLph === null ? "no data" : `${Math.round(p.observedLph)} L/h`}`,
                    `Expected ${Math.round(p.expectedLph!)} L/h`,
                  ]}
                />
              }
            />
            <ReferenceLine y={0} stroke="var(--ink-2)" />
            <Bar dataKey="observedLph" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {rows.map((r) => (
                <Cell key={r.from} fill={r.flagged ? "var(--vermilion)" : "var(--chart-observed)"} />
              ))}
            </Bar>
            <Line type="stepAfter" dataKey="expectedLph" stroke="var(--chart-expected)" strokeDasharray="5 4" strokeWidth={2} dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <TableToggle open={table} onToggle={() => setTable(!table)} />
      {table && (
        <table className="mt-2 w-full text-caption">
          <thead>
            <tr className="border-b border-rule text-left text-ink-2">
              <th className="py-1 font-medium">Hour (IST)</th>
              <th className="py-1 font-medium">Observed</th>
              <th className="py-1 font-medium">Expected</th>
              <th className="py-1 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.from} className="border-b border-rule/60">
                <td className="py-1">{hhmm(r.from, offset)}</td>
                <td className="py-1">{r.observedLph === null ? "—" : `${Math.round(r.observedLph)} L/h`}</td>
                <td className="py-1">{Math.round(r.expectedLph)} L/h</td>
                <td className="py-1 text-vermilion">{r.flagged ? "Above expected" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
