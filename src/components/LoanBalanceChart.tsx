import { useRef, useState } from "react";
import { formatUsd } from "../lib/util";

export interface LoanSeries {
  label: string;
  color: string;
  /** Balance at each month index (0 = today). */
  values: number[];
}

interface Props {
  series: LoanSeries[];
  /** Month at which PSLF forgiveness happens (draws a marker line). */
  forgivenessMonth?: number;
  /** Month at which training ends and attending income begins. */
  attendingMonth?: number;
}

const W = 720;
const H = 300;
const PAD = { top: 16, right: 16, bottom: 30, left: 56 };

function fmtYearMonth(month: number): string {
  if (month === 0) return "Now";
  const y = Math.floor(month / 12);
  const mo = month % 12;
  if (mo === 0) return `${y} yr`;
  return `${y}y ${mo}m`;
}

/** Compact multi-line SVG of loan balance over time for each payoff strategy. */
export function LoanBalanceChart({ series, forgivenessMonth, attendingMonth }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoverMonth, setHoverMonth] = useState<number | null>(null);

  const maxMonths = Math.max(1, ...series.map((s) => s.values.length - 1));
  const maxBalance = Math.max(1, ...series.flatMap((s) => s.values));
  const yMax = maxBalance * 1.08;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (month: number) => PAD.left + (month / maxMonths) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (yMax / yTicks) * i);

  const maxYears = maxMonths / 12;
  const yearStep = maxYears > 24 ? 6 : maxYears > 12 ? 4 : maxYears > 6 ? 2 : 1;
  const yearTicks: number[] = [];
  for (let yr = 0; yr <= maxYears + 0.001; yr += yearStep) yearTicks.push(yr);

  const monthFromEvent = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    const month = Math.round(((relX - PAD.left) / innerW) * maxMonths);
    return Math.max(0, Math.min(maxMonths, month));
  };

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const m = monthFromEvent(e.clientX);
    if (m !== null) setHoverMonth(m);
  };

  const hoverValues =
    hoverMonth === null
      ? []
      : series.map((s) => ({ ...s, value: s.values[hoverMonth] ?? 0 }));

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Loan balance over time"
        onMouseMove={onMove}
        onMouseLeave={() => setHoverMonth(null)}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke="rgba(148,163,184,0.14)" />
            <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" className="fill-slate-500" fontSize="10">
              {formatUsd(t, { compact: true })}
            </text>
          </g>
        ))}

        {yearTicks.map((yr) => (
          <text key={yr} x={x(yr * 12)} y={H - 10} textAnchor="middle" className="fill-slate-500" fontSize="10">
            {yr === 0 ? "now" : `${yr}y`}
          </text>
        ))}

        {attendingMonth !== undefined && attendingMonth > 0 && attendingMonth <= maxMonths && (
          <>
            <line x1={x(attendingMonth)} y1={PAD.top} x2={x(attendingMonth)} y2={H - PAD.bottom} stroke="rgba(52,211,153,0.4)" strokeDasharray="3 3" />
            <text x={x(attendingMonth)} y={PAD.top + 10} textAnchor="middle" className="fill-emerald-300" fontSize="9">
              attending
            </text>
          </>
        )}

        {forgivenessMonth !== undefined && forgivenessMonth <= maxMonths && (
          <>
            <line x1={x(forgivenessMonth)} y1={PAD.top} x2={x(forgivenessMonth)} y2={H - PAD.bottom} stroke="rgba(245,158,11,0.5)" strokeDasharray="4 3" />
            <text x={x(forgivenessMonth)} y={PAD.top + 10} textAnchor="middle" className="fill-amber-300" fontSize="9">
              forgiveness
            </text>
          </>
        )}

        {series.map((s) => (
          <polyline
            key={s.label}
            points={s.values.map((v, m) => `${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}
            fill="none"
            stroke={s.color}
            strokeWidth="2.25"
            strokeLinejoin="round"
            pointerEvents="none"
          />
        ))}

        {/* Hover capture + crosshair */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={innerW}
          height={innerH}
          fill="transparent"
          style={{ cursor: "crosshair" }}
        />

        {hoverMonth !== null && (
          <g pointerEvents="none">
            <line
              x1={x(hoverMonth)}
              y1={PAD.top}
              x2={x(hoverMonth)}
              y2={H - PAD.bottom}
              stroke="rgba(226,232,240,0.45)"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            {hoverValues.map((s) => (
              <circle key={s.label} cx={x(hoverMonth)} cy={y(s.value)} r="4" fill={s.color} stroke="#0b1220" strokeWidth="1.5" />
            ))}
          </g>
        )}
      </svg>

      {hoverMonth !== null && hoverValues.length > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-[200px] rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
          style={{
            left: `${Math.min(72, Math.max(8, (x(hoverMonth) / W) * 100))}%`,
            top: 8,
            transform: x(hoverMonth) / W > 0.65 ? "translateX(-100%)" : undefined,
          }}
        >
          <p className="mb-1.5 font-semibold text-slate-200">{fmtYearMonth(hoverMonth)}</p>
          <ul className="space-y-1">
            {hoverValues.map((s) => (
              <li key={s.label} className="flex items-center justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-slate-400">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-slate-100">{formatUsd(s.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1.5 px-2 text-xs text-slate-300">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </span>
        ))}
        <span className="text-slate-500">· hover for balances</span>
      </div>
    </div>
  );
}
