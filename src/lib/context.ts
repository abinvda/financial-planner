import type { HouseholdState, Member } from "../types";
import {
  annualInvestingCapacity,
  computeEmi,
  computeMemberSummary,
  computeStudentLoanAnalysis,
  investedAssetsUsd,
  projectRetirement,
} from "../engine";
import {
  FILING_STATUS_LABELS,
  LIMIT_401K_EMPLOYEE,
  LIMIT_HSA_FAMILY,
  LIMIT_ROTH_IRA,
} from "./taxTables";
import { DEFAULT_RETIREMENT } from "../types";
import { formatMoney, formatPct, formatUsd, toUsd } from "./util";

/**
 * Compact, plain-text snapshot of each user's finances plus derived metrics,
 * injected into the LLM system prompt so a local model can answer grounded in
 * the user's real numbers.
 */
export function buildFinancialContext(state: HouseholdState): string {
  const { tax, settings } = state;
  const fx = settings.usdInrFxRate;
  const members = state.members.filter((m) => !m.hidden);

  const lines: string[] = [];
  lines.push("USERS' FINANCIAL SNAPSHOT (amounts in USD unless noted).");
  lines.push(
    `Tax settings: ${tax.year}, ${FILING_STATUS_LABELS[tax.filingStatus]}, ${tax.state} (flat ${tax.stateFlatRatePct}% state). Each person is a single filer, taxed on their own income (a planning approximation).`,
  );
  lines.push(
    `${tax.year} limits: 401(k)/403(b) employee ${formatUsd(LIMIT_401K_EMPLOYEE)}, Roth IRA ${formatUsd(LIMIT_ROTH_IRA)}, HSA family ${formatUsd(LIMIT_HSA_FAMILY)}. FX: ${formatMoney(fx, "INR")} per USD.`,
  );
  lines.push("");

  for (const m of members) {
    const s = computeMemberSummary(m, tax, fx);
    const monthlyTakeHome = s.takeHomeAnnual / 12;
    const monthlySpending = s.monthlyExpensesUsd + s.loanPaymentsMonthlyUsd;
    const leftover = monthlyTakeHome - monthlySpending;

    lines.push(`== ${m.name} ==`);
    if (m.notes) lines.push(`Profile: ${m.notes}`);
    lines.push(`Gross income: ${formatUsd(s.grossAnnualUsd)}/yr.`);
    lines.push(
      `Taxes: ${formatUsd(s.tax.totalTax)}/yr (effective ${formatPct(s.tax.effectiveRate)}, marginal ${formatPct(s.tax.marginalRate)}). Federal ${formatUsd(s.tax.federalTax)}, state ${formatUsd(s.tax.stateTax)}${s.tax.cityTax > 0 ? `, ${m.cityTaxLabel ?? "city"} ${formatUsd(s.tax.cityTax)}` : ""}, FICA ${formatUsd(s.tax.totalFica)}.`,
    );
    lines.push(
      `Contributions: 401k/403b ${formatUsd(s.retirementAnnual)}/yr (${m.deductions.retirementType}) + employer match ${formatUsd(s.employerMatchAnnual)}/yr; ${s.iraType} IRA ${formatUsd(s.iraAnnual)}/yr; HSA ${formatUsd(s.hsaAnnual)}/yr.`,
    );
    lines.push(
      `Take-home ${formatUsd(monthlyTakeHome)}/mo; spending ${formatUsd(monthlySpending)}/mo (expenses ${formatUsd(s.monthlyExpensesUsd)} + loan payments ${formatUsd(s.loanPaymentsMonthlyUsd)}); leftover ${formatUsd(leftover)}/mo. Savings rate ${formatPct(s.savingsRate)}.`,
    );
    if (m.futureStage) {
      const future: Member = {
        ...m,
        incomes: [
          { id: "future", name: m.futureStage.label, annualGross: m.futureStage.annualGrossUsd, currency: "USD", taxable: true, payout: "monthly" },
        ],
      };
      const fs = computeMemberSummary(future, tax, fx);
      lines.push(
        `Career: currently ${formatUsd(s.grossAnnualUsd)}/yr (marginal ${formatPct(s.tax.marginalRate)}); becomes ${m.futureStage.label} in ~${m.futureStage.startInYears} yr at ${formatUsd(m.futureStage.annualGrossUsd)}/yr (marginal ${formatPct(fs.tax.marginalRate)}). Low rate now favors Roth; direct Roth IRA likely phases out later (backdoor).`,
      );
    }
    for (const l of m.loans) {
      lines.push(
        `Loan "${l.name}" (${l.kind}): ${formatMoney(l.principal, l.currency, true)} @ ${l.annualRatePct}%, payment ${formatMoney(l.emi, l.currency)}/mo${l.currency !== "USD" ? ` (~${formatUsd(toUsd(l.emi, l.currency, l.fxRate ?? fx))}/mo)` : ""}.`,
      );
    }

    // Student-loan strategy comparison (PSLF vs. paying it off).
    const studentLoans = m.loans.filter((l) => l.kind === "student");
    const slBalance = studentLoans.reduce((sum, l) => sum + toUsd(l.principal, l.currency, l.fxRate ?? fx), 0);
    if (slBalance > 0) {
      const slEmi = studentLoans.reduce((sum, l) => sum + toUsd(l.emi, l.currency, l.fxRate ?? fx), 0);
      const slRate = studentLoans.reduce((sum, l) => sum + l.annualRatePct * toUsd(l.principal, l.currency, l.fxRate ?? fx), 0) / slBalance;
      const monthsUntilAttending = Math.round((m.futureStage?.startInYears ?? 0) * 12);
      const attendingIncome = m.futureStage?.annualGrossUsd ?? s.grossAnnualUsd;
      const sl = m.studentLoan ?? {};
      const idrResident = sl.idrResidentMonthly ?? Math.round((slEmi || slBalance * 0.005) / 50) * 50;
      const idrAttending = sl.idrAttendingMonthly ?? Math.max(idrResident, Math.round((0.1 * Math.max(0, attendingIncome - 23475)) / 12 / 50) * 50);
      const residentSideInvest = sl.residentSideInvestMonthly ?? 400;
      const aggAttending = sl.aggressiveAttendingMonthly ?? Math.round(computeEmi(slBalance, slRate, 48) / 50) * 50;
      const a = computeStudentLoanAnalysis({
        balance: slBalance,
        annualRatePct: slRate,
        monthsUntilAttending,
        idrResidentMonthly: idrResident,
        idrAttendingMonthly: idrAttending,
        residentSideInvestMonthly: residentSideInvest,
        aggressiveAttendingMonthly: aggAttending,
        forgivenessMonths: sl.forgivenessMonths ?? 120,
      });
      lines.push(
        `Student-loan PSLF analysis: if PSLF works, pays ${formatUsd(a.pslfWorks.outOfPocket)} total and ${formatUsd(a.pslfWorks.forgiven)} is forgiven tax-free. If PSLF is denied after 10 yr of minimums, total interest is ${formatUsd(a.pslfFails.sim.interestPaid)} — about ${formatUsd(a.extraInterestVsAttending)} more than paying aggressively once an attending.`,
      );
    }

    const plan = m.retirement ?? DEFAULT_RETIREMENT;
    const invested = investedAssetsUsd(m.accounts, fx);
    const annualContribution = annualInvestingCapacity(s);
    const annualSpending = plan.annualSpendingUsd ?? Math.round(s.monthlyExpensesUsd * 12);
    const ret = projectRetirement({
      currentAge: plan.currentAge,
      retireAge: plan.retireAge,
      currentInvested: invested,
      annualContribution,
      realReturnPct: plan.realReturnPct,
      withdrawalRatePct: plan.withdrawalRatePct,
      annualSpending,
      futureContribution: m.futureStage
        ? {
            annualContribution: annualInvestingCapacity(
              computeMemberSummary(
                { ...m, incomes: [{ id: "f", name: "f", annualGross: m.futureStage.annualGrossUsd, currency: "USD", taxable: true, payout: "monthly" }] },
                tax,
                fx,
              ),
            ),
            startInYears: m.futureStage.startInYears,
          }
        : undefined,
    });
    lines.push(
      `Retirement: invested ${formatUsd(invested)}; saving ${formatUsd(annualContribution)}/yr; spend ${formatUsd(annualSpending)}/yr in retirement. FIRE number ${formatUsd(ret.fireNumber)} (${plan.withdrawalRatePct}% rule); Coast FIRE target ${formatUsd(ret.coastNumber)} (${Math.round(ret.coastProgress * 100)}% there, real return ${plan.realReturnPct}%). ${ret.yearsToFI !== null ? `Financially independent in ~${ret.yearsToFI} yr (age ${ret.ageAtFI}).` : "Does not reach FI at current inputs."}`,
    );
    lines.push("");
  }

  return lines.join("\n");
}

export const SYSTEM_PROMPT = `You are a careful, friendly financial planning assistant embedded in a personal budgeting app.
You are given a snapshot of each user's finances plus derived metrics. Use ONLY these numbers as ground truth; if something is not in the snapshot, say so instead of inventing it.
Specialize in: budgeting (how much someone can save/spend), tax-advantaged savings decisions (Roth vs. traditional 401(k)/403(b), Roth IRA eligibility and the backdoor Roth, maxing an HSA), and retirement/FIRE planning (FIRE number, Coast FIRE, time to financial independence).
Pay attention to career stage: someone in a temporarily low bracket who expects a future pay jump should usually favor Roth now and revisit once their rate rises.
Always quantify with the dollar figures provided, show the key formula or steps so the user can verify, and explain the trade-offs (tax rate now vs. later, liquidity, eligibility, guaranteed vs. expected returns). Be concise and practical. You are not a licensed advisor.`;
