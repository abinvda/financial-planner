import type { Account, Member } from "../types";
import { toUsd } from "../lib/util";
import type { MemberSummary } from "./memberFinance";

export interface EmergencyFundStatus {
  liquidUsd: number;
  monthlyEssentialUsd: number;
  targetMonths: number;
  targetUsd: number;
  coverageMonths: number;
  shortfallUsd: number;
  onTrack: boolean;
}

/** Liquid = checking + savings (cash you can reach quickly). */
export function liquidCashUsd(accounts: Account[], fx: number): number {
  return accounts
    .filter((a) => a.type === "checking" || a.type === "savings")
    .reduce((s, a) => s + toUsd(a.balance, a.currency, fx), 0);
}

export function emergencyFundStatus(
  members: Member[],
  summaries: MemberSummary[],
  targetMonths: number,
  fx: number,
): EmergencyFundStatus {
  const liquidUsd = members.reduce((s, m) => s + liquidCashUsd(m.accounts, fx), 0);
  const monthlyEssentialUsd = summaries.reduce(
    (s, sm) => s + sm.monthlyEssentialExpensesUsd + sm.loanPaymentsMonthlyUsd,
    0,
  );
  const targetUsd = monthlyEssentialUsd * targetMonths;
  const coverageMonths =
    monthlyEssentialUsd > 0 ? liquidUsd / monthlyEssentialUsd : 0;
  const shortfallUsd = Math.max(0, targetUsd - liquidUsd);
  return {
    liquidUsd,
    monthlyEssentialUsd,
    targetMonths,
    targetUsd,
    coverageMonths,
    shortfallUsd,
    onTrack: liquidUsd >= targetUsd,
  };
}
