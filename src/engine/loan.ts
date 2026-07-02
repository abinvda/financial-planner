import type { Loan } from "../types";

export interface AmortMonth {
  month: number;
  payment: number;
  interest: number;
  principalPaid: number;
  prepayment: number;
  balance: number;
}

export interface AmortResult {
  months: AmortMonth[];
  totalMonths: number;
  totalInterest: number;
  totalPaid: number;
  totalPrepayments: number;
  /** Currency of the figures (same as the loan). */
  currency: Loan["currency"];
}

const SAFETY_MAX_MONTHS = 1200;

/**
 * Amortize a loan with an optional constant extra monthly payment and/or a
 * schedule of one-off prepayments keyed by month. All figures are in the
 * loan's own currency.
 */
export function amortize(
  loan: Loan,
  opts: { extraMonthly?: number; prepayments?: Record<number, number> } = {},
): AmortResult {
  const monthlyRate = loan.annualRatePct / 100 / 12;
  const extra = opts.extraMonthly ?? loan.extraMonthlyPayment ?? 0;
  const prepayments = opts.prepayments ?? {};

  let balance = loan.principal;
  let month = 0;
  let totalInterest = 0;
  let totalPaid = 0;
  let totalPrepayments = 0;
  const months: AmortMonth[] = [];

  const hardCap = Math.min(SAFETY_MAX_MONTHS, Math.max(loan.termMonths * 3, 600));

  while (balance > 0.5 && month < hardCap) {
    month += 1;
    const interest = balance * monthlyRate;

    // Regular payment can't exceed remaining balance + interest.
    const scheduled = loan.emi + extra;
    const regular = Math.min(scheduled, balance + interest);
    const onceOff = Math.min(prepayments[month] ?? 0, Math.max(0, balance + interest - regular));

    const principalPaid = regular - interest + onceOff;
    balance = Math.max(0, balance - principalPaid);

    totalInterest += interest;
    totalPaid += regular + onceOff;
    totalPrepayments += onceOff;

    months.push({
      month,
      payment: regular,
      interest,
      principalPaid,
      prepayment: onceOff,
      balance,
    });

    // Interest exceeds payment: loan never amortizes with these terms.
    if (principalPaid <= 0) break;
  }

  return {
    months,
    totalMonths: month,
    totalInterest,
    totalPaid,
    totalPrepayments,
    currency: loan.currency,
  };
}

export interface PrepayComparisonRow {
  label: string;
  extraMonthly: number;
  totalMonths: number;
  totalInterest: number;
  interestSaved: number;
  monthsSaved: number;
}

/**
 * Compare a set of constant extra-monthly-payment strategies against the
 * loan's baseline (no extra payment).
 */
export function comparePrepayments(
  loan: Loan,
  extraMonthlyOptions: number[],
): PrepayComparisonRow[] {
  const baseline = amortize(loan, { extraMonthly: 0, prepayments: {} });
  return extraMonthlyOptions.map((extra) => {
    const r = amortize(loan, { extraMonthly: extra, prepayments: {} });
    return {
      label: extra === 0 ? "No extra payment" : `+${extra.toLocaleString()} / mo`,
      extraMonthly: extra,
      totalMonths: r.totalMonths,
      totalInterest: r.totalInterest,
      interestSaved: baseline.totalInterest - r.totalInterest,
      monthsSaved: baseline.totalMonths - r.totalMonths,
    };
  });
}

/**
 * Loan-vs-invest: is prepaying worth it vs. investing the same money at an
 * expected after-tax return? Compares total interest avoided against expected
 * investment growth on the same cash over the baseline payoff horizon.
 */
export interface LoanVsInvestResult {
  extraMonthly: number;
  horizonMonths: number;
  interestSaved: number;
  investmentFutureValue: number;
  contributionsTotal: number;
  investmentGain: number;
  /** Positive => investing wins, negative => prepaying wins (in loan currency-equivalent). */
  netAdvantageOfInvesting: number;
  loanRatePct: number;
  investReturnPct: number;
}

export function loanVsInvest(
  loan: Loan,
  extraMonthly: number,
  investAnnualReturnPct: number,
): LoanVsInvestResult {
  const baseline = amortize(loan, { extraMonthly: 0 });
  const prepay = amortize(loan, { extraMonthly });
  const interestSaved = baseline.totalInterest - prepay.totalInterest;

  // Invest `extraMonthly` for the number of months prepayment would have run.
  const horizon = prepay.totalMonths;
  const r = investAnnualReturnPct / 100 / 12;
  let fv = 0;
  for (let m = 0; m < horizon; m++) {
    fv = fv * (1 + r) + extraMonthly;
  }
  const contributions = extraMonthly * horizon;
  const gain = fv - contributions;

  return {
    extraMonthly,
    horizonMonths: horizon,
    interestSaved,
    investmentFutureValue: fv,
    contributionsTotal: contributions,
    investmentGain: gain,
    netAdvantageOfInvesting: gain - interestSaved,
    loanRatePct: loan.annualRatePct,
    investReturnPct: investAnnualReturnPct,
  };
}

/** Standard EMI for a principal, annual rate and term (months). */
export function computeEmi(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  const r = annualRatePct / 100 / 12;
  if (r === 0) return principal / termMonths;
  const f = Math.pow(1 + r, termMonths);
  return (principal * r * f) / (f - 1);
}
