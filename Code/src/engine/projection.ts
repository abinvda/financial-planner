import type {
  Account,
  AppSettings,
  Member,
  ScenarioEvent,
  TaxProfile,
} from "../types";
import { HOUSEHOLD } from "../types";
import { monthLabel, toUsd } from "../lib/util";
import { computeMemberSummary, type MemberSummary } from "./memberFinance";
import { amortize } from "./loan";

export type AssetCategory = "Cash" | "Retirement" | "HSA" | "Brokerage" | "Other";

export function categoryOf(type: Account["type"]): AssetCategory {
  switch (type) {
    case "checking":
    case "savings":
      return "Cash";
    case "401k":
    case "403b":
      return "Retirement";
    case "hsa":
      return "HSA";
    case "brokerage":
      return "Brokerage";
    default:
      return "Other";
  }
}

export interface ProjectionPoint {
  month: number;
  label: string;
  assetsUsd: number;
  debtUsd: number;
  netWorthUsd: number;
  cashUsd: number;
  categories: Record<AssetCategory, number>;
  perMemberNet: Record<string, number>;
}

export interface ProjectionResult {
  points: ProjectionPoint[];
  summaries: MemberSummary[];
}

interface AccountTrack {
  memberId: string;
  category: AssetCategory;
  balance: number;
  monthlyGrowth: number;
  taxable: boolean;
  marginalRate: number;
  isCash: boolean;
  isRetirement: boolean;
  isHsa: boolean;
}

function monthlyRate(annualPct: number): number {
  return Math.pow(1 + annualPct / 100, 1 / 12) - 1;
}

export interface ProjectionOptions {
  months?: number;
  scenarioEvents?: ScenarioEvent[];
  /** Restrict to a single member id, or project the whole household. */
  scope?: string;
}

export function projectHousehold(
  members: Member[],
  tax: TaxProfile,
  settings: AppSettings,
  opts: ProjectionOptions = {},
): ProjectionResult {
  const months = opts.months ?? settings.projectionMonths;
  const fx = settings.usdInrFxRate;
  const scoped =
    opts.scope && opts.scope !== HOUSEHOLD
      ? members.filter((m) => m.id === opts.scope)
      : members;

  const summaries = scoped.map((m) => computeMemberSummary(m, tax, fx));
  const summaryById = new Map(summaries.map((s) => [s.memberId, s]));

  // Build account tracks per member.
  const tracks: AccountTrack[] = [];
  const cashTrackByMember = new Map<string, AccountTrack>();
  const retirementTrackByMember = new Map<string, AccountTrack>();
  const hsaTrackByMember = new Map<string, AccountTrack>();

  for (const member of scoped) {
    const summary = summaryById.get(member.id)!;
    let primaryCash: AccountTrack | undefined;
    for (const acc of member.accounts) {
      const track: AccountTrack = {
        memberId: member.id,
        category: categoryOf(acc.type),
        balance: toUsd(acc.balance, acc.currency, fx),
        monthlyGrowth: monthlyRate(acc.annualGrowthPct),
        taxable: acc.taxableGrowth,
        marginalRate: summary.tax.marginalRate,
        isCash: acc.type === "checking" || acc.type === "savings",
        isRetirement: acc.type === "401k" || acc.type === "403b",
        isHsa: acc.type === "hsa",
      };
      tracks.push(track);
      if (track.isCash && (acc.isPrimaryCash || !primaryCash)) primaryCash = track;
      if (track.isRetirement && !retirementTrackByMember.has(member.id))
        retirementTrackByMember.set(member.id, track);
      if (track.isHsa && !hsaTrackByMember.has(member.id))
        hsaTrackByMember.set(member.id, track);
    }
    if (primaryCash) cashTrackByMember.set(member.id, primaryCash);
  }

  // Loan balance schedules (USD) per member.
  const loanScheduleUsd: { memberId: string; balances: number[] }[] = [];
  for (const member of scoped) {
    for (const loan of member.loans) {
      const res = amortize(loan);
      const rate = loan.fxRate ?? fx;
      const balances = res.months.map((mm) => toUsd(mm.balance, loan.currency, rate));
      loanScheduleUsd.push({ memberId: member.id, balances });
    }
  }
  const loanStartUsd = scoped.reduce(
    (s, m) =>
      s +
      m.loans.reduce(
        (ss, l) => ss + toUsd(l.principal, l.currency, l.fxRate ?? fx),
        0,
      ),
    0,
  );

  function debtAtMonth(month: number): { total: number; byMember: Record<string, number> } {
    const byMember: Record<string, number> = {};
    let total = 0;
    for (const sched of loanScheduleUsd) {
      // month is 1-based; schedule index 0 = after month 1.
      const idx = month - 1;
      const bal =
        idx < 0
          ? sched.balances[0] // shouldn't happen; month starts at 0 handled separately
          : idx < sched.balances.length
            ? sched.balances[idx]
            : 0;
      byMember[sched.memberId] = (byMember[sched.memberId] ?? 0) + bal;
      total += bal;
    }
    return { total, byMember };
  }

  const start = new Date();
  const points: ProjectionPoint[] = [];
  const events = (opts.scenarioEvents ?? []).filter((e) => e.enabled);

  const buildPoint = (month: number): ProjectionPoint => {
    const categories: Record<AssetCategory, number> = {
      Cash: 0,
      Retirement: 0,
      HSA: 0,
      Brokerage: 0,
      Other: 0,
    };
    const perMemberAssets: Record<string, number> = {};
    let assets = 0;
    for (const t of tracks) {
      categories[t.category] += t.balance;
      perMemberAssets[t.memberId] = (perMemberAssets[t.memberId] ?? 0) + t.balance;
      assets += t.balance;
    }

    const debt =
      month === 0
        ? { total: loanStartUsd, byMember: memberDebtStart() }
        : debtAtMonth(month);

    const perMemberNet: Record<string, number> = {};
    for (const m of scoped) {
      perMemberNet[m.id] =
        (perMemberAssets[m.id] ?? 0) - (debt.byMember[m.id] ?? 0);
    }

    return {
      month,
      label: month === 0 ? "Now" : monthLabel(start, month),
      assetsUsd: assets,
      debtUsd: debt.total,
      netWorthUsd: assets - debt.total,
      cashUsd: categories.Cash,
      categories,
      perMemberNet,
    };
  };

  function memberDebtStart(): Record<string, number> {
    const byMember: Record<string, number> = {};
    for (const m of scoped) {
      byMember[m.id] = m.loans.reduce(
        (s, l) => s + toUsd(l.principal, l.currency, l.fxRate ?? fx),
        0,
      );
    }
    return byMember;
  }

  // Month 0 snapshot (current state).
  points.push(buildPoint(0));

  for (let month = 1; month <= months; month++) {
    // 1) Grow existing balances.
    for (const t of tracks) {
      const gain = t.balance * t.monthlyGrowth;
      const netGain = t.taxable ? gain * (1 - t.marginalRate) : gain;
      t.balance += netGain;
    }

    // 2) Contributions per member.
    for (const member of scoped) {
      const s = summaryById.get(member.id)!;
      const retire = retirementTrackByMember.get(member.id);
      if (retire) retire.balance += (s.retirementAnnual + s.employerMatchAnnual) / 12;
      const hsa = hsaTrackByMember.get(member.id);
      if (hsa) hsa.balance += s.hsaAnnual / 12;

      const cash = cashTrackByMember.get(member.id);
      if (cash) {
        let flow = s.monthlySurplus;
        flow += s.lumpsByMonth[month] ?? 0;
        flow -= s.oneTimeByMonth[month] ?? 0;
        // Member-targeted scenario events.
        for (const e of events) {
          if (e.target !== member.id) continue;
          flow += eventFlow(e, month);
        }
        cash.balance += flow;
      }
    }

    // 3) Household-targeted scenario events -> largest cash track (fallback: any).
    for (const e of events) {
      if (e.target !== HOUSEHOLD) continue;
      const delta = eventFlow(e, month);
      if (delta === 0) continue;
      const target =
        [...cashTrackByMember.values()].sort((a, b) => b.balance - a.balance)[0] ??
        tracks[0];
      if (target) target.balance += delta;
    }

    points.push(buildPoint(month));
  }

  return { points, summaries };
}

/** Cash-flow contribution of a scenario event at a given month (USD). */
function eventFlow(e: ScenarioEvent, month: number): number {
  switch (e.type) {
    case "one_time_expense":
      return month === e.month ? -Math.abs(e.amountUsd) : 0;
    case "windfall":
      return month === e.month ? Math.abs(e.amountUsd) : 0;
    case "recurring_expense":
      return month >= e.month ? -Math.abs(e.amountUsd) : 0;
    case "income_delta":
      return month >= e.month ? e.amountUsd : 0;
    default:
      return 0;
  }
}
