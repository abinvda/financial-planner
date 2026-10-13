import type { MathStep } from "./decisions";
import { formatUsd } from "../lib/util";

/**
 * Month-by-month simulation of a single fixed-rate loan under an arbitrary
 * payment schedule. Interest is capitalized monthly (added to the balance),
 * which is how federal student loans behave when the payment is smaller than
 * the interest that accrues (negative amortization). This is a separate,
 * schedule-driven simulator from `engine/loan.ts` (which amortizes a `Loan`).
 */
export interface LoanSim {
  /** True if the balance reached zero within the horizon. */
  paidOff: boolean;
  /** 1-based month the balance hit zero (null if never, e.g. forgiveness). */
  payoffMonth: number | null;
  /** Sum of every dollar actually paid. */
  totalPaid: number;
  /** Interest portion of the payments actually made. */
  interestPaid: number;
  /** Remaining balance when the simulation stopped (0 if paid off). */
  endingBalance: number;
  /** Balance at the end of each month, starting with the opening balance. */
  balanceByMonth: number[];
}

export function simulateStudentLoan(
  startBalance: number,
  annualRatePct: number,
  paymentForMonth: (monthIndex0: number) => number,
  opts: { stopAtMonth?: number; maxMonths?: number } = {},
): LoanSim {
  const maxMonths = opts.maxMonths ?? 720;
  const stop = Math.min(opts.stopAtMonth ?? maxMonths, maxMonths);
  const mRate = annualRatePct / 100 / 12;
  let balance = Math.max(0, startBalance);
  let totalPaid = 0;
  let totalInterestAccrued = 0;
  const balanceByMonth = [balance];
  let payoffMonth: number | null = balance <= 0.005 ? 0 : null;

  for (let m = 0; m < stop && balance > 0.005; m++) {
    const interest = balance * mRate;
    totalInterestAccrued += interest;
    balance += interest;
    let pay = Math.max(0, paymentForMonth(m));
    if (pay > balance) pay = balance;
    balance -= pay;
    totalPaid += pay;
    balanceByMonth.push(balance);
    if (payoffMonth === null && balance <= 0.005) payoffMonth = m + 1;
  }

  const interestPaid = totalInterestAccrued;
  return {
    paidOff: balance <= 0.005,
    payoffMonth,
    totalPaid,
    interestPaid,
    endingBalance: Math.max(0, balance),
    balanceByMonth,
  };
}

export interface StudentLoanInput {
  /** Outstanding balance (USD). */
  balance: number;
  annualRatePct: number;
  /** Months from now until the training→attending income jump (0 if none). */
  monthsUntilAttending: number;
  /** Income-driven ("minimum") payment while a resident. */
  idrResidentMonthly: number;
  /** Income-driven payment once an attending. */
  idrAttendingMonthly: number;
  /** Fixed monthly side investment while still in training (easy savings). */
  residentSideInvestMonthly: number;
  /** Aggressive payment once an attending (defines the invest gap after training). */
  aggressiveAttendingMonthly: number;
  /** Qualifying payments required before forgiveness (PSLF = 120). */
  forgivenessMonths: number;
  /** Expected annual return on the side portfolio while paying minimums (%). */
  investReturnPct?: number;
}

export interface LoanStrategy {
  key: string;
  label: string;
  description: string;
  sim: LoanSim;
  /** Balance wiped out tax-free by forgiveness (0 unless PSLF succeeds). */
  forgiven: number;
  /** Total dollars actually out of your pocket (loan payments only). */
  outOfPocket: number;
}

/** Side-investing details for the "save while on minimums" hedge. */
export interface InvestHedgeDetails {
  /** Portfolio value at the forgiveness decision point (year 10). */
  portfolioAtForgiveness: number;
  /** Total contributed to the side portfolio. */
  totalInvested: number;
  /** Lump sum applied to the loan when PSLF fails. */
  lumpSumApplied: number;
  /** Portfolio left after the lump-sum payoff. */
  portfolioRemaining: number;
  /** Portfolio balance at each month (parallel to loan balance). */
  portfolioByMonth: number[];
}

export interface InvestHedgeStrategy extends LoanStrategy {
  hedge: InvestHedgeDetails;
}

export interface StudentLoanAnalysis {
  /** Minimum payments for `forgivenessMonths`, then the rest is forgiven. */
  pslfWorks: LoanStrategy;
  /** Minimum payments for `forgivenessMonths`, forgiveness denied, then clear it. */
  pslfFails: LoanStrategy;
  /** Aggressive payments from day one. */
  aggressiveFromAttending: LoanStrategy;
  /** Minimum payments only — ride the loan to natural payoff (no PSLF, no extra). */
  minimumForever: LoanStrategy;
  /** Minimum payments + invest the aggressive−minimum gap; lump-sum at year 10 if PSLF fails. */
  pslfHedgeInvest: InvestHedgeStrategy;
  /** Same investing during the PSLF window, but forgiveness succeeds — portfolio kept. */
  pslfHedgeIfWorks: InvestHedgeStrategy;
  /** Extra interest if you bet on PSLF and lose vs. paying hard as an attending. */
  extraInterestVsAttending: number;
  /** How much less you pay overall if PSLF works vs. clearing it as an attending. */
  pslfSavingsVsAttending: number;
  steps: MathStep[];
}

/** A payment that switches from the "resident" level to the "attending" level. */
function phased(residentPay: number, attendingPay: number, monthsUntilAttending: number) {
  return (m: number) => (m < monthsUntilAttending ? residentPay : attendingPay);
}

function fmtDuration(months: number | null): string {
  if (months == null) return "beyond horizon";
  const y = Math.floor(months / 12);
  const mo = months % 12;
  if (y === 0) return `${mo} mo`;
  if (mo === 0) return `${y} yr`;
  return `${y} yr ${mo} mo`;
}

/** Minimum payment for month `m` (0-based), switching at the attending transition. */
function minPayment(
  m: number,
  monthsUntilAttending: number,
  idrResident: number,
  idrAttending: number,
): number {
  return m < monthsUntilAttending ? idrResident : idrAttending;
}

/** Side-invest amount for month `m` during the PSLF window. */
function sideInvestForMonth(
  m: number,
  monthsUntilAttending: number,
  residentSideInvest: number,
  aggressiveAttending: number,
  idrAttending: number,
): number {
  if (m < monthsUntilAttending) return Math.max(0, residentSideInvest);
  return Math.max(0, aggressiveAttending - idrAttending);
}

/**
 * Run the loan and a side portfolio in parallel. During the PSLF window you
 * pay minimums and invest on the side: a modest fixed amount while training,
 * then the aggressive−minimum gap once attending. At the forgiveness month
 * either the balance is forgiven (PSLF works) or the portfolio is dumped as a
 * lump-sum prepayment (PSLF fails), then aggressive attending payments until
 * cleared.
 */
function simulateLoanWithSideInvest(opts: {
  startBalance: number;
  annualRatePct: number;
  investReturnPct: number;
  monthsUntilAttending: number;
  idrResident: number;
  idrAttending: number;
  residentSideInvest: number;
  aggressiveAttending: number;
  forgivenessMonths: number;
  pslfWorks: boolean;
  maxMonths?: number;
}): InvestHedgeStrategy {
  const {
    startBalance,
    annualRatePct,
    investReturnPct,
    monthsUntilAttending,
    idrResident,
    idrAttending,
    residentSideInvest,
    aggressiveAttending,
    forgivenessMonths,
    pslfWorks,
    maxMonths = 720,
  } = opts;

  const loanRate = annualRatePct / 100 / 12;
  const invRate = investReturnPct / 100 / 12;
  let balance = Math.max(0, startBalance);
  let portfolio = 0;
  let totalPaid = 0;
  let totalInvested = 0;
  let totalInterestAccrued = 0;
  let lumpSumApplied = 0;
  let forgiven = 0;
  let portfolioAtForgiveness = 0;
  let payoffMonth: number | null = balance <= 0.005 ? 0 : null;
  const balanceByMonth = [balance];
  const portfolioByMonth = [0];

  for (let m = 0; m < maxMonths; m++) {
    if (balance <= 0.005 && m >= forgivenessMonths) break;

    const interest = balance * loanRate;
    totalInterestAccrued += interest;
    balance += interest;

    const minPay = minPayment(m, monthsUntilAttending, idrResident, idrAttending);
    const scheduledPay = !pslfWorks && m >= forgivenessMonths ? aggressiveAttending : minPay;
    let pay = Math.max(0, scheduledPay);
    if (pay > balance) pay = balance;
    balance -= pay;
    totalPaid += pay;

    // Side investing during the PSLF window only.
    if (m < forgivenessMonths) {
      const sideInvest = sideInvestForMonth(
        m,
        monthsUntilAttending,
        residentSideInvest,
        aggressiveAttending,
        idrAttending,
      );
      portfolio = portfolio * (1 + invRate) + sideInvest;
      totalInvested += sideInvest;
    } else {
      portfolio = portfolio * (1 + invRate);
    }

    balanceByMonth.push(Math.max(0, balance));
    portfolioByMonth.push(portfolio);

    if (payoffMonth === null && balance <= 0.005) payoffMonth = m + 1;

    // Forgiveness decision at end of month `forgivenessMonths`.
    if (m + 1 === forgivenessMonths) {
      portfolioAtForgiveness = portfolio;
      if (pslfWorks) {
        forgiven = balance;
        balance = 0;
        balanceByMonth[balanceByMonth.length - 1] = 0;
        if (payoffMonth === null) payoffMonth = m + 1;
        break;
      }
      lumpSumApplied = Math.min(portfolio, balance);
      balance -= lumpSumApplied;
      portfolio -= lumpSumApplied;
      balanceByMonth[balanceByMonth.length - 1] = Math.max(0, balance);
      portfolioByMonth[portfolioByMonth.length - 1] = portfolio;
      if (balance <= 0.005 && payoffMonth === null) payoffMonth = m + 1;
    }
  }

  if (portfolioAtForgiveness === 0 && portfolioByMonth.length > forgivenessMonths) {
    portfolioAtForgiveness = portfolioByMonth[forgivenessMonths] ?? portfolio;
  }
  const endingBalance = Math.max(0, balance);
  const interestPaid = totalInterestAccrued;
  const totalToLoan = totalPaid + lumpSumApplied;

  const sim: LoanSim = {
    paidOff: endingBalance <= 0.005,
    payoffMonth,
    totalPaid: totalToLoan,
    interestPaid,
    endingBalance,
    balanceByMonth,
  };

  const key = pslfWorks ? "pslfHedgeIfWorks" : "pslfHedgeInvest";
  const label = pslfWorks ? "PSLF works + side portfolio kept" : "Minimums + invest (PSLF fails)";
  const description = pslfWorks
    ? `Pay minimums for ${(forgivenessMonths / 12).toFixed(0)} years while investing modestly in training and aggressively once attending. Forgiveness succeeds — loan gone, portfolio is yours.`
    : `Pay minimums and invest on the side for ${(forgivenessMonths / 12).toFixed(0)} years. Forgiveness fails — dump the portfolio (${formatUsd(portfolioAtForgiveness)}) at the loan, then pay ${formatUsd(aggressiveAttending)}/mo aggressively until it's gone.`;

  return {
    key,
    label,
    description,
    sim,
    forgiven,
    outOfPocket: totalPaid,
    hedge: {
      portfolioAtForgiveness,
      totalInvested,
      lumpSumApplied,
      portfolioRemaining: portfolio,
      portfolioByMonth,
    },
  };
}

export function computeStudentLoanAnalysis(input: StudentLoanInput): StudentLoanAnalysis {
  const {
    balance,
    annualRatePct,
    monthsUntilAttending,
    idrResidentMonthly,
    idrAttendingMonthly,
    residentSideInvestMonthly,
    aggressiveAttendingMonthly,
    forgivenessMonths,
  } = input;
  const investReturnPct = input.investReturnPct ?? 7;

  // 1) PSLF works: minimum payments, remaining balance forgiven at month N.
  const pslfSim = simulateStudentLoan(
    balance,
    annualRatePct,
    phased(idrResidentMonthly, idrAttendingMonthly, monthsUntilAttending),
    { stopAtMonth: forgivenessMonths },
  );
  const pslfWorks: LoanStrategy = {
    key: "pslfWorks",
    label: "PSLF works",
    description: `Make income-driven minimums for ${(forgivenessMonths / 12).toFixed(0)} years, then the balance is forgiven tax-free.`,
    sim: pslfSim,
    forgiven: pslfSim.endingBalance,
    outOfPocket: pslfSim.totalPaid,
  };

  // 2) PSLF fails: same minimums for N months, then attack the leftover balance.
  const pslfFailSim = simulateStudentLoan(balance, annualRatePct, (m) => {
    if (m < monthsUntilAttending) return idrResidentMonthly;
    if (m < forgivenessMonths) return idrAttendingMonthly;
    return aggressiveAttendingMonthly;
  });
  const pslfFails: LoanStrategy = {
    key: "pslfFails",
    label: "PSLF denied",
    description: `You made minimums betting on forgiveness, it fell through at ${(forgivenessMonths / 12).toFixed(0)} years, and now you clear what's left.`,
    sim: pslfFailSim,
    forgiven: 0,
    outOfPocket: pslfFailSim.totalPaid,
  };

  // 3) Aggressive once attending (minimum while training).
  const attendingSim = simulateStudentLoan(balance, annualRatePct, (m) =>
    m < monthsUntilAttending ? idrResidentMonthly : aggressiveAttendingMonthly,
  );
  const aggressiveFromAttending: LoanStrategy = {
    key: "aggressiveFromAttending",
    label: "Aggressive once attending",
    description: "Pay minimums through training, then wipe it out fast on the bigger income.",
    sim: attendingSim,
    forgiven: 0,
    outOfPocket: attendingSim.totalPaid,
  };

  // 4) Minimum payments only — ride the loan to natural payoff (no PSLF, no side investing).
  const minimumForeverSim = simulateStudentLoan(
    balance,
    annualRatePct,
    phased(idrResidentMonthly, idrAttendingMonthly, monthsUntilAttending),
  );
  const minimumForever: LoanStrategy = {
    key: "minimumForever",
    label: "Minimums to the end",
    description: "Never pay extra — only income-driven minimums until the loan is finally gone. No PSLF, no side investing.",
    sim: minimumForeverSim,
    forgiven: 0,
    outOfPocket: minimumForeverSim.totalPaid,
  };

  // 5) Hedge: minimums + invest the gap; lump-sum at year 10 if PSLF fails.
  const pslfHedgeInvest = simulateLoanWithSideInvest({
    startBalance: balance,
    annualRatePct,
    investReturnPct,
    monthsUntilAttending,
    idrResident: idrResidentMonthly,
    idrAttending: idrAttendingMonthly,
    residentSideInvest: residentSideInvestMonthly,
    aggressiveAttending: aggressiveAttendingMonthly,
    forgivenessMonths,
    pslfWorks: false,
  });

  // 6) Same hedge investing, but PSLF succeeds — portfolio kept on top of forgiveness.
  const pslfHedgeIfWorks = simulateLoanWithSideInvest({
    startBalance: balance,
    annualRatePct,
    investReturnPct,
    monthsUntilAttending,
    idrResident: idrResidentMonthly,
    idrAttending: idrAttendingMonthly,
    residentSideInvest: residentSideInvestMonthly,
    aggressiveAttending: aggressiveAttendingMonthly,
    forgivenessMonths,
    pslfWorks: true,
  });

  const extraInterestVsAttending = pslfFailSim.interestPaid - attendingSim.interestPaid;
  const pslfSavingsVsAttending = attendingSim.totalPaid - pslfSim.totalPaid;

  const residentYears = (monthsUntilAttending / 12).toFixed(1);
  const steps: MathStep[] = [
    {
      label: "PSLF works — what you pay & what's forgiven",
      formula: `min payments for ${(forgivenessMonths / 12).toFixed(0)} yr → paid ${formatUsd(pslfSim.totalPaid)}`,
      result: `${formatUsd(pslfSim.endingBalance)} forgiven tax-free`,
    },
    {
      label: "PSLF denied — interest once you finally clear it",
      formula: `min for ${(forgivenessMonths / 12).toFixed(0)} yr, then ${formatUsd(aggressiveAttendingMonthly)}/mo · done in ${fmtDuration(pslfFailSim.payoffMonth)}`,
      result: `${formatUsd(pslfFailSim.interestPaid)} interest`,
    },
    {
      label: "Aggressive once attending — interest",
      formula: `min for ${residentYears} yr, then ${formatUsd(aggressiveAttendingMonthly)}/mo · done in ${fmtDuration(attendingSim.payoffMonth)}`,
      result: `${formatUsd(attendingSim.interestPaid)} interest`,
    },
    {
      label: "Extra interest if PSLF fails vs. paying hard as an attending",
      formula: `${formatUsd(pslfFailSim.interestPaid)} − ${formatUsd(attendingSim.interestPaid)}`,
      result: `${formatUsd(extraInterestVsAttending)} more`,
    },
    {
      label: "Upside if PSLF works vs. clearing it as an attending",
      formula: `${formatUsd(attendingSim.totalPaid)} − ${formatUsd(pslfSim.totalPaid)}`,
      result: `${formatUsd(pslfSavingsVsAttending)} saved`,
    },
    {
      label: "Minimums to the end — total interest",
      formula: `IDR only, no PSLF · done in ${fmtDuration(minimumForeverSim.payoffMonth)}`,
      result: `${formatUsd(minimumForeverSim.interestPaid)} interest`,
    },
    {
      label: "Side portfolio at year 10",
      formula: `${formatUsd(residentSideInvestMonthly)}/mo while training, then ${formatUsd(Math.max(0, aggressiveAttendingMonthly - idrAttendingMonthly))}/mo gap · ${investReturnPct}%/yr`,
      result: `${formatUsd(pslfHedgeInvest.hedge.portfolioAtForgiveness)} portfolio`,
    },
    {
      label: "If PSLF fails — lump sum, then aggressive payoff",
      formula: `${formatUsd(pslfHedgeInvest.hedge.lumpSumApplied)} lump sum · then ${formatUsd(aggressiveAttendingMonthly)}/mo`,
      result: `done in ${fmtDuration(pslfHedgeInvest.sim.payoffMonth)} · ${formatUsd(pslfHedgeInvest.sim.interestPaid)} interest`,
    },
    {
      label: "If PSLF fails — total paid",
      formula: `${formatUsd(pslfHedgeInvest.outOfPocket)} loan payments + ${formatUsd(pslfHedgeInvest.hedge.lumpSumApplied)} lump sum = ${formatUsd(pslfHedgeInvest.outOfPocket + pslfHedgeInvest.hedge.lumpSumApplied)} to loan`,
      result: `${formatUsd(pslfHedgeInvest.outOfPocket + pslfHedgeInvest.hedge.totalInvested - pslfHedgeInvest.hedge.portfolioRemaining)} net cost (${formatUsd(pslfHedgeInvest.hedge.portfolioRemaining)} portfolio kept)`,
    },
    {
      label: "If PSLF works — forgiven + portfolio kept",
      formula: `${formatUsd(pslfHedgeIfWorks.forgiven)} forgiven + ${formatUsd(pslfHedgeIfWorks.hedge.portfolioAtForgiveness)} invested`,
      result: `${formatUsd(pslfHedgeIfWorks.outOfPocket)} loan payments total`,
    },
  ];

  return {
    pslfWorks,
    pslfFails,
    aggressiveFromAttending,
    minimumForever,
    pslfHedgeInvest,
    pslfHedgeIfWorks,
    extraInterestVsAttending,
    pslfSavingsVsAttending,
    steps,
  };
}
