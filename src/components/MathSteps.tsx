import { useState } from "react";
import type { MathStep } from "../engine";

/** Collapsible "show the math" table of verifiable calculation steps. */
export function MathSteps({ steps, label = "the math" }: { steps: MathStep[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
      >
        {open ? `Hide ${label} ▲` : `Show ${label} ▼`}
      </button>
      {open && (
        <div className="mt-2 overflow-hidden rounded-lg border border-[var(--color-border-subtle)]">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-[var(--color-border-subtle)]">
              {steps.map((s, i) => (
                <tr key={i} className="align-top">
                  <td className="w-1/3 px-3 py-2 text-slate-300">{s.label}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">{s.formula}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-100">{s.result}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
