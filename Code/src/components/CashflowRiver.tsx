import { useId, useState } from "react";
import { formatUsd } from "../lib/util";

export interface FlowDeduction {
  /** Stable id used for hover state. */
  key: string;
  label: string;
  amount: number;
  color: string;
  /** Optional detail lines shown on hover (e.g. a tax breakdown). */
  breakdown?: { label: string; amount: number }[];
  /** External money that joins this stream's pool (e.g. an employer match). */
  inflow?: { label: string; amount: number; color: string };
  /** Destination account label, e.g. "403(b)". Replaces the plain label. */
  destination?: string;
}

interface Props {
  gross: number;
  leftover: number;
  deductions: FlowDeduction[];
}

const W = 820;
const H = 384;
const LEFT = 28;
const RIGHT = W - 28;
const T = 52; // trunk top edge
const HMAX = 92; // stream thickness representing the full gross
const RUN = 44; // horizontal reach of a tributary before it pools
const POOL = 46; // width of a tributary's end pool

/** Cubic segment with horizontal tangents at both ends (a Sankey link curve). */
function link(x0: number, y0: number, x1: number, y1: number): string {
  const mx = (x0 + x1) / 2;
  return ` C ${mx},${y0} ${mx},${y1} ${x1},${y1}`;
}

/**
 * A paycheck drawn as a river. The green trunk enters as gross pay; at each gate
 * a coloured tributary peels off (a deduction) and the trunk flows on, thinner —
 * splitting again until the final trunk is the leftover. Employer match joins the
 * retirement pool as a separate inflow, and hovering a tributary with a breakdown
 * shows the detail.
 */
export function CashflowRiver({ gross, leftover, deductions }: Props) {
  const gid = useId();
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  if (gross <= 0) return null;

  const h = (v: number) => Math.max(0, (v / gross) * HMAX);
  const n = deductions.length;

  // Running remainder after each deduction: R[0] = gross ... R[n] = leftover.
  const R: number[] = [gross];
  deductions.forEach((d) => R.push(R[R.length - 1] - d.amount));

  const gateStart = LEFT + 132;
  const gateEnd = RIGHT - 140;
  const gate = (i: number) =>
    n <= 1 ? (gateStart + gateEnd) / 2 : gateStart + ((gateEnd - gateStart) * (i - 1)) / (n - 1);

  const branchY = T + HMAX + 56;
  const bottomAt = (r: number) => T + h(r);

  // Trunk: flat top, right edge, then flat bottom segments with a vertical step
  // at each gate (the step is exactly the tributary mouth, hidden behind it).
  let trunk = `M ${LEFT},${T} L ${RIGHT},${T} L ${RIGHT},${bottomAt(R[n])}`;
  for (let i = n; i >= 1; i--) {
    const gx = gate(i);
    trunk += ` L ${gx},${bottomAt(R[i])} L ${gx},${bottomAt(R[i - 1])}`;
  }
  trunk += ` L ${LEFT},${bottomAt(R[0])} Z`;

  const laid = deductions.map((d, idx) => {
    const i = idx + 1;
    const gx = gate(i);
    const topSrc = bottomAt(R[i]);
    const botSrc = bottomAt(R[i - 1]);
    const thYou = Math.max(2, botSrc - topSrc);
    const ex = gx + RUN;
    const poolR = ex + POOL;
    const poolCx = (ex + poolR) / 2;
    const thMatch = d.inflow ? Math.max(3, h(d.inflow.amount)) : 0;
    const poolYouBot = branchY + thYou;
    const poolBot = poolYouBot + thMatch;

    const path =
      `M ${gx},${topSrc}` +
      link(gx, topSrc, ex, branchY) +
      ` L ${poolR},${branchY} L ${poolR},${poolYouBot} L ${ex},${poolYouBot}` +
      link(ex, poolYouBot, gx, botSrc) +
      ` Z`;

    // Employer-match inflow: a short ribbon welling up into the pool's lower slot.
    let inflowPath: string | null = null;
    if (d.inflow) {
      const sx = ex - 30;
      const syTop = poolBot + 18;
      inflowPath =
        `M ${sx},${syTop}` +
        link(sx, syTop, ex, poolYouBot) +
        ` L ${ex},${poolBot}` +
        link(ex, poolBot, sx, syTop + thMatch) +
        ` Z`;
    }

    return { d, gx, poolCx, ex, poolR, thYou, thMatch, poolYouBot, poolBot, path, inflowPath };
  });

  const segMidX = (i: number) => {
    const l = i === 0 ? LEFT : gate(i);
    const r = i === n ? RIGHT : gate(i + 1);
    return (l + r) / 2;
  };

  const hovered = laid.find((b) => b.d.key === hoverKey && b.d.breakdown);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cash flow river">
      <defs>
        <linearGradient id={`trunk-${gid}`} x1="0" x2="1">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <path d={trunk} fill={`url(#trunk-${gid})`} stroke="#34d399" strokeOpacity="0.3" />

      {laid.map((b) => (
        <g
          key={b.d.key}
          onMouseEnter={() => setHoverKey(b.d.key)}
          onMouseLeave={() => setHoverKey((k) => (k === b.d.key ? null : k))}
          style={{ cursor: b.d.breakdown ? "help" : "default" }}
        >
          <path d={b.path} fill={b.d.color} opacity={hoverKey === b.d.key ? 1 : 0.85} />

          {b.d.inflow && b.inflowPath && (
            <>
              <rect x={b.ex} y={b.poolYouBot} width={POOL} height={b.thMatch} fill={b.d.inflow.color} opacity="0.9" />
              <path d={b.inflowPath} fill={b.d.inflow.color} opacity="0.9" />
              <text x={b.ex - 32} y={b.poolBot + 14} textAnchor="start" fontSize="9" className="fill-emerald-300">
                {b.d.inflow.label}
              </text>
              <text x={b.ex - 32} y={b.poolBot + 25} textAnchor="start" fontSize="9" className="fill-emerald-300 font-semibold">
                +{formatUsd(b.d.inflow.amount)}
              </text>
            </>
          )}

          <text x={b.poolCx} y={b.poolBot + 15} textAnchor="middle" fontSize="11" className="fill-slate-100 font-semibold">
            −{formatUsd(b.d.amount)}
          </text>
          <text x={b.poolCx} y={b.poolBot + 29} textAnchor="middle" fontSize="10" className="fill-slate-400">
            {b.d.destination ? `→ ${b.d.destination}` : b.d.label}
            {b.d.breakdown ? " ⓘ" : ""}
          </text>
          {b.d.inflow && (
            <text x={b.poolCx} y={b.poolBot + 42} textAnchor="middle" fontSize="9" className="fill-emerald-300/80">
              {formatUsd(b.d.amount + b.d.inflow.amount)} in
            </text>
          )}

          {b.d.breakdown && (
            <title>
              {b.d.label}: {b.d.breakdown.map((r) => `${r.label} ${formatUsd(r.amount)}`).join(" · ")}
            </title>
          )}
        </g>
      ))}

      {/* Gross entering on the left */}
      <text x={LEFT} y={T - 12} textAnchor="start" fontSize="11" className="fill-slate-300 font-semibold">
        Gross {formatUsd(gross)}
      </text>

      {/* Running "what's left" above the trunk after each split */}
      {R.map((r, i) => {
        if (i === 0) return null;
        const isLast = i === n;
        return (
          <text
            key={i}
            x={segMidX(i)}
            y={T - 12}
            textAnchor="middle"
            fontSize={isLast ? 12 : 10}
            className={isLast ? "fill-emerald-300 font-semibold" : "fill-slate-500"}
          >
            {isLast ? `Left over ${formatUsd(leftover)}` : `left ${formatUsd(r)}`}
          </text>
        );
      })}

      {/* Hover tooltip (e.g. tax breakdown) */}
      {hovered && hovered.d.breakdown && (
        <TaxTooltip
          title={`${hovered.d.label} — ${formatUsd(hovered.d.amount)}`}
          rows={hovered.d.breakdown}
          centerX={hovered.poolCx}
          bottomY={branchY - 10}
        />
      )}
    </svg>
  );
}

function TaxTooltip({
  title,
  rows,
  centerX,
  bottomY,
}: {
  title: string;
  rows: { label: string; amount: number }[];
  centerX: number;
  bottomY: number;
}) {
  const boxW = 186;
  const lineH = 17;
  const padY = 10;
  const headH = 22;
  const boxH = headH + rows.length * lineH + padY;
  const x = Math.max(6, Math.min(W - boxW - 6, centerX - boxW / 2));
  const y = Math.max(4, bottomY - boxH);

  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={boxW} height={boxH} rx="8" fill="#0b1220" stroke="#334155" opacity="0.98" />
      <text x={x + 10} y={y + 15} fontSize="10" className="fill-slate-400 uppercase tracking-wide">
        {title}
      </text>
      {rows.map((r, i) => {
        const ry = y + headH + i * lineH + 4;
        return (
          <g key={i}>
            <text x={x + 10} y={ry} fontSize="11" className="fill-slate-300">
              {r.label}
            </text>
            <text x={x + boxW - 10} y={ry} textAnchor="end" fontSize="11" className="fill-slate-100 font-semibold">
              {formatUsd(r.amount)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
