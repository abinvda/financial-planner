import { useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, PageHeader, cn } from "../components/ui";
import { useActiveUser, useActiveSummary, useFutureSummary } from "../hooks";
import { useStore } from "../store";
import {
  annualInvestingCapacity,
  emergencyFundStatus,
  investedAssetsUsd,
  projectRetirement,
} from "../engine";
import { DEFAULT_RETIREMENT } from "../types";
import { formatUsd, formatPct, toUsd } from "../lib/util";

type Status = "good" | "warn" | "bad" | "neutral";

interface Metric {
  key: string;
  label: string;
  status: Status;
  value: string;
  detail: string;
  action: ReactNode;
  /** Plain-English breakdown of exactly how `value` was computed. */
  basis?: { label: string; value: string }[];
}

const STATUS_LABEL: Record<Status, string> = {
  good: "On track",
  warn: "Could be better",
  bad: "Needs attention",
  neutral: "FYI",
};

const DOT: Record<Status, string> = {
  good: "bg-emerald-400",
  warn: "bg-amber-400",
  bad: "bg-rose-400",
  neutral: "bg-slate-400",
};

const PILL: Record<Status, string> = {
  good: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  bad: "border-rose-400/40 bg-rose-500/10 text-rose-300",
  neutral: "border-slate-500/40 bg-slate-500/10 text-slate-300",
};

export default function Health() {
  const user = useActiveUser();
  const summary = useActiveSummary();
  const futureSummary = useFutureSummary();
  const fx = useStore((s) => s.settings.usdInrFxRate);
  const emergencyFundMonths = useStore((s) => s.settings.emergencyFundMonths);

  const data = useMemo(() => {
    const invested = investedAssetsUsd(user.accounts, fx);
    const totalAssets = user.accounts.reduce((s, a) => s + toUsd(a.balance, a.currency, fx), 0);
    const totalDebt = user.loans.reduce((s, l) => s + toUsd(l.principal, l.currency, l.fxRate ?? fx), 0);
    const netWorth = totalAssets - totalDebt;

    const ef = emergencyFundStatus([user], [summary], emergencyFundMonths, fx);

    // Retirement projection (mirrors the Retirement tab defaults).
    const plan = user.retirement ?? DEFAULT_RETIREMENT;
    const capacity = annualInvestingCapacity(summary);
    const annualContribution = plan.annualSavingsUsd ?? Math.round(capacity);
    const annualSpending = plan.annualSpendingUsd ?? Math.round(summary.monthlyExpensesUsd * 12);
    const futureContribution =
      user.futureStage && futureSummary
        ? { annualContribution: annualInvestingCapacity(futureSummary), startInYears: user.futureStage.startInYears }
        : undefined;
    const ret = projectRetirement({
      currentAge: plan.currentAge,
      retireAge: plan.retireAge,
      currentInvested: invested,
      annualContribution,
      realReturnPct: plan.realReturnPct,
      withdrawalRatePct: plan.withdrawalRatePct,
      annualSpending,
      futureContribution,
    });

    // Employer-match capture: rough rule — to capture the match you generally
    // must contribute at least that % of pay.
    const matchPct = user.deductions.employerMatchPct;
    const requiredForMatch = matchPct * summary.grossAnnualUsd;
    const contributing = user.deductions.retirementAnnual;

    // Worst high-interest debt (rate at/above a typical market return).
    const highRateLoans = user.loans
      .filter((l) => l.annualRatePct >= 6)
      .sort((a, b) => b.annualRatePct - a.annualRatePct);

    return {
      invested,
      netWorth,
      totalDebt,
      ef,
      ret,
      matchPct,
      requiredForMatch,
      contributing,
      highRateLoans,
      plan,
      annualContribution,
      annualSpending,
    };
  }, [user, summary, futureSummary, fx, emergencyFundMonths]);

  const metrics: Metric[] = [];

  // 1. Emergency fund
  {
    const { coverageMonths, targetMonths, shortfallUsd, onTrack, liquidUsd, monthlyEssentialUsd, targetUsd } = data.ef;
    const status: Status = onTrack ? "good" : coverageMonths >= targetMonths / 2 ? "warn" : "bad";
    metrics.push({
      key: "ef",
      label: "Emergency fund",
      status,
      value: `${coverageMonths.toFixed(1)} mo`,
      detail: `You have enough cash to cover ${coverageMonths.toFixed(1)} months of essentials. Aim for ${targetMonths}.`,
      action: onTrack
        ? "You're covered — nice safety net."
        : `Build up ${formatUsd(shortfallUsd)} more in savings before investing extra.`,
      basis: [
        { label: "Cash savings (checking + savings)", value: formatUsd(liquidUsd) },
        { label: "Essential spend / mo (needs + loan payments)", value: `${formatUsd(monthlyEssentialUsd)}/mo` },
        {
          label: "Months covered = savings ÷ essentials",
          value: `${formatUsd(liquidUsd)} ÷ ${formatUsd(monthlyEssentialUsd)} = ${coverageMonths.toFixed(1)} mo`,
        },
        { label: `Target (${targetMonths} months)`, value: formatUsd(targetUsd) },
      ],
    });
  }

  // 2. Savings rate
  {
    const rate = summary.savingsRate;
    const status: Status = rate >= 0.2 ? "good" : rate >= 0.1 ? "warn" : "bad";
    const monthlyTakeHome = summary.takeHomeAnnual / 12;
    const monthlyContrib = (summary.retirementAnnual + summary.hsaAnnual) / 12;
    const monthlySaved = Math.max(0, summary.monthlySurplus) + monthlyContrib;
    const denom = monthlyTakeHome + monthlyContrib;
    metrics.push({
      key: "savings",
      label: "Savings rate",
      status,
      value: formatPct(rate),
      detail: `You keep about ${formatPct(rate)} of your take-home (including retirement + HSA). A common target is 15–20%.`,
      action:
        rate >= 0.2
          ? "Great — you're saving a healthy share."
          : "Trim a 'want' or bump your 403(b) to push this toward 20%.",
      basis: [
        { label: "Take-home / mo", value: `${formatUsd(monthlyTakeHome)}/mo` },
        { label: "You save / mo (leftover + 403b + HSA)", value: `${formatUsd(monthlySaved)}/mo` },
        {
          label: "Rate = saved ÷ (take-home + contributions)",
          value: `${formatUsd(monthlySaved)} ÷ ${formatUsd(denom)} = ${formatPct(rate)}`,
        },
      ],
    });
  }

  // 3. Employer match (free money)
  {
    if (data.matchPct <= 0) {
      metrics.push({
        key: "match",
        label: "Employer match",
        status: "neutral",
        value: "None offered",
        detail: "No employer retirement match is set for you.",
        action: "If your job offers one, add it in Budget → Pre-tax contributions.",
      });
    } else {
      const capturing = data.contributing >= data.requiredForMatch - 1;
      metrics.push({
        key: "match",
        label: "Employer match",
        status: capturing ? "good" : "bad",
        value: `${formatUsd(summary.employerMatchAnnual)}/yr`,
        detail: capturing
          ? "You're contributing enough to capture the full match — that's free money."
          : `You may be leaving free money on the table. To grab the full match, contribute about ${formatUsd(data.requiredForMatch)}/yr.`,
        action: capturing ? "Fully captured. Keep it up." : "Raise your retirement contribution to at least the match threshold.",
        basis: [
          { label: `Employer match (${formatPct(data.matchPct)} of pay)`, value: `${formatUsd(summary.employerMatchAnnual)}/yr` },
          { label: "You contribute (401k/403b)", value: `${formatUsd(data.contributing)}/yr` },
          { label: "Needed for the full match", value: `${formatUsd(data.requiredForMatch)}/yr` },
        ],
      });
    }
  }

  // 4. High-interest debt
  {
    const worst = data.highRateLoans[0];
    metrics.push({
      key: "debt",
      label: "High-interest debt",
      status: worst ? (worst.annualRatePct >= 8 ? "bad" : "warn") : "good",
      value: worst ? `${worst.annualRatePct}%` : "None",
      detail: worst
        ? `${worst.name} charges ${worst.annualRatePct}% — likely more than investments earn.`
        : "No debt above ~6%. Good place to be.",
      action: worst
        ? "Consider paying this down aggressively before extra investing."
        : "Nothing urgent to pay down.",
      basis: worst
        ? data.highRateLoans.map((l) => ({
            label: `${l.name} (${l.annualRatePct}%)`,
            value: `${formatUsd(toUsd(l.principal, l.currency, l.fxRate ?? fx))} balance`,
          }))
        : [{ label: "Loans charging 6% or more", value: "None" }],
    });
  }

  // 5. Retirement on track
  {
    const { ret, plan } = data;
    const onTrack = ret.reachesFireByRetireAge || (ret.ageAtFI !== null && ret.ageAtFI <= plan.retireAge);
    const status: Status = ret.alreadyCoasting ? "good" : onTrack ? "good" : ret.ageAtFI !== null ? "warn" : "bad";
    metrics.push({
      key: "retire",
      label: "Retirement",
      status,
      value: ret.ageAtFI !== null ? `FI at ${ret.ageAtFI}` : "Not yet",
      detail: ret.alreadyCoasting
        ? "You've hit Coast FIRE — savings so far should grow into your number on their own."
        : ret.ageAtFI !== null
          ? `At today's saving pace you reach your ${formatUsd(ret.fireNumber, { compact: true })} number around age ${ret.ageAtFI}.`
          : "At these inputs you don't reach your number within the projection.",
      action: onTrack ? "On pace for your target age." : "Open Retirement to try saving more or adjusting your target.",
      basis: [
        {
          label: "FIRE number = spending ÷ withdrawal rate",
          value: `${formatUsd(data.annualSpending)} ÷ ${plan.withdrawalRatePct}% = ${formatUsd(ret.fireNumber)}`,
        },
        { label: "Invested today", value: formatUsd(data.invested) },
        { label: "Investing now", value: `${formatUsd(data.annualContribution)}/yr` },
        { label: "Assumed real return", value: `${plan.realReturnPct}%/yr (after inflation)` },
      ],
    });
  }

  const goodCount = metrics.filter((m) => m.status === "good").length;
  const scored = metrics.filter((m) => m.status !== "neutral").length;
  const bad = metrics.some((m) => m.status === "bad");
  const warn = metrics.some((m) => m.status === "warn");
  const overallTone: Status = bad ? "bad" : warn ? "warn" : "good";
  const overallText = bad
    ? "A couple of things need your attention — see the red cards below."
    : warn
      ? "You're in decent shape, with a few things to tune up."
      : "You're in great shape across the board.";

  return (
    <div>
      <PageHeader
        title={`${user.name}'s money at a glance`}
        description="A plain-English checkup of your finances. Green is good, amber is worth a look, red needs attention. Each card tells you the one thing to do next."
      />

      <div className={cn("mb-4 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4", PILL[overallTone])}>
        <span className={cn("h-3 w-3 rounded-full", DOT[overallTone])} />
        <p className="text-sm font-semibold">
          {goodCount} of {scored} checks look good.
        </p>
        <p className="text-sm opacity-90">{overallText}</p>
      </div>

      {/* At a glance numbers */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Glance label="Take-home / mo" value={formatUsd(summary.takeHomeAnnual / 12)} sub="after taxes, 403(b) & HSA" />
        <Glance
          label="Left over / mo"
          value={formatUsd(summary.monthlySurplus)}
          tone={summary.monthlySurplus >= 0 ? "good" : "bad"}
          sub="take-home − expenses − loans"
        />
        <Glance label="Invested" value={formatUsd(data.invested, { compact: true })} sub="all accounts except checking" />
        <Glance
          label="Net worth"
          value={formatUsd(data.netWorth, { compact: true })}
          tone={data.netWorth >= 0 ? "default" : "bad"}
          sub="assets − debts"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {metrics.map((m) => (
          <HealthCard key={m.key} metric={m} />
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        <QuickLink to="/budget" label="Edit budget" />
        <QuickLink to="/decisions" label="Compare Roth vs. Traditional" />
        <QuickLink to="/retirement" label="Plan retirement" />
        <QuickLink to="/chat" label="Ask the assistant" />
      </div>
    </div>
  );
}

function HealthCard({ metric }: { metric: Metric }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2.5 w-2.5 rounded-full", DOT[metric.status])} />
          <h3 className="text-sm font-semibold text-slate-100">{metric.label}</h3>
        </div>
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", PILL[metric.status])}>
          {STATUS_LABEL[metric.status]}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tabular-nums text-slate-50">{metric.value}</p>
      <p className="mt-1 text-sm text-slate-400">{metric.detail}</p>
      {metric.basis && metric.basis.length > 0 && (
        <div className="mt-3 rounded-lg border border-[var(--color-border-subtle)] bg-black/20 px-3 py-2">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            How it's figured
          </p>
          <dl className="space-y-1">
            {metric.basis.map((b) => (
              <div key={b.label} className="flex items-baseline justify-between gap-3 text-xs">
                <dt className="text-slate-400">{b.label}</dt>
                <dd className="shrink-0 tabular-nums font-medium text-slate-200">{b.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
        <span className="font-semibold text-slate-200">Next: </span>
        {metric.action}
      </p>
    </Card>
  );
}

function Glance({ label, value, tone = "default", sub }: { label: string; value: string; tone?: "default" | "good" | "bad"; sub?: string }) {
  const c = tone === "good" ? "text-emerald-300" : tone === "bad" ? "text-rose-300" : "text-slate-100";
  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/70 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={cn("mt-1.5 text-xl font-semibold tabular-nums", c)}>{value}</p>
      {sub && <p className="mt-1 text-[11px] text-slate-500">{sub}</p>}
    </div>
  );
}

function QuickLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="rounded-lg border border-[var(--color-border-subtle)] px-3 py-1.5 font-medium text-slate-300 transition hover:bg-white/5 hover:text-slate-100"
    >
      {label} →
    </Link>
  );
}
