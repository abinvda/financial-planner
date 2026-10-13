import { useId, useMemo, useState } from "react";
import { Badge, Card, Field, NumberInput, PageHeader, StatCard } from "../components/ui";
import { MathSteps } from "../components/MathSteps";
import { useActiveUser, useActiveSummary } from "../hooks";
import { useStore } from "../store";
import { rothVsTradProjection, type RothTradYear, type RothTradProjectionResult } from "../engine";
import { FILING_STATUS_LABELS, LIMIT_401K_EMPLOYEE } from "../lib/taxTables";
import { formatPct, formatUsd } from "../lib/util";

interface Inputs {
  currentAge: number;
  retireAge: number;
  currentIncome: number;
  futureIncome: number;
  yearsUntilFutureIncome: number;
  annualRaisePct: number;
  annualContribution: number;
  employerMatchPct: number;
  startingBalance: number;
  realReturnPct: number;
  retirementSpending: number;
  socialSecurityAnnual: number;
  otherRetirementIncome: number;
  ltcgRatePct: number;
}

export default function RothVsTraditional() {
  const user = useActiveUser();
  const summary = useActiveSummary();
  const tax = useStore((s) => s.tax);

  const defaults = useMemo<Inputs>(() => {
    const currentAge = user.retirement?.currentAge ?? 30;
    const retireAge = user.retirement?.retireAge ?? 50;
    // Seed the starting balance from existing pre-tax retirement accounts.
    const startingBalance = user.accounts
      .filter((a) => a.type === "401k" || a.type === "403b")
      .reduce((sum, a) => sum + a.balance, 0);
    return {
      currentAge,
      retireAge,
      currentIncome: Math.round(summary.grossAnnualUsd),
      futureIncome: Math.round(user.futureStage?.annualGrossUsd ?? summary.grossAnnualUsd),
      yearsUntilFutureIncome: user.futureStage?.startInYears ?? 0,
      annualRaisePct: 2,
      annualContribution: LIMIT_401K_EMPLOYEE,
      employerMatchPct: Math.round((user.deductions.employerMatchPct ?? 0) * 100 * 10) / 10,
      startingBalance: Math.round(startingBalance),
      realReturnPct: user.retirement?.realReturnPct ?? 5,
      retirementSpending: Math.round(user.retirement?.annualSpendingUsd ?? 120000),
      socialSecurityAnnual: 30000,
      otherRetirementIncome: 0,
      ltcgRatePct: 15,
    };
  }, [user, summary]);

  const [inp, setInp] = useState<Inputs>(defaults);
  // Re-seed when the active user changes.
  const [seededFor, setSeededFor] = useState(user.id);
  if (seededFor !== user.id) {
    setSeededFor(user.id);
    setInp(defaults);
  }
  const set = (patch: Partial<Inputs>) => setInp((prev) => ({ ...prev, ...patch }));

  const res = useMemo(
    () =>
      rothVsTradProjection({
        currentAge: inp.currentAge,
        retireAge: inp.retireAge,
        currentIncome: inp.currentIncome,
        futureIncome: inp.futureIncome,
        yearsUntilFutureIncome: inp.yearsUntilFutureIncome,
        annualRaisePct: inp.annualRaisePct,
        annualContribution: inp.annualContribution,
        employerMatchPct: inp.employerMatchPct,
        startingBalance: inp.startingBalance,
        realReturnPct: inp.realReturnPct,
        retirementSpending: inp.retirementSpending,
        socialSecurityAnnual: inp.socialSecurityAnnual,
        otherRetirementIncome: inp.otherRetirementIncome,
        ltcgRatePct: inp.ltcgRatePct,
        profile: tax,
        cityRatePct: user.cityTaxRatePct,
      }),
    [inp, tax, user.cityTaxRatePct],
  );

  const winnerLabel =
    res.winner === "roth" ? "Roth wins" : res.winner === "traditional" ? "Traditional wins" : "It's a tie";

  return (
    <div>
      <PageHeader
        title={`Roth vs. Traditional 401(k) — ${user.name}`}
        description="Max out the 401(k) every year until retirement. Uses US federal + state tax brackets to project the account value and the difference in net usable money between Roth and Traditional."
      />

      <Card title="Your inputs" subtitle="All amounts in today's dollars; use a real (after-inflation) return so the tax brackets stay consistent.">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          <Field label="Current age">
            <NumberInput step={1} value={inp.currentAge} onChange={(e) => set({ currentAge: Math.max(18, +e.target.value) })} />
          </Field>
          <Field label="Retirement age">
            <NumberInput step={1} value={inp.retireAge} onChange={(e) => set({ retireAge: Math.max(inp.currentAge + 1, +e.target.value) })} />
          </Field>
          <Field label="Current income / yr" hint="Gross wages, today's $">
            <NumberInput value={inp.currentIncome} onChange={(e) => set({ currentIncome: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Expected future income / yr" hint="e.g. attending / senior pay">
            <NumberInput value={inp.futureIncome} onChange={(e) => set({ futureIncome: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Years until future income" hint="0 = already there">
            <NumberInput step={1} value={inp.yearsUntilFutureIncome} onChange={(e) => set({ yearsUntilFutureIncome: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Real raise %/yr" hint="On top of the step-up">
            <NumberInput step={0.5} value={inp.annualRaisePct} onChange={(e) => set({ annualRaisePct: +e.target.value })} />
          </Field>
          <Field label="401(k) contribution / yr" hint={`Employee max is ${formatUsd(LIMIT_401K_EMPLOYEE)}`}>
            <NumberInput value={inp.annualContribution} onChange={(e) => set({ annualContribution: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Employer match %" hint="Of gross income; always pre-tax">
            <NumberInput step={0.5} value={inp.employerMatchPct} onChange={(e) => set({ employerMatchPct: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Current 401(k) balance" hint="Existing pre-tax (traditional) balance">
            <NumberInput value={inp.startingBalance} onChange={(e) => set({ startingBalance: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Real return %/yr" hint="After inflation">
            <NumberInput step={0.5} value={inp.realReturnPct} onChange={(e) => set({ realReturnPct: +e.target.value })} />
          </Field>
          <Field label="Retirement spending / yr" hint="Total annual need, today's $">
            <NumberInput value={inp.retirementSpending} onChange={(e) => set({ retirementSpending: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Social Security / yr" hint="Est. benefit today's $; 0 to ignore">
            <NumberInput value={inp.socialSecurityAnnual} onChange={(e) => set({ socialSecurityAnnual: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Other retirement income / yr" hint="Pension, rental, passive, spouse, RMDs — stacks under withdrawals">
            <NumberInput value={inp.otherRetirementIncome} onChange={(e) => set({ otherRetirementIncome: Math.max(0, +e.target.value) })} />
          </Field>
          <Field label="Capital-gains rate %" hint="On the traditional side account">
            <NumberInput step={1} value={inp.ltcgRatePct} onChange={(e) => set({ ltcgRatePct: +e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge>{res.years} years to retirement</Badge>
          <Badge>{FILING_STATUS_LABELS[tax.filingStatus]}</Badge>
          <Badge>{tax.state} {formatPct(tax.stateFlatRatePct / 100)} flat</Badge>
          {user.cityTaxRatePct ? <Badge>{user.cityTaxLabel ?? "City tax"} {formatPct(user.cityTaxRatePct / 100)}</Badge> : null}
          <Badge>Avg deduction rate {formatPct(res.avgMarginalNow)}</Badge>
          <Badge>Withdrawal rate {formatPct(res.retirementEffRate)}</Badge>
          <Badge>Roth wins above {formatPct(res.breakEvenRetRate)}</Badge>
          {res.otherRetirementIncomeUsed > 0 && (
            <Badge>Other income {formatUsd(res.otherRetirementIncomeUsed, { compact: true })} → draw {formatUsd(res.annualWithdrawal, { compact: true })}</Badge>
          )}
          {inp.socialSecurityAnnual > 0 && (
            <Badge>SS {formatUsd(res.socialSecurityTaxable, { compact: true })} taxable</Badge>
          )}
          {res.employerMatchTotal > 0 && <Badge>Match adds {formatUsd(res.matchBalanceFinal, { compact: true })}</Badge>}
          {res.startingBalanceGrown > 0 && <Badge>Starting balance → {formatUsd(res.startingBalanceGrown, { compact: true })}</Badge>}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total 401(k) at retirement"
          value={formatUsd(res.total401kBalance, { compact: true })}
          sub={`Same either way — your ${formatUsd(res.finalBalance, { compact: true })} + match ${formatUsd(res.matchBalanceFinal, { compact: true })} + starting ${formatUsd(res.startingBalanceGrown, { compact: true })}`}
        />
        <StatCard
          label="Roth — net usable"
          value={formatUsd(res.rothTotalNet, { compact: true })}
          tone={res.winner === "roth" ? "good" : "default"}
          sub="All tax-free at withdrawal"
          accent="#f472b6"
        />
        <StatCard
          label="Traditional — net usable"
          value={formatUsd(res.tradTotalNet, { compact: true })}
          tone={res.winner === "traditional" ? "good" : "default"}
          sub={`After-tax 401(k) + side account`}
          accent="#818cf8"
        />
        <StatCard
          label={winnerLabel}
          value={res.winner === "tie" ? "—" : formatUsd(res.difference, { compact: true })}
          tone={res.winner === "tie" ? "default" : "good"}
          sub="Difference in net usable money"
        />
      </div>

      <DecisionGuide res={res} />

      <Card className="mt-4" title="Where the money ends up" subtitle="Net usable dollars at retirement, after all taxes. The employer match and current balance are pre-tax in both cases, so they appear identically on each side and don't change the winner.">
        <CompareBars
          rothContribNet={res.rothContribNet}
          tradAfterTax401k={res.tradAfterTax401k}
          tradSideAfterTax={res.tradSideAfterTax}
          pretaxCommonAfterTax={res.pretaxCommonAfterTax}
        />
        <p className="mt-4 text-sm text-slate-400">
          {res.winner === "tie" ? (
            <>Both paths land within a rounding error — your average deduction rate ({formatPct(res.avgMarginalNow)}) roughly equals the {formatPct(res.retirementEffRate)} effective rate on withdrawals.</>
          ) : res.winner === "roth" ? (
            <>
              <span className="font-semibold text-pink-300">Roth comes out ahead by {formatUsd(res.difference)}</span> of net usable money. You pay {formatUsd(res.rothExtraOutOfPocket)} more in tax while working (no deduction), but every dollar is tax-free later — worth it because your {formatPct(res.retirementEffRate)} withdrawal rate is close to or above the {formatPct(res.avgMarginalNow)} you deduct at now.
            </>
          ) : (
            <>
              <span className="font-semibold text-indigo-300">Traditional comes out ahead by {formatUsd(res.difference)}</span> of net usable money. Deducting at {formatPct(res.avgMarginalNow)} now and withdrawing at an effective {formatPct(res.retirementEffRate)} later leaves more — and the {formatUsd(res.tradTaxSavingsTotal)} of deferred tax, invested along the way, grows into {formatUsd(res.tradSideAfterTax)}.
            </>
          )}
        </p>
        <MathSteps steps={res.steps} />
      </Card>

      <Card className="mt-4" title="Balance growth" subtitle="Total pre-tax 401(k) — your contributions + employer match + starting balance — and the traditional side account, in today's dollars.">
        <GrowthChart rows={res.rows} />
      </Card>

      <Card className="mt-4" title="Year-by-year" subtitle="Income ramp, your contribution, the employer match, the marginal rate that valued each deduction, and the running total 401(k).">
        <YearTable rows={res.rows} />
      </Card>

      <p className="mt-4 text-xs text-slate-500">
        Educational estimate, not tax advice. Assumes the same limit is contributed every year and grows tax-deferred at a constant real return, the traditional deduction's yearly tax saving is invested in a taxable account, and the whole traditional balance is taxed at the effective income-tax rate implied by your planned annual withdrawal. Social Security and any other retirement income (pension, rental, passive, spouse, RMDs) cover part of your spending, so the 401(k) draw is spending − SS − other income. That other income and the taxable part of SS stack UNDER the withdrawal, so the withdrawal is charged the extra tax it triggers at those higher marginal brackets (including the SS "tax torpedo") — which nudges the answer toward Roth as your other income grows. SS taxation uses the fixed IRS provisional-income thresholds; most states (incl. Michigan) don't tax SS. The employer match and current balance are pre-tax (traditional) in both cases — so they're included in the total balance and net figures but, being identical on each side, don't change which option wins. Real limits, brackets, and rates change over time.
      </p>
    </div>
  );
}

// ---------- real-world decision guidance ----------

function DecisionGuide({ res }: { res: RothTradProjectionResult }) {
  const gapNowVsRet = res.avgMarginalNow - res.retirementEffRate;
  const headline =
    res.winner === "roth"
      ? `Lean Roth — it nets about ${formatUsd(res.difference)} more`
      : res.winner === "traditional"
        ? `Lean Traditional — it nets about ${formatUsd(res.difference)} more`
        : "It's essentially a tie";

  // Real-world factors, flagged when the user's inputs make them relevant.
  const rothReasons: string[] = [];
  const tradReasons: string[] = [];

  if (res.avgMarginalNow < 0.24)
    rothReasons.push(
      `You're deducting at a relatively low ${formatPct(res.avgMarginalNow)} today (e.g. residency / early-career years) — lock in tax-free growth now.`,
    );
  else
    tradReasons.push(
      `You deduct at a high ${formatPct(res.avgMarginalNow)} while working, but withdraw at only ${formatPct(res.retirementEffRate)} — a ${formatPct(Math.abs(gapNowVsRet))} spread in Traditional's favor.`,
    );

  if (res.otherRetirementIncomeUsed > 0)
    rothReasons.push(
      `Your ${formatUsd(res.otherRetirementIncomeUsed)} of other retirement income already fills the low brackets, so 401(k) withdrawals stack on top at ${formatPct(res.retirementEffRate)}. More passive income later ⇒ Roth looks even better.`,
    );
  else
    rothReasons.push(
      "If you build passive income before retirement (rentals, dividends, a pension, a business, a working spouse), it stacks under your withdrawals and pushes their rate up — set this in \u201cOther retirement income\u201d to see the effect.",
    );

  rothReasons.push(
    "Roth has no RMDs, gives tax-free flexibility, and hedges against future rate hikes / a larger-than-planned balance.",
  );

  tradReasons.push(
    `Traditional's up-front deduction (~${formatUsd(res.tradTaxSavingsTotal)} over your career), invested on the side, grows to ${formatUsd(res.tradSideAfterTax)} and is only taxed at long-term capital gains.`,
  );

  return (
    <Card
      className="mt-4"
      title="What should you pick?"
      subtitle="The whole decision is one comparison: the rate you DEDUCT at now vs the rate you'll WITHDRAW at later."
    >
      <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white/[0.02] p-4">
        <p className="text-base font-semibold text-slate-100">{headline}</p>
        <p className="mt-1 text-sm text-slate-400">
          You deduct at an average <span className="font-medium text-slate-200">{formatPct(res.avgMarginalNow)}</span> now and
          withdraw at an effective <span className="font-medium text-slate-200">{formatPct(res.retirementEffRate)}</span> later.
          The tipping point is <span className="font-medium text-slate-200">{formatPct(res.breakEvenRetRate)}</span> — if you expect
          your retirement tax rate to land <span className="italic">above</span> that, Roth wins; below it, Traditional wins.
        </p>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-semibold text-pink-300">Points toward Roth</h4>
          <ul className="space-y-1.5 text-sm text-slate-400">
            {rothReasons.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-pink-400">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-2 text-sm font-semibold text-indigo-300">Points toward Traditional</h4>
          <ul className="space-y-1.5 text-sm text-slate-400">
            {tradReasons.map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-indigo-400">•</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Rule of thumb: split by phase, not all-or-nothing. Contribute <span className="text-pink-300">Roth</span> in your low-bracket
        years (residency, gap years, a startup year) and <span className="text-indigo-300">Traditional</span> in your peak-earning
        years. And remember the retirement rate here is driven by what you withdraw and your other income — not your peak salary.
      </p>
    </Card>
  );
}

// ---------- composition bars ----------

function CompareBars({
  rothContribNet,
  tradAfterTax401k,
  tradSideAfterTax,
  pretaxCommonAfterTax,
}: {
  rothContribNet: number;
  tradAfterTax401k: number;
  tradSideAfterTax: number;
  pretaxCommonAfterTax: number;
}) {
  const rothTotal = rothContribNet + pretaxCommonAfterTax;
  const tradTotal = tradAfterTax401k + tradSideAfterTax + pretaxCommonAfterTax;
  const max = Math.max(rothTotal, tradTotal) || 1;
  const widthOf = (v: number) => `${(v / max) * 100}%`;
  const seg = (v: number, total: number) => `${(v / (total || 1)) * 100}%`;
  const hasCommon = pretaxCommonAfterTax > 0;

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-pink-300">Roth (tax-free contributions{hasCommon ? " + taxed match/starting" : ""})</span>
          <span className="tabular-nums text-slate-300">{formatUsd(rothTotal)}</span>
        </div>
        <div className="flex h-7 w-full overflow-hidden rounded-lg bg-white/5" style={{ width: widthOf(rothTotal) }}>
          <div className="h-full bg-pink-500/70" style={{ width: seg(rothContribNet, rothTotal) }} title={`Roth contributions (tax-free): ${formatUsd(rothContribNet)}`} />
          {hasCommon && <div className="h-full bg-slate-400/50" style={{ width: seg(pretaxCommonAfterTax, rothTotal) }} title={`Match + starting balance (taxed): ${formatUsd(pretaxCommonAfterTax)}`} />}
        </div>
      </div>
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-indigo-300">Traditional (after-tax 401k + side account{hasCommon ? " + match/starting" : ""})</span>
          <span className="tabular-nums text-slate-300">{formatUsd(tradTotal)}</span>
        </div>
        <div className="flex h-7 w-full overflow-hidden rounded-lg bg-white/5" style={{ width: widthOf(tradTotal) }}>
          <div className="h-full bg-indigo-500/70" style={{ width: seg(tradAfterTax401k, tradTotal) }} title={`After-tax 401(k): ${formatUsd(tradAfterTax401k)}`} />
          <div className="h-full bg-cyan-500/60" style={{ width: seg(tradSideAfterTax, tradTotal) }} title={`Taxable side account: ${formatUsd(tradSideAfterTax)}`} />
          {hasCommon && <div className="h-full bg-slate-400/50" style={{ width: seg(pretaxCommonAfterTax, tradTotal) }} title={`Match + starting balance (taxed): ${formatUsd(pretaxCommonAfterTax)}`} />}
        </div>
      </div>
      <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-pink-500/70" /> Roth contributions {formatUsd(rothContribNet, { compact: true })}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-500/70" /> After-tax 401(k) {formatUsd(tradAfterTax401k, { compact: true })}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cyan-500/60" /> Side account {formatUsd(tradSideAfterTax, { compact: true })}</span>
        {hasCommon && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400/50" /> Match + starting, taxed {formatUsd(pretaxCommonAfterTax, { compact: true })}</span>}
      </div>
    </div>
  );
}

// ---------- growth chart ----------

const CW = 720;
const CH = 240;
const CPAD = { top: 16, right: 16, bottom: 26, left: 54 };

function GrowthChart({ rows }: { rows: RothTradYear[] }) {
  const gid = useId();
  if (rows.length < 2) return null;

  const startAge = rows[0].age;
  const endAge = rows.at(-1)!.age;
  const yMax = Math.max(...rows.map((p) => p.total401k + p.sideBalance)) * 1.08 || 1;

  const innerW = CW - CPAD.left - CPAD.right;
  const innerH = CH - CPAD.top - CPAD.bottom;
  const x = (age: number) => CPAD.left + ((age - startAge) / (endAge - startAge || 1)) * innerW;
  const y = (v: number) => CPAD.top + innerH - (v / yMax) * innerH;

  const balanceLine = rows.map((p) => `${x(p.age).toFixed(1)},${y(p.total401k).toFixed(1)}`).join(" ");
  const totalLine = rows.map((p) => `${x(p.age).toFixed(1)},${y(p.total401k + p.sideBalance).toFixed(1)}`).join(" ");
  const areaPath = `M ${x(startAge)},${y(0)} L ${rows.map((p) => `${x(p.age).toFixed(1)},${y(p.total401k).toFixed(1)}`).join(" L ")} L ${x(endAge)},${y(0)} Z`;

  const yTicks = 4;
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) => (yMax / yTicks) * i);
  const ageStep = Math.max(1, Math.round((endAge - startAge) / 6));
  const ageTicks: number[] = [];
  for (let a = startAge; a <= endAge; a += ageStep) ageTicks.push(a);
  if (ageTicks.at(-1) !== endAge) ageTicks.push(endAge);

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" role="img" aria-label="Balance growth">
      <defs>
        <linearGradient id={`grow-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={CPAD.left} y1={y(t)} x2={CW - CPAD.right} y2={y(t)} stroke="rgba(148,163,184,0.14)" />
          <text x={CPAD.left - 8} y={y(t) + 3} textAnchor="end" className="fill-slate-500" fontSize="10">
            {formatUsd(t, { compact: true })}
          </text>
        </g>
      ))}

      {ageTicks.map((a) => (
        <text key={a} x={x(a)} y={CH - 8} textAnchor="middle" className="fill-slate-500" fontSize="10">
          {a}
        </text>
      ))}

      <path d={areaPath} fill={`url(#grow-${gid})`} />
      <polyline points={totalLine} fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="5 4" />
      <polyline points={balanceLine} fill="none" stroke="#818cf8" strokeWidth="2.5" />

      <g transform={`translate(${CPAD.left + 6}, ${CPAD.top + 4})`} fontSize="10">
        <rect x="0" y="0" width="10" height="3" fill="#818cf8" />
        <text x="14" y="4" className="fill-slate-400">Total 401(k) (you + match + starting)</text>
        <rect x="240" y="0" width="10" height="3" fill="#22d3ee" />
        <text x="254" y="4" className="fill-slate-400">+ Traditional side account</text>
      </g>
    </svg>
  );
}

// ---------- year table ----------

function YearTable({ rows }: { rows: RothTradYear[] }) {
  return (
    <div className="max-h-80 overflow-auto rounded-lg border border-[var(--color-border-subtle)]">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[var(--color-surface)] text-xs text-slate-400">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Age</th>
            <th className="px-3 py-2 text-right font-medium">Income</th>
            <th className="px-3 py-2 text-right font-medium">Contribution</th>
            <th className="px-3 py-2 text-right font-medium">Match</th>
            <th className="px-3 py-2 text-right font-medium">Marginal rate</th>
            <th className="px-3 py-2 text-right font-medium">Tax saved</th>
            <th className="px-3 py-2 text-right font-medium">Total 401(k)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {rows.map((r) => (
            <tr key={r.age} className="tabular-nums">
              <td className="px-3 py-1.5 text-slate-300">{r.age}</td>
              <td className="px-3 py-1.5 text-right text-slate-300">{formatUsd(r.income, { compact: true })}</td>
              <td className="px-3 py-1.5 text-right text-slate-300">{formatUsd(r.contribution, { compact: true })}</td>
              <td className="px-3 py-1.5 text-right text-slate-400">{formatUsd(r.matchContribution, { compact: true })}</td>
              <td className="px-3 py-1.5 text-right text-slate-400">{formatPct(r.marginalRate)}</td>
              <td className="px-3 py-1.5 text-right text-slate-400">{formatUsd(r.taxSaved, { compact: true })}</td>
              <td className="px-3 py-1.5 text-right font-medium text-slate-100">{formatUsd(r.total401k, { compact: true })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
