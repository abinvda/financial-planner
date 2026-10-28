import { useMemo, type ReactNode } from "react";
import {
  Button,
  Card,
  Field,
  NumberInput,
  PageHeader,
  Select,
  StatCard,
  TextInput,
} from "../components/ui";
import { MathSteps } from "../components/MathSteps";
import { ProjectionChart } from "../components/ProjectionChart";
import { useActiveUser, useActiveSummary, useFutureSummary } from "../hooks";
import { useStore } from "../store";
import {
  annualInvestingCapacity,
  investedAssetsUsd,
  investingBreakdown,
  projectRetirement,
  type InvestingBreakdown,
} from "../engine";
import { DEFAULT_RETIREMENT, type AccountType, type RetirementPlan } from "../types";
import { formatUsd, uid } from "../lib/util";

const ACCOUNT_TYPES: AccountType[] = [
  "checking",
  "savings",
  "brokerage",
  "401k",
  "403b",
  "hsa",
  "other",
];

export default function Retirement() {
  const user = useActiveUser();
  const summary = useActiveSummary();
  const futureSummary = useFutureSummary();
  const fx = useStore((s) => s.settings.usdInrFxRate);
  const updateMember = useStore((s) => s.updateMember);
  const addItem = useStore((s) => s.addItem);
  const updateItem = useStore((s) => s.updateItem);
  const removeItem = useStore((s) => s.removeItem);

  const plan: RetirementPlan = user.retirement ?? DEFAULT_RETIREMENT;
  const patchPlan = (p: Partial<RetirementPlan>) =>
    updateMember(user.id, { retirement: { ...plan, ...p } });

  const invested = useMemo(() => investedAssetsUsd(user.accounts, fx), [user.accounts, fx]);
  const breakdown = useMemo(() => investingBreakdown(summary), [summary]);
  const budgetContribution = breakdown.total;
  const annualContribution = plan.annualSavingsUsd ?? Math.round(budgetContribution);
  const futureContribution = useMemo(
    () =>
      user.futureStage && futureSummary
        ? {
            annualContribution: annualInvestingCapacity(futureSummary),
            startInYears: user.futureStage.startInYears,
          }
        : undefined,
    [user.futureStage, futureSummary],
  );

  const derivedSpending = Math.round(summary.monthlyExpensesUsd * 12);
  const annualSpending = plan.annualSpendingUsd ?? derivedSpending;

  const baseInput = useMemo(
    () => ({
      currentAge: plan.currentAge,
      retireAge: plan.retireAge,
      currentInvested: invested,
      annualContribution,
      realReturnPct: plan.realReturnPct,
      withdrawalRatePct: plan.withdrawalRatePct,
      annualSpending,
      futureContribution,
    }),
    [plan, invested, annualContribution, annualSpending, futureContribution],
  );

  const result = useMemo(() => projectRetirement(baseInput), [baseInput]);

  return (
    <div>
      <PageHeader
        title={`${user.name}'s retirement`}
        description="How much is enough, and when can you stop? Uses your Budget savings and account balances. All figures are in today's dollars (use a real, after-inflation return)."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="FIRE number" value={formatUsd(result.fireNumber, { compact: true })} sub={`${formatUsd(annualSpending, { compact: true })}/yr ÷ ${plan.withdrawalRatePct}%`} />
        <StatCard
          label="Coast FIRE"
          value={formatUsd(result.coastNumber, { compact: true })}
          sub={
            result.alreadyCoasting
              ? "reached — you can coast"
              : result.yearsToCoast !== null
                ? `${Math.round(result.coastProgress * 100)}% · reach at age ${result.ageAtCoast}`
                : `${Math.round(result.coastProgress * 100)}% there`
          }
          tone={result.alreadyCoasting ? "good" : "warn"}
        />
        <StatCard
          label="Financially independent"
          value={result.yearsToFI !== null ? `age ${result.ageAtFI}` : "—"}
          sub={result.yearsToFI !== null ? `in ${result.yearsToFI} years` : "not at these inputs"}
          tone={result.yearsToFI !== null && result.ageAtFI! <= plan.retireAge ? "good" : "default"}
        />
        <StatCard label={`Balance at ${plan.retireAge}`} value={formatUsd(result.balanceAtRetire, { compact: true })} sub={result.reachesFireByRetireAge ? "clears your FIRE number" : "short of FIRE number"} tone={result.reachesFireByRetireAge ? "good" : "warn"} />
      </div>

      <ContributionCard
        breakdown={breakdown}
        iraType={summary.iraType}
        custom={plan.annualSavingsUsd}
        projectionAmount={annualContribution}
      />

      <Card
        className="mt-4"
        title="Your trajectory"
        subtitle="Green = portfolio if you keep saving. Purple = if you stopped contributing today (it can rise above the FIRE line — that's growth, not a higher Coast target). Cyan = Coast FIRE dollars needed today; amber = full FIRE nest egg."
      >
        <ProjectionChart points={result.points} fireNumber={result.fireNumber} coastNumber={result.coastNumber} retireAge={plan.retireAge} ageAtFI={result.ageAtFI} ageAtCoast={result.ageAtCoast} />
        <Insight result={result} />
        <MathSteps steps={result.steps} />
      </Card>

      <Card className="mt-4" title="Assumptions" subtitle="Retirement age, expected real return and the safe-withdrawal rate are yours to set.">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Field label="Current age">
            <NumberInput step={1} value={plan.currentAge} onChange={(e) => patchPlan({ currentAge: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Target retirement age">
            <NumberInput step={1} value={plan.retireAge} onChange={(e) => patchPlan({ retireAge: Math.max(plan.currentAge + 1, +e.target.value) })} />
          </Field>
          <Field label="Real return %/yr" hint="After inflation, e.g. 5">
            <NumberInput step={1} value={plan.realReturnPct} onChange={(e) => patchPlan({ realReturnPct: +e.target.value })} />
          </Field>
          <Field label="Safe withdrawal rate %" hint="The 4% rule → 25× spending">
            <NumberInput step={0.5} value={plan.withdrawalRatePct} onChange={(e) => patchPlan({ withdrawalRatePct: Math.max(0.1, +e.target.value) })} />
          </Field>
          <Field label="Retirement spending / yr" hint={`Budget suggests ${formatUsd(derivedSpending, { compact: true })}`}>
            <NumberInput value={annualSpending} onChange={(e) => patchPlan({ annualSpendingUsd: +e.target.value })} />
          </Field>
          <Field label="Annual savings (invested)" hint={`≈ ${formatUsd(annualContribution / 12)}/mo`}>
            <NumberInput value={annualContribution} onChange={(e) => patchPlan({ annualSavingsUsd: Math.max(0, +e.target.value) })} />
          </Field>
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
          {plan.annualSavingsUsd !== undefined ? (
            <>
              <span>Using a custom savings amount.</span>
              <button className="font-medium text-indigo-300 hover:text-indigo-200" onClick={() => patchPlan({ annualSavingsUsd: undefined })}>
                Reset to Budget ({formatUsd(budgetContribution, { compact: true })}/yr)
              </button>
            </>
          ) : (
            <span>From your Budget: <span className="font-semibold text-slate-300">{formatUsd(budgetContribution)}/yr</span> (401k/403b + match + IRA + HSA + leftover you invest). Edit the field above to simulate saving more or less.</span>
          )}
          {futureContribution && (
            <span>After becoming {user.futureStage!.label.toLowerCase()} in {futureContribution.startInYears} yrs, capacity jumps to <span className="font-semibold text-slate-300">{formatUsd(futureContribution.annualContribution)}/yr</span>.</span>
          )}
        </p>
      </Card>

      <Card className="mt-4" title="Investments" subtitle="Balances that fund retirement. Checking is treated as cash and excluded.">
        <div className="hidden gap-3 px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:grid sm:grid-cols-[2fr_1fr_1.2fr_auto]">
          <span>Account</span>
          <span>Balance</span>
          <span>Type</span>
          <span />
        </div>
        {user.accounts.map((a) => (
          <div key={a.id} className="grid grid-cols-1 items-center gap-2 px-1 py-2 sm:grid-cols-[2fr_1fr_1.2fr_auto] sm:gap-3">
            <TextInput value={a.name} onChange={(e) => updateItem(user.id, "accounts", a.id, { name: e.target.value })} />
            <NumberInput value={a.balance} onChange={(e) => updateItem(user.id, "accounts", a.id, { balance: +e.target.value })} />
            <Select value={a.type} onChange={(e) => updateItem(user.id, "accounts", a.id, { type: e.target.value as AccountType })}>
              {ACCOUNT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Button variant="danger" onClick={() => removeItem(user.id, "accounts", a.id)}>✕</Button>
          </div>
        ))}
        <div className="mt-3 flex items-center justify-between">
          <Button variant="subtle" onClick={() => addItem(user.id, "accounts", { id: uid("acct"), name: "New account", type: "brokerage", balance: 0, currency: "USD", annualGrowthPct: 7, taxableGrowth: false })}>
            + Add account
          </Button>
          <p className="text-xs text-slate-400">Invested total: <span className="font-semibold text-slate-200">{formatUsd(invested)}</span></p>
        </div>
      </Card>

      <Card className="mt-4" title="Career stage" subtitle="A future pay jump changes how fast you can save. Model your higher-income phase here.">
        {user.futureStage ? (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Field label="Label">
                <TextInput value={user.futureStage.label} onChange={(e) => updateMember(user.id, { futureStage: { ...user.futureStage!, label: e.target.value } })} />
              </Field>
              <Field label="Future income / yr">
                <NumberInput value={user.futureStage.annualGrossUsd} onChange={(e) => updateMember(user.id, { futureStage: { ...user.futureStage!, annualGrossUsd: +e.target.value } })} />
              </Field>
              <Field label="Starts in (years)">
                <NumberInput step={1} value={user.futureStage.startInYears} onChange={(e) => updateMember(user.id, { futureStage: { ...user.futureStage!, startInYears: Math.max(0, +e.target.value) } })} />
              </Field>
            </div>
            {futureSummary && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MiniStat label="Now: income" value={formatUsd(summary.grossAnnualUsd, { compact: true })} />
                <MiniStat label="Now: can save" value={`${formatUsd(annualContribution, { compact: true })}/yr`} />
                <MiniStat label={`${user.futureStage.label}: income`} value={formatUsd(futureSummary.grossAnnualUsd, { compact: true })} />
                <MiniStat label={`${user.futureStage.label}: can save`} value={`${formatUsd(annualInvestingCapacity(futureSummary), { compact: true })}/yr`} />
              </div>
            )}
            <div className="mt-3">
              <Button variant="ghost" onClick={() => updateMember(user.id, { futureStage: undefined })}>Remove future stage</Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-400">No future stage set. Add one to model a future pay jump.</p>
            <Button variant="subtle" onClick={() => updateMember(user.id, { futureStage: { label: "Higher income", annualGrossUsd: Math.round(summary.grossAnnualUsd * 2), startInYears: 3 } })}>
              + Add future stage
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}

function Insight({ result }: { result: ReturnType<typeof projectRetirement> }) {
  const tone = result.alreadyCoasting
    ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
    : result.reachesFireByRetireAge
      ? "border-indigo-400/40 bg-indigo-500/10 text-indigo-200"
      : "border-amber-400/40 bg-amber-500/10 text-amber-200";

  return (
    <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      {result.alreadyCoasting ? (
        <>
          <span className="font-semibold">You've hit Coast FIRE.</span> Your invested balance alone should grow into your FIRE
          number by age {result.yearsToFI !== null ? result.ageAtFI : "your target"} even if you never invest another dollar — so new savings just let you retire sooner.
        </>
      ) : result.reachesFireByRetireAge ? (
        <>
          <span className="font-semibold">On track.</span> Keep saving and you reach your {formatUsd(result.fireNumber, { compact: true })} FIRE number
          {result.yearsToFI !== null ? <> around age {result.ageAtFI}</> : null}. You're {Math.round(result.coastProgress * 100)}% of the way to Coast FIRE (the point where you could stop saving entirely).
        </>
      ) : (
        <>
          <span className="font-semibold">Not there yet.</span> At these inputs you don't reach the {formatUsd(result.fireNumber, { compact: true })} FIRE
          number by age {result.yearsToFI !== null ? result.ageAtFI : "your target"}. Raising savings, return, or retirement age — or trimming retirement spending — closes the gap.
        </>
      )}
    </div>
  );
}

function ContributionCard({
  breakdown,
  iraType,
  custom,
  projectionAmount,
}: {
  breakdown: InvestingBreakdown;
  iraType: "traditional" | "roth";
  custom?: number;
  projectionAmount: number;
}) {
  const iraLabel = `${iraType === "roth" ? "Roth" : "Traditional"} IRA`;
  const parts = [
    { label: "401(k) / 403(b)", amount: breakdown.retirement, color: "#818cf8" },
    { label: "Employer match", amount: breakdown.employerMatch, color: "#34d399" },
    { label: iraLabel, amount: breakdown.ira, color: "#22d3ee" },
    { label: "HSA", amount: breakdown.hsa, color: "#2dd4bf" },
    { label: "Extra invested (taxable)", amount: breakdown.taxableExtra, color: "#94a3b8" },
  ].filter((p) => p.amount > 0.5);
  const total = breakdown.total;

  return (
    <Card
      className="mt-4"
      title="What you're putting toward retirement"
      subtitle="Straight from your Budget. Everything you save — 401k/403b, the employer match, your IRA, HSA, and any leftover you invest — adds up to your yearly total."
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-3xl font-bold tabular-nums text-emerald-300">
          {formatUsd(total)}
          <span className="ml-1 text-base font-medium text-slate-400">/yr</span>
        </p>
        <p className="text-sm text-slate-400">≈ {formatUsd(total / 12)}/mo invested</p>
      </div>

      {total > 0 ? (
        <>
          <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full bg-white/5">
            {parts.map((p) => (
              <div key={p.label} style={{ width: `${(p.amount / total) * 100}%`, backgroundColor: p.color }} />
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {parts.map((p) => (
              <div key={p.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
                  {p.label}
                </span>
                <span className="tabular-nums font-medium text-slate-100">{formatUsd(p.amount)}/yr</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-400">
          You aren't investing anything yet. Add 401k/403b, IRA or HSA contributions in the Budget, or free up some monthly surplus.
        </p>
      )}

      {custom !== undefined && (
        <p className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          The projection below is using a custom savings amount of{" "}
          <span className="font-semibold">{formatUsd(projectionAmount)}/yr</span>, not this budget total. Reset it under Assumptions to use the breakdown above.
        </p>
      )}
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}
