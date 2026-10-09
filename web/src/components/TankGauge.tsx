import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { useRef } from "react";

gsap.registerPlugin(useGSAP);

const H = 124;
const TOP = 4;

/** Upright tank with ruled ticks; the level is also stated in text beside it (DESIGN.md §9). */
export function TankGauge({ levelPct, stale }: { levelPct: number | null; stale?: boolean }) {
  const fill = useRef<SVGGElement>(null);
  const scale = Math.max(0, Math.min(100, levelPct ?? 0)) / 100;

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        gsap.to(fill.current, { scaleY: scale, duration: 0.4, ease: "power2.out", transformOrigin: "50% 100%" });
      });
      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(fill.current, { scaleY: scale, transformOrigin: "50% 100%" });
      });
      return () => mm.revert();
    },
    { dependencies: [scale] },
  );

  return (
    <svg width="72" height="136" viewBox="0 0 72 136" aria-hidden className="shrink-0">
      <rect x="8" y={TOP} width="40" height={H} rx="3" fill="var(--surface)" />
      <g ref={fill} style={{ transform: "scaleY(0)" }}>
        <rect x="8" y={TOP} width="40" height={H} fill={stale ? "var(--sim)" : "var(--water-tint)"} />
        <rect x="8" y={TOP} width="40" height="2" fill={stale ? "var(--ink-2)" : "var(--water)"} />
      </g>
      <rect x="8" y={TOP} width="40" height={H} rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((f) => {
        const y = TOP + H * (1 - f);
        const major = f === 0.25 || f === 0.5 || f === 0.75;
        return <line key={f} x1="48" x2={major ? 56 : 52} y1={y} y2={y} stroke="var(--ink-2)" />;
      })}
      {[25, 50, 75].map((p) => (
        <g key={p}>
          <line x1="48" x2="56" y1={TOP + H * (1 - p / 100)} y2={TOP + H * (1 - p / 100)} stroke="var(--ink-2)" />
          <text x="58" y={TOP + H * (1 - p / 100) + 3} fontSize="10" fill="var(--ink-2)">
            {p}
          </text>
        </g>
      ))}
    </svg>
  );
}
