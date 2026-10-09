const H = 124;
const TOP = 4;

/**
 * Upright tank with ruled ticks; the level is also stated in text beside it (DESIGN.md §9).
 * The fill is set directly from the level, so it is correct even when the page isn't painting
 * (background tab, screenshot); a CSS transition eases changes and is disabled by reduced motion.
 */
export function TankGauge({ levelPct, stale }: { levelPct: number | null; stale?: boolean }) {
  const scale = Math.max(0, Math.min(100, levelPct ?? 0)) / 100;
  return (
    <svg width="72" height="136" viewBox="0 0 72 136" aria-hidden className="shrink-0">
      <rect x="8" y={TOP} width="40" height={H} rx="3" fill="var(--surface)" />
      <g
        style={{
          transform: `scaleY(${scale})`,
          transformOrigin: `0 ${TOP + H}px`,
          transition: "transform 400ms cubic-bezier(0.2, 0, 0, 1)",
        }}
      >
        <rect x="8" y={TOP} width="40" height={H} fill={stale ? "var(--sim)" : "var(--water-tint)"} />
        <rect x="8" y={TOP} width="40" height={2 / Math.max(scale, 0.02)} fill={stale ? "var(--ink-2)" : "var(--water)"} />
      </g>
      <rect x="8" y={TOP} width="40" height={H} rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      {[10, 20, 30, 40, 60, 70, 80, 90].map((p) => {
        const y = TOP + H * (1 - p / 100);
        return <line key={p} x1="48" x2="52" y1={y} y2={y} stroke="var(--ink-2)" />;
      })}
      {[25, 50, 75].map((p) => {
        const y = TOP + H * (1 - p / 100);
        return (
          <g key={p}>
            <line x1="48" x2="56" y1={y} y2={y} stroke="var(--ink-2)" />
            <text x="58" y={y + 3} fontSize="10" fill="var(--ink-2)">
              {p}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
