import { useId } from "react";
import type { RetirementPoint } from "../engine";
import { formatUsd } from "../lib/util";

interface Props {
  points: RetirementPoint[];
  fireNumber: number;
  coastNumber: number;
  retireAge: number;
  ageAtFI: number | null;
  ageAtCoast: number | null;
}

const W = 720;
const H = 280;
const PAD = { top: 16, right: 16, bottom: 28, left: 52 };

/** Distinct stroke patterns (readable without color). */
const STYLE = {
  balance: { strokeWidth: 3, dash: undefined as string | undefined },
  coastPath: { strokeWidth: 2.5, dash: "14 7" },
  fireTarget: { strokeWidth: 2, dash: "10 4 2 4" },
  coastThreshold: { strokeWidth: 2, dash: "2 5" },
  retireAge: { strokeWidth: 1.5, dash: "6 4 2 4" },
} as const;

function LegendLine({
  x,
  y,
  w,
  pattern,
  width,
}: {
  x: number;
  y: number;
  w: number;
  pattern?: string;
  width: number;
}) {
  return (
    <line
      x1={x}
      y1={y}
      x2={x + w}
      y2={y}
      stroke="currentColor"
      className="text-slate-200"
      strokeWidth={width}
      strokeDasharray={pattern}
      strokeLinecap="round"
    />
  );
}

/**
 * Compact SVG chart of a retirement trajectory: balance while still saving vs.
 * the "coast" balance (if you stopped saving today), against the FIRE target.
 */
export function ProjectionChart({ points, fireNumber, coastNumber, retireAge, ageAtFI, ageAtCoast }: Props) {
  const gid = useId();
  if (points.length < 2) return null;

  const startAge = points[0].age;
  const endAge = Math.min(
    points.at(-1)!.age,
    Math.max(retireAge, ageAtFI ?? retireAge, ageAtCoast ?? retireAge) + 2,
  );
  const shown = points.filter((p) => p.age <= endAge);

  const maxBalance = Math.max(
    fireNumber,
    ...shown.map((p) => Math.max(p.balance, p.coastBalance)),
  );
  const yMax = maxBalance * 1.08;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (age: number) =>
    PAD.left + ((age - startAge) / (endAge - startAge || 1)) * innerW;
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;

  const line = (key: "balance" | "coastBalance") =>
    shown.map((p) => `${x(p.age).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const areaPath = `M ${x(startAge)},${y(0)} L ${shown
    .map((p) => `${x(p.age).toFixed(1)},${y(p.balance).toFixed(1)}`)
    .join(" L ")} L ${x(endAge)},${y(0)} Z`;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (yMax / yTicks) * i);
  const ageStep = Math.max(1, Math.round((endAge - startAge) / 6));
  const ageTicks: number[] = [];
  for (let a = startAge; a <= endAge; a += ageStep) ageTicks.push(a);

  const fireY = y(fireNumber);
  const coastY = y(coastNumber);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Retirement projection">
      <defs>
        <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} y1={y(t)} x2={W - PAD.right} y2={y(t)} stroke="rgba(148,163,184,0.14)" />
          <text x={PAD.left - 8} y={y(t) + 3} textAnchor="end" className="fill-slate-500" fontSize="10">
            {formatUsd(t, { compact: true })}
          </text>
        </g>
      ))}

      {ageTicks.map((a) => (
        <text key={a} x={x(a)} y={H - 8} textAnchor="middle" className="fill-slate-500" fontSize="10">
          {a}
        </text>
      ))}

      {/* FIRE target — dash-dot */}
      <line
        x1={PAD.left}
        y1={fireY}
        x2={W - PAD.right}
        y2={fireY}
        stroke="#f59e0b"
        strokeWidth={STYLE.fireTarget.strokeWidth}
        strokeDasharray={STYLE.fireTarget.dash}
        strokeLinecap="round"
      />
      <text x={W - PAD.right} y={fireY - 5} textAnchor="end" className="fill-amber-300" fontSize="10">
        FIRE {formatUsd(fireNumber, { compact: true })}
      </text>

      {/* Coast FIRE threshold — dotted */}
      {Math.abs(coastY - fireY) > 2 && (
        <>
          <line
            x1={PAD.left}
            y1={coastY}
            x2={W - PAD.right}
            y2={coastY}
            stroke="#22d3ee"
            strokeWidth={STYLE.coastThreshold.strokeWidth}
            strokeDasharray={STYLE.coastThreshold.dash}
            strokeLinecap="round"
          />
          <text x={PAD.left + 4} y={coastY - 5} textAnchor="start" className="fill-cyan-300" fontSize="10">
            Coast threshold {formatUsd(coastNumber, { compact: true })}
          </text>
        </>
      )}

      {/* Target retirement age — vertical dash-dot */}
      {retireAge <= endAge && (
        <line
          x1={x(retireAge)}
          y1={PAD.top}
          x2={x(retireAge)}
          y2={H - PAD.bottom}
          stroke="rgba(148,163,184,0.45)"
          strokeWidth={STYLE.retireAge.strokeWidth}
          strokeDasharray={STYLE.retireAge.dash}
          strokeLinecap="round"
        />
      )}

      <path d={areaPath} fill={`url(#fill-${gid})`} />
      <polyline
        points={line("coastBalance")}
        fill="none"
        stroke="#818cf8"
        strokeWidth={STYLE.coastPath.strokeWidth}
        strokeDasharray={STYLE.coastPath.dash}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points={line("balance")}
        fill="none"
        stroke="#34d399"
        strokeWidth={STYLE.balance.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <g transform={`translate(${PAD.left}, ${PAD.top})`} className="text-slate-200">
        <rect x={0} y={0} width={272} height={88} rx={6} fill="rgba(15,23,42,0.88)" stroke="rgba(148,163,184,0.25)" />
        <LegendLine x={8} y={14} w={22} width={STYLE.balance.strokeWidth} />
        <text x={36} y={17} className="fill-slate-300" fontSize="10">
          Keep saving — solid
        </text>
        <LegendLine x={8} y={30} w={22} pattern={STYLE.coastPath.dash} width={STYLE.coastPath.strokeWidth} />
        <text x={36} y={33} className="fill-slate-300" fontSize="10">
          Stop saving today — long dash
        </text>
        <LegendLine x={8} y={46} w={22} pattern={STYLE.fireTarget.dash} width={STYLE.fireTarget.strokeWidth} />
        <text x={36} y={49} className="fill-slate-300" fontSize="10">
          FIRE target — dash–dot
        </text>
        <LegendLine x={8} y={62} w={22} pattern={STYLE.coastThreshold.dash} width={STYLE.coastThreshold.strokeWidth} />
        <text x={36} y={65} className="fill-slate-300" fontSize="10">
          Coast threshold today — dots
        </text>
        <LegendLine x={8} y={78} w={22} pattern={STYLE.retireAge.dash} width={STYLE.retireAge.strokeWidth} />
        <text x={36} y={81} className="fill-slate-300" fontSize="10">
          Target retire age — vertical dash–dot
        </text>
      </g>

      {ageAtCoast !== null && ageAtCoast <= endAge && Math.abs(coastY - fireY) > 2 && (
        <rect
          x={x(ageAtCoast) - 4}
          y={coastY - 4}
          width={8}
          height={8}
          fill="#22d3ee"
          stroke="#0b1220"
          strokeWidth="1.5"
        />
      )}
      {ageAtFI !== null && ageAtFI <= endAge && (
        <circle cx={x(ageAtFI)} cy={fireY} r="4.5" fill="#34d399" stroke="#0b1220" strokeWidth="1.5" />
      )}
    </svg>
  );
}
