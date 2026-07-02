import type { Currency } from "../types";

/** Short unique id, safe for React keys and cross-session persistence. */
export function uid(prefix = "id"): string {
  const rand = Math.random().toString(36).slice(2, 8);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${time}${rand}`;
}

/** Convert an amount in `currency` to USD given INR-per-USD FX. */
export function toUsd(amount: number, currency: Currency, usdInrFxRate: number): number {
  if (currency === "USD") return amount;
  if (!usdInrFxRate) return amount;
  return amount / usdInrFxRate;
}

export function formatUsd(value: number, opts: { compact?: boolean } = {}): string {
  const abs = Math.abs(value);
  if (opts.compact && abs >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMoney(value: number, currency: Currency, compact = false): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatPct(fraction: number, digits = 1): string {
  return `${(fraction * 100).toFixed(digits)}%`;
}

/** Add `months` to a Date, returning a new Date (day clamped to 1). */
export function addMonths(base: Date, months: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth() + months, 1);
  return d;
}

export function monthLabel(base: Date, monthOffset: number): string {
  const d = addMonths(base, monthOffset);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
