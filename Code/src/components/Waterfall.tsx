import { useState } from "react";
import { formatUsd } from "../lib/util";

export interface WaterfallStep {
  label: string;
  /** Bar magnitude: gross for "start", the drop for "down", leftover for "end". */
  amount: number;
  type: "start" | "down" | "end";
  color: string;
  /** Optional second line under the axis label, e.g. "→ 403(b)". */
  sublabel?: string;
  /** Optional detail lines shown on hover (e.g. a tax breakdown). */
  breakdown?: { label: string; amount: number }[];
  /**
   * Extra money added to this step's destination that does NOT come out of the
   * paycheck (e.g. an employer match into a 403(b)). Drawn as a cap above the bar.
   */
  addOn?: { amount: number; label: string; color: string };
}

interface Props {
  steps: WaterfallStep[];
}

const W = 900;
const H = 360;
const PADX = 18;
const TOP = 40;
const BASE = H - 74;

/**
 * A classic left-to-right waterfall: gross pay on the left, each deduction a
 * floating bar that drops the running balance, and the leftover on the right.
 * Connector lines carry the running balance between bars, and each bar shows
 * both what it takes and what's left after it. Bars with a `breakdown` reveal
 * the detail on hover.
 */
export function Waterfall({ steps }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  if (steps.length === 0) return null;

  let running = 0;
  const items = steps.map((s) => {
    if (s.type === "start") {
      running = s.amount;
      return { s, before: 0, after: s.amount, barTop: s.amount, barBot: 0, running: s.amount };
    }
    if (s.type === "end") {
      return { s, before: 0, after: s.amount, barTop: s.amount, barBot: 0, running: s.amount };
    }
    const before = running;
    const after = running - s.amount;
    running = after;
    return { s, before, after, barTop: before, barBot: after, running: after };
  });

  const yMax = Math.max(...items.map((it) => it.barTop + (it.s.addOn?.amount ?? 0)), 1);
  const plotW = W - PADX * 2;
  const slot = plotW / items.length;
  const barW = Math.min(66, slot * 0.58);
  const y = (v: number) => BASE - (Math.max(0, v) / yMax) * (BASE - TOP);
  const cx = (i: number) => PADX + i * slot + slot / 2;

  const hovered = hover !== null && items[hover]?.s.breakdown ? items[hover] : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Where the paycheck goes">
      <line x1={PADX} y1={BASE} x2={W - PADX} y2={BASE} stroke="#334155" strokeWidth="1" />

      {items.map((it, i) => {
        if (i === items.length - 1) return null;
        const yLevel = y(it.after);
        return (
          <line
            key={`c${i}`}
            x1={cx(i) + barW / 2}
            y1={yLevel}
            x2={cx(i + 1) - barW / 2}
            y2={yLevel}
            stroke="#64748b"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        );
      })}

      {items.map((it, i) => {
        const x = cx(i) - barW / 2;
        const top = y(it.barTop);
        const height = Math.max(1.5, y(it.barBot) - y(it.barTop));
        const isDown = it.s.type === "down";
        const addOn = it.s.addOn;
        const hasDetail = !!it.s.breakdown;

        return (
          <g
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            style={{ cursor: hasDetail ? "help" : "default" }}
          >
            {addOn && (
              <g>
                <rect
                  x={x}
                  y={y(it.before + addOn.amount)}
                  width={barW}
                  height={Math.max(2, y(it.before) - y(it.before + addOn.amount))}
                  fill={addOn.color}
                  opacity="0.85"
                />
                <text x={cx(i)} y={y(it.before + addOn.amount) - 4} textAnchor="middle" fontSize="9" className="fill-emerald-300">
                  +{formatUsd(addOn.amount)} {addOn.label}
                </text>
              </g>
            )}

            <rect x={x} y={top} width={barW} height={height} rx="3" fill={it.s.color} opacity={hover === i ? 1 : 0.9} />

            <text x={cx(i)} y={top - (addOn ? 18 : 6)} textAnchor="middle" fontSize="11" className="fill-slate-100 font-semibold">
              {it.s.type === "down" ? `−${formatUsd(it.s.amount)}` : formatUsd(it.s.amount)}
            </text>

            <text x={cx(i)} y={BASE + 16} textAnchor="middle" fontSize="10" className="fill-slate-300">
              {it.s.label}
              {hasDetail ? " ⓘ" : ""}
            </text>
            {it.s.sublabel && (
              <text x={cx(i)} y={BASE + 29} textAnchor="middle" fontSize="9" className="fill-emerald-300">
                {it.s.sublabel}
              </text>
            )}
            {(isDown || it.s.type === "end") && (
              <text
                x={cx(i)}
                y={BASE + (it.s.sublabel ? 42 : 30)}
                textAnchor="middle"
                fontSize="9"
                className={it.s.type === "end" ? "fill-emerald-300 font-semibold" : "fill-slate-500"}
              >
                {formatUsd(it.running)} left
              </text>
            )}

            {hasDetail && (
              <title>
                {it.s.label}: {it.s.breakdown!.map((r) => `${r.label} ${formatUsd(r.amount)}`).join(" · ")}
              </title>
            )}
          </g>
        );
      })}

      {hovered && hovered.s.breakdown && (
        <Tooltip
          title={`${hovered.s.label} — ${formatUsd(hovered.s.amount)}`}
          rows={hovered.s.breakdown}
          centerX={cx(items.indexOf(hovered))}
          bottomY={y(hovered.barTop) - 20}
        />
      )}
    </svg>
  );
}

function Tooltip({
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
  const boxW = 190;
  const lineH = 17;
  const headH = 22;
  const boxH = headH + rows.length * lineH + 10;
  const x = Math.max(6, Math.min(W - boxW - 6, centerX - boxW / 2));
  const yTop = Math.max(4, bottomY - boxH);

  return (
    <g pointerEvents="none">
      <rect x={x} y={yTop} width={boxW} height={boxH} rx="8" fill="#0b1220" stroke="#334155" opacity="0.98" />
      <text x={x + 10} y={yTop + 15} fontSize="10" className="fill-slate-400 uppercase tracking-wide">
        {title}
      </text>
      {rows.map((r, i) => {
        const ry = yTop + headH + i * lineH + 4;
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
