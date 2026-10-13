import type { ReactNode, InputHTMLAttributes, SelectHTMLAttributes } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/80 p-5 shadow-lg shadow-black/20 backdrop-blur",
        className,
      )}
    >
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-100">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-400"
      : tone === "warn"
        ? "text-amber-400"
        : tone === "bad"
          ? "text-rose-400"
          : "text-slate-100";
  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/70 p-4">
      <div className="flex items-center gap-2">
        {accent && (
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          {label}
        </p>
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tabular-nums", toneClass)}>{value}</p>
      {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

export function Button({
  children,
  onClick,
  variant = "primary",
  type = "button",
  className,
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "subtle";
  type?: "button" | "submit";
  className?: string;
  disabled?: boolean;
  title?: string;
}) {
  const styles: Record<string, string> = {
    primary:
      "bg-indigo-500 hover:bg-indigo-400 text-white shadow shadow-indigo-500/30",
    ghost:
      "bg-transparent hover:bg-white/5 text-slate-200 border border-[var(--color-border-subtle)]",
    subtle: "bg-white/5 hover:bg-white/10 text-slate-200",
    danger: "bg-rose-500/90 hover:bg-rose-500 text-white",
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        styles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-canvas)]/60 px-3 py-1.5 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50",
        props.className,
      )}
    />
  );
}

export function NumberInput(
  props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">,
) {
  // Money fields dominate the app, so the spinner arrows default to steps of
  // 100. Non-dollar fields (ages, %, rates) override `step` explicitly.
  return <TextInput type="number" inputMode="decimal" step={100} {...props} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-canvas)]/60 px-3 py-1.5 text-sm text-slate-100 outline-none transition focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/50",
        props.className,
      )}
    />
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export function Badge({
  children,
  color,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{
        backgroundColor: color ? `${color}22` : "rgba(148,163,184,0.15)",
        color: color ?? "#cbd5e1",
      }}
    >
      {children}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border-subtle)] p-6 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-slate-400">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
