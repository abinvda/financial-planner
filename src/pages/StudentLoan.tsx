import { useMemo } from "react";
import { Badge, Button, Card, Field, NumberInput, PageHeader, Select } from "../components/ui";
import { MathSteps } from "../components/MathSteps";
import { LoanBalanceChart, type LoanSeries } from "../components/LoanBalanceChart";
import { useActiveUser, useActiveSummary, useFutureSummary } from "../hooks";
import { useStore } from "../store";
import { computeEmi, computeStudentLoanAnalysis, type InvestHedgeStrategy, type LoanStrategy } from "../engine";
import { formatUsd, formatPct, toUsd } from "../lib/util";
import type { StudentLoanPlan } from "../types";

/** 150% of the 2026 federal poverty line for a single-person household. */
const POVERTY_150_SINGLE = 23475;

const round50 = (x: number) => Math.round(x / 50) * 50;

const COLORS = {
  pslfWorks: "#f59e0b",
  pslfFails: "#fb7185",
  aggressiveFromAttending: "#818cf8",
  minimumForever: "#94a3b8",
  pslfHedgeInvest: "#2dd4bf",
} as const;

function fmtMonths(months: number | null): string {
  if (months == null) return "never";
  const y = Math.floor(months / 12);
  const mo = months % 12;
  if (y === 0) return `${mo} mo`;
  if (mo === 0) return `${y} yr`;
  return `${y}y ${mo}m`;
}

export default function StudentLoan() {
  const user = useActiveUser();
  const summary = useActiveSummary();
  const futureSummary = useFutureSummary();
  const fx = useStore((s) => s.settings.usdInrFxRate);
  const updateMember = useStore((s) => s.updateMember);

  const loanFacts = useMemo(() => {
    const loans = user.loans.filter((l) => l.kind === "student");
    const balance = loans.reduce((s, l) => s + toUsd(l.principal, l.currency, l.fxRate ?? fx), 0);
    const emi = loans.reduce((s, l) => s + toUsd(l.emi, l.currency, l.fxRate ?? fx), 0);
    const weightedRate = balance
      ? loans.reduce((s, l) => s + l.annualRatePct * toUsd(l.principal, l.currency, l.fxRate ?? fx), 0) / balance
      : 0;
    return { loans, balance, emi, rate: weightedRate };
  }, [user.loans, fx]);

  const monthsUntilAttending = Math.round((user.futureStage?.startInYears ?? 0) * 12);
  const attendingIncome = user.futureStage?.annualGrossUsd ?? summary.grossAnnualUsd;

  const plan: StudentLoanPlan = user.studentLoan ?? {};

  // Derived defaults (kept in sync with the Budget). Overrides live in `plan`.
  const idrResidentDefault = round50(loanFacts.emi || loanFacts.balance * 0.005);
  const idrAttendingDefault = round50(
    Math.max(idrResidentDefault, (0.1 * Math.max(0, attendingIncome - POVERTY_150_SINGLE)) / 12),
  );
  const residentSideInvestDefault = 400;
  const aggressiveAttendingDefault = round50(computeEmi(loanFacts.balance, loanFacts.rate, 48));

  const idrResidentMonthly = plan.idrResidentMonthly ?? idrResidentDefault;
  const idrAttendingMonthly = plan.idrAttendingMonthly ?? idrAttendingDefault;
  const residentSideInvestMonthly = plan.residentSideInvestMonthly ?? residentSideInvestDefault;
  const aggressiveAttendingMonthly = plan.aggressiveAttendingMonthly ?? aggressiveAttendingDefault;
  const forgivenessMonths = plan.forgivenessMonths ?? 120;
  const pursuePSLF = plan.pursuePSLF ?? true;
  const investReturnPct = plan.investReturnPct ?? 7;

  const patch = (p: Partial<StudentLoanPlan>) =>
    updateMember(user.id, { studentLoan: { ...plan, ...p } });

  const analysis = useMemo(
    () =>
      computeStudentLoanAnalysis({
        balance: loanFacts.balance,
        annualRatePct: loanFacts.rate,
        monthsUntilAttending,
        idrResidentMonthly,
        idrAttendingMonthly,
        residentSideInvestMonthly,
        aggressiveAttendingMonthly,
        forgivenessMonths,
        investReturnPct,
      }),
    [
      loanFacts.balance,
      loanFacts.rate,
      monthsUntilAttending,
      idrResidentMonthly,
      idrAttendingMonthly,
      residentSideInvestMonthly,
      aggressiveAttendingMonthly,
      forgivenessMonths,
      investReturnPct,
    ],
  );

  const attendingInvestGap = Math.max(0, aggressiveAttendingMonthly - idrAttendingMonthly);

  const chartSeries = useMemo<LoanSeries[]>(() => {
    const { pslfWorks, pslfFails, aggressiveFromAttending, minimumForever, pslfHedgeInvest } = analysis;
    const chartLen = Math.max(
      pslfFails.sim.balanceByMonth.length,
      aggressiveFromAttending.sim.balanceByMonth.length,
      minimumForever.sim.balanceByMonth.length,
      pslfHedgeInvest.sim.balanceByMonth.length,
      forgivenessMonths + 2,
    );
    const pad = (vals: number[], cutAfter?: number) =>
      Array.from({ length: chartLen }, (_, i) => {
        if (cutAfter !== undefined && i > cutAfter) return 0;
        return vals[i] ?? 0;
      });
    return [
      { label: "PSLF works (forgiven at 10y)", color: COLORS.pslfWorks, values: pad(pslfWorks.sim.balanceByMonth, forgivenessMonths) },
      { label: "PSLF denied", color: COLORS.pslfFails, values: pad(pslfFails.sim.balanceByMonth) },
      { label: "Minimums + invest (PSLF fails)", color: COLORS.pslfHedgeInvest, values: pad(pslfHedgeInvest.sim.balanceByMonth) },
      { label: "Minimums to the end", color: COLORS.minimumForever, values: pad(minimumForever.sim.balanceByMonth) },
      { label: "Aggressive once attending", color: COLORS.aggressiveFromAttending, values: pad(aggressiveFromAttending.sim.balanceByMonth) },
    ];
  }, [analysis, forgivenessMonths]);

  if (!loanFacts.loans.length || loanFacts.balance <= 0) {
    return (
      <div>
        <PageHeader
          title="Student loans"
          description="Compare repayment strategies — PSLF vs. paying it off — and see the interest at stake."
        />
        <Card>
          <p className="text-sm text-slate-300">
            {user.name} has no student loan on file. Add one in the{" "}
            <span className="font-semibold text-slate-100">Budget</span> tab (a loan with kind
            "student") and this page will model the payoff options automatically.
          </p>
        </Card>
      </div>
    );
  }

  const hasTraining = monthsUntilAttending > 0;

  return (
    <div>
      <PageHeader
        title={`${user.name}'s student loan`}
        description="What PSLF really means, and how much extra interest you'd pay if you bet on forgiveness and it falls through."
      />

      {/* Education: the PSLF play */}
      <Card title="The strategy your colleague described" subtitle="Public Service Loan Forgiveness (PSLF) in plain English.">
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            <span className="font-semibold text-slate-100">Public Service Loan Forgiveness</span> wipes
            out your remaining federal student-loan balance — tax-free — after{" "}
            <span className="font-semibold text-slate-100">120 qualifying monthly payments</span> (10
            years) while you work full-time for a non-profit or government employer. Most teaching
            hospitals qualify, so residents often make small{" "}
            <span className="font-semibold text-slate-100">income-driven (IDR)</span> payments for 10
            years and let the rest be forgiven.
          </p>
          <p>
            The catch: those 10 years count from when you <em>start qualifying payments</em>, and as a
            resident your IDR payment can be smaller than the monthly interest — so the balance{" "}
            <span className="font-semibold text-slate-100">grows</span> until forgiveness arrives. That's
            fine <em>if</em> forgiveness comes through. If it doesn't (job doesn't qualify, paperwork
            gaps, rule changes), you're left with a bigger balance and a decade of accrued interest.
          </p>
          <p>
            The comparison below models that risk for {user.name}: bet on PSLF, versus paying it off
            once the attending paycheck arrives, riding minimums to the end, or investing the gap as a
            hedge.
          </p>
        </div>
      </Card>

      {/* Career context */}
      <Card className="mt-4" title="Your situation" subtitle="Pulled from your Budget and career stage.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Loan balance" value={formatUsd(loanFacts.balance, { compact: true })} />
          <MiniStat label="Interest rate" value={formatPct(loanFacts.rate / 100)} />
          <MiniStat
            label={hasTraining ? "Attending income in" : "Current income"}
            value={hasTraining ? `${(monthsUntilAttending / 12).toFixed(0)} yr` : formatUsd(summary.grossAnnualUsd, { compact: true })}
          />
          <MiniStat
            label={hasTraining ? "Attending income" : "Marginal rate"}
            value={hasTraining ? formatUsd(attendingIncome, { compact: true }) : formatPct(summary.tax.marginalRate)}
          />
        </div>
        {hasTraining && (
          <p className="mt-3 text-xs text-slate-400">
            Today's income is {formatUsd(summary.grossAnnualUsd, { compact: true })}
            {futureSummary && <> (marginal rate {formatPct(summary.tax.marginalRate)})</>}; in about{" "}
            {(monthsUntilAttending / 12).toFixed(0)} years it jumps to {formatUsd(attendingIncome, { compact: true })}
            {futureSummary && <> (about {formatPct(futureSummary.tax.marginalRate)})</>}. Edit the
            training→attending timing on the <span className="font-medium text-slate-300">Retirement</span> tab.
          </p>
        )}
      </Card>

      {/* The headline answer */}
      <Card className="mt-4" title="If you bet on PSLF and it falls through" subtitle="Extra interest vs. paying hard once you're an attending.">
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">vs. paying hard as an attending</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-amber-100">
            +{formatUsd(analysis.extraInterestVsAttending, { compact: true })}
          </p>
          <p className="mt-1 text-xs text-slate-300">
            extra interest ({formatUsd(analysis.pslfFails.sim.interestPaid, { compact: true })} vs{" "}
            {formatUsd(analysis.aggressiveFromAttending.sim.interestPaid, { compact: true })}) — the cost of a
            decade of minimum payments if forgiveness never comes, compared to clearing it fast on attending income.
          </p>
        </div>
        <div className="mt-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <span className="font-semibold">The upside if PSLF does work:</span> you pay only{" "}
          {formatUsd(analysis.pslfWorks.outOfPocket, { compact: true })} in total and{" "}
          {formatUsd(analysis.pslfWorks.forgiven, { compact: true })} is forgiven tax-free — about{" "}
          {formatUsd(analysis.pslfSavingsVsAttending, { compact: true })} less than clearing it yourself as
          an attending. That's the gamble: a big win if it lands, {formatUsd(analysis.extraInterestVsAttending, { compact: true })}+
          of extra interest if it doesn't.
        </div>
        <MathSteps steps={analysis.steps} />
      </Card>

      {/* Save & invest hedge */}
      <Card
        className="mt-4"
        title="Save & invest while on minimums"
        subtitle="Invest what you can during training, then the full aggressive−minimum gap once attending. At year 10, if PSLF fails, dump the portfolio at the loan."
      >
        <div className="space-y-3 text-sm text-slate-300">
          <p>
            While you're on income-driven minimums, put spare cash into a brokerage instead of
            overpaying the loan. During training that's a modest fixed amount (
            {formatUsd(residentSideInvestMonthly)}/mo here) — not an aggressive loan payoff. Once
            you're an attending, invest the full gap between what you'd pay aggressively and your IDR
            minimum ({formatUsd(attendingInvestGap)}/mo). If PSLF fails at year{" "}
            {(forgivenessMonths / 12).toFixed(0)}, apply the portfolio as a lump-sum prepayment, then
            pay the aggressive amount ({formatUsd(aggressiveAttendingMonthly)}/mo) until the loan is gone.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-teal-400/30 bg-teal-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-300">Portfolio at year {(forgivenessMonths / 12).toFixed(0)}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-teal-100">
              {formatUsd(analysis.pslfHedgeInvest.hedge.portfolioAtForgiveness, { compact: true })}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              from {formatUsd(analysis.pslfHedgeInvest.hedge.totalInvested, { compact: true })} contributed
              ({formatUsd(residentSideInvestMonthly)}/mo training, then {formatUsd(attendingInvestGap)}/mo as attending, {investReturnPct}% return)
            </p>
          </div>
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-300">If PSLF fails</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-rose-100">
              {formatUsd(
                analysis.pslfHedgeInvest.outOfPocket + analysis.pslfHedgeInvest.hedge.lumpSumApplied,
                { compact: true },
              )}{" "}
              total to loan
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {formatUsd(analysis.pslfHedgeInvest.outOfPocket, { compact: true })} in payments +{" "}
              {formatUsd(analysis.pslfHedgeInvest.hedge.lumpSumApplied, { compact: true })} lump sum · net cost{" "}
              {formatUsd(
                analysis.pslfHedgeInvest.outOfPocket +
                  analysis.pslfHedgeInvest.hedge.totalInvested -
                  analysis.pslfHedgeInvest.hedge.portfolioRemaining,
                { compact: true },
              )}{" "}
              ({formatUsd(analysis.pslfHedgeInvest.hedge.portfolioRemaining, { compact: true })} still in portfolio) · paid off in{" "}
              {fmtMonths(analysis.pslfHedgeInvest.sim.payoffMonth)}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">If PSLF works</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-100">
              {formatUsd(analysis.pslfHedgeIfWorks.forgiven, { compact: true })} forgiven
            </p>
            <p className="mt-1 text-xs text-slate-400">
              plus you keep the {formatUsd(analysis.pslfHedgeIfWorks.hedge.portfolioAtForgiveness, { compact: true })} portfolio — best of both worlds
            </p>
          </div>
        </div>
      </Card>

      {/* Balance trajectories */}
      <Card className="mt-4" title="Balance over time" subtitle="Watch the PSLF balance climb (negative amortization) while the payoff paths fall to zero.">
        <LoanBalanceChart
          series={chartSeries}
          forgivenessMonth={forgivenessMonths}
          attendingMonth={hasTraining ? monthsUntilAttending : undefined}
        />
      </Card>

      {/* Strategies side by side */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ScenarioCard strategy={analysis.pslfWorks} color={COLORS.pslfWorks} tone="best" />
        <ScenarioCard strategy={analysis.pslfFails} color={COLORS.pslfFails} tone="risk" />
        <InvestScenarioCard strategy={analysis.pslfHedgeInvest} color={COLORS.pslfHedgeInvest} tone="hedge" />
        <ScenarioCard strategy={analysis.minimumForever} color={COLORS.minimumForever} tone="slow" />
        <ScenarioCard strategy={analysis.aggressiveFromAttending} color={COLORS.aggressiveFromAttending} />
      </div>

      {/* Editable assumptions */}
      <Card
        className="mt-4"
        title="Assumptions"
        subtitle="Balance and rate come from the Budget. Tweak the payments to match your real plan — changes are saved."
        actions={
          user.studentLoan ? (
            <Button variant="ghost" onClick={() => updateMember(user.id, { studentLoan: undefined })}>
              Reset to suggested
            </Button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="IDR / minimum — while training" hint={`Suggested ${formatUsd(idrResidentDefault)}/mo`}>
            <NumberInput value={idrResidentMonthly} onChange={(e) => patch({ idrResidentMonthly: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="IDR / minimum — as attending" hint={`~10% of discretionary income`}>
            <NumberInput value={idrAttendingMonthly} onChange={(e) => patch({ idrAttendingMonthly: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Forgiveness after (years)" hint="PSLF = 10 years of payments">
            <NumberInput step={1} value={forgivenessMonths / 12} onChange={(e) => patch({ forgivenessMonths: Math.max(1, Math.round(+e.target.value)) * 12 })} />
          </Field>
          <Field label="Side invest — while training" hint="Easy savings during residency (default $400/mo)">
            <NumberInput value={residentSideInvestMonthly} onChange={(e) => patch({ residentSideInvestMonthly: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Aggressive — as attending" hint={`Suggested ${formatUsd(aggressiveAttendingDefault)}/mo (~4-yr payoff); gap above IDR is invested`}>
            <NumberInput value={aggressiveAttendingMonthly} onChange={(e) => patch({ aggressiveAttendingMonthly: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Side-invest return %/yr" hint="Expected return on the aggressive−minimum gap">
            <NumberInput step={1} value={investReturnPct} onChange={(e) => patch({ investReturnPct: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Banking on PSLF?">
            <Select value={pursuePSLF ? "yes" : "no"} onChange={(e) => patch({ pursuePSLF: e.target.value === "yes" })}>
              <option value="yes">Yes — pursuing forgiveness</option>
              <option value="no">No — planning to pay it off</option>
            </Select>
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge>Balance {formatUsd(loanFacts.balance, { compact: true })}</Badge>
          <Badge>Rate {formatPct(loanFacts.rate / 100)}</Badge>
          {hasTraining && <Badge>Attending in {(monthsUntilAttending / 12).toFixed(0)} yr</Badge>}
          <Badge>{pursuePSLF ? "Leaning PSLF" : "Leaning payoff"}</Badge>
        </div>
      </Card>

      {/* Options discussion */}
      <Card className="mt-4" title="How to think about it" subtitle="Weighing the paths.">
        <div className="space-y-4 text-sm text-slate-300">
          <div>
            <p className="font-semibold text-slate-100">Lean PSLF (+ invest the gap as a hedge)</p>
            <p className="mt-1">
              Best when your balance is large relative to income, your employer clearly qualifies, and
              you'll stay in non-profit/government work for the full 10 years. The forgiven amount (
              {formatUsd(analysis.pslfWorks.forgiven, { compact: true })}) is tax-free, and every dollar
              you don't overpay can be invested instead. If you invest the aggressive−minimum gap, you
              build a {formatUsd(analysis.pslfHedgeInvest.hedge.portfolioAtForgiveness, { compact: true })} portfolio
              by year {(forgivenessMonths / 12).toFixed(0)} — a safety net if forgiveness falls through.
              Certify your employment every year and keep records.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">Lean aggressive payoff</p>
            <p className="mt-1">
              Best when you're unsure you'll stay in qualifying work, dislike the uncertainty, or your
              attending income makes the loan easy to clear in a few years. Paying minimums through
              training and then attacking it as an attending is the realistic aggressive path on a
              resident's budget.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">Minimums to the end — pros</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-slate-400">
              <li>Lowest cash outflow during training — maximum budget flexibility when income is tight</li>
              <li>Federal loans carry borrower protections (IDR recertification, forbearance, death discharge)</li>
              <li>Inflation slowly erodes the real value of the debt over decades</li>
              <li>Mortgage lenders often use the IDR payment amount, not the full balance, for DTI</li>
              <li>If you're also pursuing PSLF, every minimum payment counts toward the 120 qualifying payments</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-100">Minimums to the end — cons</p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-slate-400">
              <li>
                Balance grows during residency when payments are below interest — here you'd pay{" "}
                {formatUsd(analysis.minimumForever.sim.interestPaid, { compact: true })} in total interest,
                the highest of the paths shown here, and it takes {fmtMonths(analysis.minimumForever.sim.payoffMonth)}
              </li>
              <li>Psychological weight of carrying six-figure debt for {fmtMonths(analysis.minimumForever.sim.payoffMonth)}</li>
              <li>Interest capitalization events (leaving IDR, consolidation) can spike the balance suddenly</li>
              <li>IDR payments rise with income — as an attending you'll pay more, but the balance may still be large</li>
              <li>If you don't invest the freed-up cash flow, you're paying maximum total interest with no upside</li>
              <li>No guaranteed forgiveness — unlike PSLF, you're on the hook for the full amount eventually</li>
            </ul>
          </div>
          <p className="text-xs text-slate-500">
            Estimates only, not financial advice. IDR payment amounts depend on your specific plan (SAVE,
            PAYE, IBR, etc.), family size, and income — set the payments above to match your servicer's
            numbers for the most accurate picture.
          </p>
        </div>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-canvas)]/40 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">{value}</p>
    </div>
  );
}

function ScenarioCard({ strategy, color, tone }: { strategy: LoanStrategy; color: string; tone?: "best" | "risk" | "slow" }) {
  const isForgiven = strategy.forgiven > 0;
  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/70 p-5" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">{strategy.label}</h3>
        {tone === "best" && <Badge color="#34d399">best case</Badge>}
        {tone === "risk" && <Badge color="#fb7185">the risk</Badge>}
        {tone === "slow" && <Badge color="#94a3b8">slowest</Badge>}
      </div>
      <p className="mt-1 text-xs text-slate-400">{strategy.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Out of pocket</p>
          <p className="text-xl font-bold tabular-nums text-slate-100">{formatUsd(strategy.outOfPocket, { compact: true })}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">{isForgiven ? "Forgiven (tax-free)" : "Interest paid"}</p>
          <p className="text-xl font-bold tabular-nums" style={{ color }}>
            {formatUsd(isForgiven ? strategy.forgiven : strategy.sim.interestPaid, { compact: true })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {isForgiven ? (
          <Badge>Minimums for {fmtMonths(strategy.sim.balanceByMonth.length - 1)}</Badge>
        ) : (
          <Badge>Paid off in {fmtMonths(strategy.sim.payoffMonth)}</Badge>
        )}
        {!isForgiven && <Badge>Interest {formatUsd(strategy.sim.interestPaid, { compact: true })}</Badge>}
      </div>
    </div>
  );
}

function InvestScenarioCard({ strategy, color, tone }: { strategy: InvestHedgeStrategy; color: string; tone?: "hedge" }) {
  const { hedge } = strategy;
  const totalToLoan = strategy.outOfPocket + hedge.lumpSumApplied;
  const netCost = strategy.outOfPocket + hedge.totalInvested - hedge.portfolioRemaining;

  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface)]/70 p-5" style={{ borderTopColor: color, borderTopWidth: 3 }}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-100">{strategy.label}</h3>
        {tone === "hedge" && <Badge color={color}>hedge</Badge>}
      </div>
      <p className="mt-1 text-xs text-slate-400">{strategy.description}</p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="col-span-2 rounded-xl border p-3" style={{ borderColor: `${color}40`, backgroundColor: `${color}10` }}>
          <p className="text-[11px] uppercase tracking-wide text-slate-400">Total applied to loan</p>
          <p className="text-2xl font-bold tabular-nums text-slate-100">{formatUsd(totalToLoan, { compact: true })}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {formatUsd(strategy.outOfPocket, { compact: true })} payments + {formatUsd(hedge.lumpSumApplied, { compact: true })} lump sum
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Out of pocket (payments)</p>
          <p className="text-xl font-bold tabular-nums text-slate-100">{formatUsd(strategy.outOfPocket, { compact: true })}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Net cost</p>
          <p className="text-xl font-bold tabular-nums text-slate-100">{formatUsd(netCost, { compact: true })}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">after {formatUsd(hedge.portfolioRemaining, { compact: true })} kept</p>
        </div>
        <div className="rounded-lg border p-3" style={{ borderColor: `${color}50`, backgroundColor: `${color}08` }}>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Loan interest</p>
          <p className="text-xl font-bold tabular-nums" style={{ color }}>{formatUsd(strategy.sim.interestPaid, { compact: true })}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Portfolio at year 10</p>
          <p className="text-lg font-bold tabular-nums text-slate-100">{formatUsd(hedge.portfolioAtForgiveness, { compact: true })}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <Badge>Paid off in {fmtMonths(strategy.sim.payoffMonth)}</Badge>
        <Badge>{formatUsd(hedge.totalInvested, { compact: true })} invested</Badge>
        <Badge>{formatUsd(hedge.portfolioRemaining, { compact: true })} portfolio left</Badge>
      </div>
    </div>
  );
}
