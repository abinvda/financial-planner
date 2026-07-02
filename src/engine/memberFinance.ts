import type { Member, TaxProfile } from "../types";
import { toUsd } from "../lib/util";
import { computeTax, type TaxResult } from "./tax";

export interface MemberSummary {
  memberId: string;
  name: string;

  grossAnnualUsd: number;
  taxableGrossUsd: number;
  tax: TaxResult;

  retirementAnnual: number;
  iraAnnual: number;
  iraType: "traditional" | "roth";
  hsaAnnual: number;
  employerMatchAnnual: number;

  afterTaxAnnual: number;
  /** Disposable cash for the year (after taxes, retirement and HSA outflow). */
  takeHomeAnnual: number;

  /** Disposable cash per month from evenly-paid (monthly) incomes only. */
  monthlyBaseNet: number;
  /** After-tax lump sums (bonus/RSU) keyed by 1-based payout month. */
  lumpsByMonth: Record<number, number>;

  monthlyExpensesUsd: number;
  monthlyEssentialExpensesUsd: number;
  loanPaymentsMonthlyUsd: number;
  /** One-time expenses keyed by 1-based month offset from projection start. */
  oneTimeByMonth: Record<number, number>;

  /** Steady-state monthly surplus (excludes lumps and one-time items). */
  monthlySurplus: number;
  savingsRate: number;
}

export function computeMemberSummary(
  member: Member,
  tax: TaxProfile,
  usdInrFxRate: number,
): MemberSummary {
  const fx = usdInrFxRate;

  const incomesUsd = member.incomes.map((i) => ({
    ...i,
    usd: toUsd(i.annualGross, i.currency, fx),
  }));

  const grossAnnualUsd = incomesUsd.reduce((s, i) => s + i.usd, 0);
  const taxableGrossUsd = incomesUsd
    .filter((i) => i.taxable)
    .reduce((s, i) => s + i.usd, 0);

  const monthlyGrossUsd = incomesUsd
    .filter((i) => i.payout === "monthly")
    .reduce((s, i) => s + i.usd, 0);
  const monthlyTaxableGrossUsd = incomesUsd
    .filter((i) => i.payout === "monthly" && i.taxable)
    .reduce((s, i) => s + i.usd, 0);

  const retirementAnnual = Math.max(0, member.deductions.retirementAnnual);
  const isTraditional = member.deductions.retirementType === "traditional";
  const iraAnnual = Math.max(0, member.deductions.iraAnnual ?? 0);
  const iraType = member.deductions.iraType ?? "roth";
  // Traditional 401k/403b and a deductible traditional IRA both lower taxes.
  const traditionalRetirement =
    (isTraditional ? retirementAnnual : 0) + (iraType === "traditional" ? iraAnnual : 0);
  const hsaAnnual = Math.max(0, member.deductions.hsaAnnual);

  const cityRatePct = member.cityTaxRatePct;
  // Detroit (and most MI cities) allow a ~$600 per-exemption city deduction.
  const cityExemptionUsd = cityRatePct ? 600 : 0;

  // Full-year tax on all taxable income.
  const fullTax = computeTax({
    grossWages: taxableGrossUsd,
    traditionalRetirement,
    hsa: hsaAnnual,
    profile: tax,
    cityRatePct,
    cityExemptionUsd,
  });
  const afterTaxAnnual = grossAnnualUsd - fullTax.totalTax;
  const takeHomeAnnual = afterTaxAnnual - retirementAnnual - hsaAnnual;

  // Base-only (monthly incomes) tax, attributing all payroll deductions to base.
  const baseTax = computeTax({
    grossWages: monthlyTaxableGrossUsd,
    traditionalRetirement,
    hsa: hsaAnnual,
    profile: tax,
    cityRatePct,
    cityExemptionUsd,
  });
  const baseAfterTaxAnnual = monthlyGrossUsd - baseTax.totalTax;
  const baseTakeHomeAnnual = baseAfterTaxAnnual - retirementAnnual - hsaAnnual;
  const monthlyBaseNet = baseTakeHomeAnnual / 12;

  // Net proceeds of annual lump sums, allocated by gross share to their months.
  const lumpsNetTotal = takeHomeAnnual - baseTakeHomeAnnual;
  const lumpIncomes = incomesUsd.filter((i) => i.payout === "annual");
  const lumpGrossTotal = lumpIncomes.reduce((s, i) => s + i.usd, 0);
  const lumpsByMonth: Record<number, number> = {};
  for (const lump of lumpIncomes) {
    const share = lumpGrossTotal > 0 ? lump.usd / lumpGrossTotal : 0;
    const month = lump.payoutMonth ?? 1;
    lumpsByMonth[month] = (lumpsByMonth[month] ?? 0) + lumpsNetTotal * share;
  }

  // Expenses (recurring monthly + yearly averaged; one-time captured separately).
  let monthlyExpensesUsd = 0;
  let monthlyEssentialExpensesUsd = 0;
  const oneTimeByMonth: Record<number, number> = {};
  for (const e of member.expenses) {
    const usd = toUsd(e.amount, e.currency, fx);
    if (e.cadence === "monthly") {
      monthlyExpensesUsd += usd;
      if (e.essential) monthlyEssentialExpensesUsd += usd;
    } else if (e.cadence === "yearly") {
      monthlyExpensesUsd += usd / 12;
      if (e.essential) monthlyEssentialExpensesUsd += usd / 12;
    } else if (e.cadence === "one-time") {
      const m = e.month ?? 1;
      oneTimeByMonth[m] = (oneTimeByMonth[m] ?? 0) + usd;
    }
  }

  const loanPaymentsMonthlyUsd = member.loans.reduce((s, l) => {
    const payment = l.emi + (l.extraMonthlyPayment ?? 0);
    return s + toUsd(payment, l.currency, l.fxRate ?? fx);
  }, 0);

  const employerMatchAnnual = monthlyTaxableGrossUsd * member.deductions.employerMatchPct;

  const monthlySurplus =
    monthlyBaseNet - monthlyExpensesUsd - loanPaymentsMonthlyUsd;

  // Savings rate: what fraction of take-home is retained (surplus + own retirement/HSA).
  const monthlyTakeHomeIncl = takeHomeAnnual / 12;
  const monthlyContrib = (retirementAnnual + hsaAnnual) / 12;
  const savingsRate =
    monthlyTakeHomeIncl + monthlyContrib > 0
      ? (Math.max(0, monthlySurplus) + monthlyContrib) /
        (monthlyTakeHomeIncl + monthlyContrib)
      : 0;

  return {
    memberId: member.id,
    name: member.name,
    grossAnnualUsd,
    taxableGrossUsd,
    tax: fullTax,
    retirementAnnual,
    iraAnnual,
    iraType,
    hsaAnnual,
    employerMatchAnnual,
    afterTaxAnnual,
    takeHomeAnnual,
    monthlyBaseNet,
    lumpsByMonth,
    monthlyExpensesUsd,
    monthlyEssentialExpensesUsd,
    loanPaymentsMonthlyUsd,
    oneTimeByMonth,
    monthlySurplus,
    savingsRate,
  };
}
