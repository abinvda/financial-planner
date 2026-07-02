import { useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Card,
  cn,
  Field,
  NumberInput,
  PageHeader,
  Select,
  TextInput,
} from "../components/ui";
import { Waterfall, type WaterfallStep } from "../components/Waterfall";
import { useActiveUser, useActiveSummary } from "../hooks";
import { useStore } from "../store";
import { formatMoney, formatPct, formatUsd, uid } from "../lib/util";
import { LIMIT_ROTH_IRA } from "../lib/taxTables";
import type { Cadence, Currency, LoanKind, PayoutSchedule } from "../types";

const PERIODS = {
  biweekly: { label: "Biweekly", per: "paycheck", divisor: 26 },
  monthly: { label: "Monthly", per: "month", divisor: 12 },
  annual: { label: "Annual", per: "year", divisor: 1 },
} as const;
type PeriodKey = keyof typeof PERIODS;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Budget() {
  const user = useActiveUser();
  const summary = useActiveSummary();
  const addItem = useStore((s) => s.addItem);
  const updateItem = useStore((s) => s.updateItem);
  const removeItem = useStore((s) => s.removeItem);
  const updateMember = useStore((s) => s.updateMember);
  const fx = useStore((s) => s.settings.usdInrFxRate);

  const [period, setPeriod] = useState<PeriodKey>("biweekly");

  const waterfall = useMemo(() => {
    const d = PERIODS[period].divisor;
    const per = (v: number) => v / d;
    const t = summary.tax;
    const gross = per(summary.grossAnnualUsd);
    const stateLabel = user.cityTaxLabel?.includes("Detroit") ? "Michigan" : "State";
    const retirementLabel = user.deductions.retirementType === "roth" ? "Roth 403(b)" : "403(b)";
    const match = per(summary.employerMatchAnnual);

    const taxBreakdown = [
      { label: "Federal", amount: per(t.federalTax) },
      { label: `${stateLabel} state`, amount: per(t.stateTax) },
      ...(t.cityTax > 0.005 ? [{ label: user.cityTaxLabel ?? "City tax", amount: per(t.cityTax) }] : []),
      { label: "Social Security", amount: per(t.socialSecurity) },
      { label: "Medicare", amount: per(t.medicare) },
    ];

    // Essential = essential expenses + all debt payments (debt is non-negotiable).
    const essentialMonthly = summary.monthlyEssentialExpensesUsd + summary.loanPaymentsMonthlyUsd;
    const extraMonthly = Math.max(0, summary.monthlyExpensesUsd - summary.monthlyEssentialExpensesUsd);

    const steps: WaterfallStep[] = [
      { label: "Gross pay", amount: gross, type: "start", color: "#64748b" },
      { label: "Taxes", amount: per(t.totalTax), type: "down", color: "#fb7185", breakdown: taxBreakdown },
    ];

    if (summary.retirementAnnual > 0.005) {
      steps.push({
        label: "Retirement",
        sublabel: `→ ${retirementLabel}`,
        amount: per(summary.retirementAnnual),
        type: "down",
        color: "#818cf8",
        ...(match > 0.005 ? { addOn: { amount: match, label: "match", color: "#34d399" } } : {}),
      });
    }
    if (summary.hsaAnnual > 0.005) {
      steps.push({ label: "HSA", amount: per(summary.hsaAnnual), type: "down", color: "#22d3ee" });
    }
    // Roth IRA — assume it's maxed to the annual limit. It's post-tax money, so
    // it comes straight out of take-home (a bite after taxes, not a pre-tax deduction).
    const rothIra = per(LIMIT_ROTH_IRA);
    steps.push({ label: "Roth IRA", sublabel: "maxed, post-tax", amount: rothIra, type: "down", color: "#fbbf24" });
    if (essentialMonthly > 0.005) {
      steps.push({ label: "Essential", sublabel: "needs + debt", amount: per(essentialMonthly * 12), type: "down", color: "#f472b6" });
    }
    if (extraMonthly > 0.005) {
      steps.push({ label: "Extra", sublabel: "wants", amount: per(extraMonthly * 12), type: "down", color: "#e879f9" });
    }

    const leftover =
      gross - steps.filter((s) => s.type === "down").reduce((sum, s) => sum + s.amount, 0);
    steps.push({ label: "Left over", amount: leftover, type: "end", color: "#34d399" });

    const into403k = per(summary.retirementAnnual) + match;
    return { steps, gross, leftover, into403k, match, rothIra };
  }, [summary, period, user]);

  return (
    <div>
      <PageHeader
        title={`${user.name}'s budget`}
        description={user.notes}
      />

      {/* Where the money flows */}
      <Card
        title={`Where every ${PERIODS[period].per} goes`}
        subtitle="Start at gross pay, then each bar takes a bite — taxes (hover for the breakdown), savings, then essential vs. extra spending. The dashed line carries what's left, ending in your leftover. The green cap on 403(b) is your employer's match (free money, not from your paycheck)."
        actions={
          <div className="flex rounded-lg border border-[var(--color-border-subtle)] p-0.5 text-xs">
            {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
              <button
                key={k}
                onClick={() => setPeriod(k)}
                className={`rounded-md px-2.5 py-1 font-medium transition ${period === k ? "bg-indigo-500/20 text-indigo-200" : "text-slate-400 hover:text-slate-200"}`}
              >
                {PERIODS[k].label}
              </button>
            ))}
          </div>
        }
      >
        <Waterfall steps={waterfall.steps} />
        <p className="mt-2 text-xs text-slate-500">
          Per {PERIODS[period].per}: {formatUsd(waterfall.gross)} in →{" "}
          <span className={waterfall.leftover >= 0 ? "font-semibold text-emerald-300" : "font-semibold text-rose-300"}>
            {formatUsd(waterfall.leftover)} left to save/invest
          </span>{" "}
          · savings rate <span className="font-semibold text-slate-200">{formatPct(summary.savingsRate)}</span>
          {waterfall.match > 0 && summary.retirementAnnual > 0 && (
            <> · your 403(b) gets {formatUsd(waterfall.into403k)} total ({formatUsd(waterfall.match)} of it is the employer match)</>
          )}
          {user.deductions.retirementType === "roth" && summary.retirementAnnual > 0 && (
            <> · your Roth 403(b) is post-tax, so it's shown as a deduction from take-home</>
          )}
          {" "}· assumes the Roth IRA is maxed at {formatUsd(waterfall.rothIra)}/{PERIODS[period].per} (post-tax)
        </p>
      </Card>

      {/* Income */}
      <Card
        className="mt-4"
        title="Income"
        subtitle="Amounts are per year. A monthly salary spreads evenly; a bonus is a once-a-year lump."
        actions={
          <Button onClick={() => addItem(user.id, "incomes", { id: uid("inc"), name: "New income", annualGross: 0, currency: "USD", taxable: true, payout: "monthly" })}>
            + Add
          </Button>
        }
      >
        <Row header cols="sm:grid-cols-[2fr_1fr_1.3fr_1fr_auto]">
          <span>Source</span>
          <span>Per year</span>
          <span>Paid</span>
          <span>Month</span>
          <span />
        </Row>
        <div>
          {user.incomes.map((i) => (
            <Row key={i.id} cols="sm:grid-cols-[2fr_1fr_1.3fr_1fr_auto]">
              <TextInput placeholder="Source" value={i.name} onChange={(e) => updateItem(user.id, "incomes", i.id, { name: e.target.value })} />
              <NumberInput placeholder="Per year" value={i.annualGross} onChange={(e) => updateItem(user.id, "incomes", i.id, { annualGross: +e.target.value })} />
              <Select value={i.payout} onChange={(e) => updateItem(user.id, "incomes", i.id, { payout: e.target.value as PayoutSchedule })}>
                <option value="monthly">Monthly</option>
                <option value="annual">Once a year</option>
              </Select>
              <Select value={i.payoutMonth ?? 1} disabled={i.payout !== "annual"} onChange={(e) => updateItem(user.id, "incomes", i.id, { payoutMonth: +e.target.value })}>
                {MONTHS.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
              </Select>
              <Button variant="danger" onClick={() => removeItem(user.id, "incomes", i.id)}>✕</Button>
            </Row>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">Total gross: {formatUsd(summary.grossAnnualUsd)}/yr</p>
      </Card>

      {/* Contributions & savings */}
      <Card className="mt-4" title="Contributions & savings" subtitle="What you set aside for the future. These build your retirement total on the Retirement tab. See Decisions to compare Roth vs. traditional.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="401k / 403b / yr">
            <NumberInput value={user.deductions.retirementAnnual} onChange={(e) => updateMember(user.id, { deductions: { ...user.deductions, retirementAnnual: +e.target.value } })} />
          </Field>
          <Field label="401k / 403b type">
            <Select value={user.deductions.retirementType} onChange={(e) => updateMember(user.id, { deductions: { ...user.deductions, retirementType: e.target.value as "traditional" | "roth" } })}>
              <option value="traditional">Traditional</option>
              <option value="roth">Roth</option>
            </Select>
          </Field>
          <Field label="Employer match (% of pay)" hint="e.g. 10 for 100% up to 6% + 4%">
            <NumberInput step={1} value={user.deductions.employerMatchPct * 100} onChange={(e) => updateMember(user.id, { deductions: { ...user.deductions, employerMatchPct: +e.target.value / 100 } })} />
          </Field>
          <Field label="IRA / yr">
            <NumberInput value={user.deductions.iraAnnual ?? 0} onChange={(e) => updateMember(user.id, { deductions: { ...user.deductions, iraAnnual: +e.target.value } })} />
          </Field>
          <Field label="IRA type">
            <Select value={user.deductions.iraType ?? "roth"} onChange={(e) => updateMember(user.id, { deductions: { ...user.deductions, iraType: e.target.value as "traditional" | "roth" } })}>
              <option value="roth">Roth</option>
              <option value="traditional">Traditional</option>
            </Select>
          </Field>
          <Field label="HSA / yr">
            <NumberInput value={user.deductions.hsaAnnual} onChange={(e) => updateMember(user.id, { deductions: { ...user.deductions, hsaAnnual: +e.target.value } })} />
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Employer match adds <span className="font-semibold text-slate-200">{formatUsd(summary.employerMatchAnnual)}/yr</span> — free money on top of your contribution. Your IRA and any leftover you invest are post-tax; the Retirement tab totals them all up.
        </p>
      </Card>

      {/* Expenses */}
      <Card
        className="mt-4"
        title="Expenses"
        subtitle="Recurring costs. Tick “Need” for essentials (rent, food, utilities); leave it off for wants. Yearly items are averaged into the monthly figure."
        actions={
          <Button onClick={() => addItem(user.id, "expenses", { id: uid("exp"), name: "New expense", amount: 0, currency: "USD", cadence: "monthly", category: "Other", essential: false })}>
            + Add
          </Button>
        }
      >
        <Row header cols="sm:grid-cols-[2fr_1fr_1.1fr_1.2fr_auto_auto]">
          <span>Name</span>
          <span>Amount</span>
          <span>Frequency</span>
          <span>Category</span>
          <span>Need?</span>
          <span />
        </Row>
        <div>
          {user.expenses
            .filter((x) => x.cadence !== "one-time")
            .map((x) => (
              <Row key={x.id} cols="sm:grid-cols-[2fr_1fr_1.1fr_1.2fr_auto_auto]">
                <TextInput placeholder="Name" value={x.name} onChange={(e) => updateItem(user.id, "expenses", x.id, { name: e.target.value })} />
                <NumberInput placeholder="Amount" value={x.amount} onChange={(e) => updateItem(user.id, "expenses", x.id, { amount: +e.target.value })} />
                <Select value={x.cadence} onChange={(e) => updateItem(user.id, "expenses", x.id, { cadence: e.target.value as Cadence })}>
                  <option value="monthly">Per month</option>
                  <option value="yearly">Per year</option>
                </Select>
                <TextInput placeholder="Category" value={x.category} onChange={(e) => updateItem(user.id, "expenses", x.id, { category: e.target.value })} />
                <EssentialToggle
                  checked={x.essential}
                  onChange={(v) => updateItem(user.id, "expenses", x.id, { essential: v })}
                />
                <Button variant="danger" onClick={() => removeItem(user.id, "expenses", x.id)}>✕</Button>
              </Row>
            ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Total spending: {formatUsd(summary.monthlyExpensesUsd)}/mo · essentials{" "}
          <span className="text-slate-300">{formatUsd(summary.monthlyEssentialExpensesUsd)}/mo</span> · extras{" "}
          <span className="text-slate-300">{formatUsd(Math.max(0, summary.monthlyExpensesUsd - summary.monthlyEssentialExpensesUsd))}/mo</span>
        </p>
      </Card>

      {/* Debt payments */}
      <Card
        className="mt-4"
        title="Loans & debt"
        subtitle='Set the type, balance and rate too — a loan marked "Student" powers the Student Loan tab, and balance + rate drive payoff math. The monthly payment counts as essential spending in the chart above.'
        actions={
          <Button onClick={() => addItem(user.id, "loans", { id: uid("loan"), name: "New loan", kind: "student", currency: "USD", principal: 0, annualRatePct: 0, emi: 0, termMonths: 120 })}>
            + Add
          </Button>
        }
      >
        {user.loans.length === 0 ? (
          <p className="text-sm text-slate-500">No loans yet. Click “+ Add” to create one.</p>
        ) : (
          <div>
            <Row header cols="sm:grid-cols-[1.6fr_1.1fr_1fr_0.7fr_1fr_1fr_auto]">
              <span>Name</span>
              <span>Type</span>
              <span>Balance</span>
              <span>Rate %</span>
              <span>Payment / mo</span>
              <span>Currency</span>
              <span />
            </Row>
            <div>
            {user.loans.map((l) => (
              <Row key={l.id} cols="sm:grid-cols-[1.6fr_1.1fr_1fr_0.7fr_1fr_1fr_auto]">
                <TextInput placeholder="Name" value={l.name} onChange={(e) => updateItem(user.id, "loans", l.id, { name: e.target.value })} />
                <Select value={l.kind} onChange={(e) => updateItem(user.id, "loans", l.id, { kind: e.target.value as LoanKind })}>
                  <option value="student">Student</option>
                  <option value="home">Home</option>
                  <option value="auto">Auto</option>
                  <option value="personal">Personal</option>
                  <option value="other">Other</option>
                </Select>
                <NumberInput placeholder="Balance" value={l.principal} onChange={(e) => updateItem(user.id, "loans", l.id, { principal: +e.target.value })} />
                <NumberInput step={0.1} placeholder="Rate %" value={l.annualRatePct} onChange={(e) => updateItem(user.id, "loans", l.id, { annualRatePct: +e.target.value })} />
                <NumberInput placeholder="Payment / mo" value={l.emi} onChange={(e) => updateItem(user.id, "loans", l.id, { emi: +e.target.value })} />
                <div className="space-y-1">
                  <Select value={l.currency} onChange={(e) => updateItem(user.id, "loans", l.id, { currency: e.target.value as Currency })}>
                    <option value="USD">USD</option>
                    <option value="INR">INR</option>
                  </Select>
                  {l.currency !== "USD" && (
                    <NumberInput step={1} placeholder="INR per USD" value={l.fxRate ?? fx} onChange={(e) => updateItem(user.id, "loans", l.id, { fxRate: +e.target.value })} />
                  )}
                </div>
                <Button variant="danger" onClick={() => removeItem(user.id, "loans", l.id)}>✕</Button>
              </Row>
            ))}
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Total payments {formatUsd(summary.loanPaymentsMonthlyUsd)}/mo.
          {user.loans.some((l) => l.currency !== "USD") && " Foreign-currency balances/payments are converted to USD at the rate shown."}
          {" "}Balance and rate are per loan (in its own currency); they feed the Student Loan and Decisions tabs.
        </p>
      </Card>

      <p className="mt-3 text-xs text-slate-500">
        Taxes estimated with {formatMoney(summary.tax.totalTax, "USD", true)}/yr total ({formatPct(summary.tax.effectiveRate)} effective, {formatPct(summary.tax.marginalRate)} marginal).
        {summary.tax.cityTax > 0 && (
          <> Includes {user.cityTaxLabel ?? "city tax"} of {formatMoney(summary.tax.cityTax, "USD", true)}/yr.</>
        )}{" "}
        Adjust brackets and filing status in Settings.
      </p>
    </div>
  );
}

/** A compact essential/non-essential toggle used per expense row. */
function EssentialToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      title={checked ? "Essential (a need)" : "Non-essential (a want)"}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
        checked
          ? "border-pink-400/40 bg-pink-500/15 text-pink-200"
          : "border-[var(--color-border-subtle)] text-slate-400 hover:text-slate-200",
      )}
    >
      {checked ? "✓ Need" : "Want"}
    </button>
  );
}

/** A grid row for the compact editor tables. `header` renders the column labels once. */
function Row({ header, cols, children }: { header?: boolean; cols: string; children: ReactNode }) {
  if (header) {
    return (
      <div className={`hidden gap-3 px-1 pb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500 sm:grid ${cols}`}>
        {children}
      </div>
    );
  }
  return (
    <div className={`grid grid-cols-1 items-center gap-2 px-1 py-2 sm:gap-3 ${cols}`}>{children}</div>
  );
}