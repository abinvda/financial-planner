import type { Account } from "../types";
import { toUsd } from "../lib/util";
import type { MathStep } from "./decisions";
import type { MemberSummary } from "./memberFinance";

// Account types that count as invested/retirement assets (checking is cash).
const INVESTED_TYPES: Account["type"][] = [
  "savings",
  "brokerage",
  "401k",
  "403b",
  "hsa",
  "other",
];

/** Sum of a member's invested assets in USD (everything except checking). */
export function investedAssetsUsd(accounts: Account[], fx: number): number {
  return accounts
    .filter((a) => INVESTED_TYPES.includes(a.type))
    .reduce((s, a) => s + toUsd(a.balance, a.currency, fx), 0);
}

/**
 * Where a member's yearly investing comes from. Roth/traditional IRA and any
 * "extra" taxable savings are both funded out of the monthly surplus, so the
 * surplus is split into the IRA first and whatever is left goes to taxable.
 */
export interface InvestingBreakdown {
  /** Employee 401(k)/403(b) contribution. */
  retirement: number;
  /** Employer match (into the 401k/403b). */
  employerMatch: number;
  /** IRA contribution (Roth or traditional). */
  ira: number;
  /** HSA contribution. */
  hsa: number;
  /** Leftover surplus invested in a taxable brokerage (after funding the IRA). */
  taxableExtra: number;
  /** Sum of everything above — total invested per year. */
  total: number;
}

export function investingBreakdown(s: MemberSummary): InvestingBreakdown {
  const surplus = Math.max(0, s.monthlySurplus) * 12;
  const ira = Math.max(0, s.iraAnnual);
  const taxableExtra = Math.max(0, surplus - ira);
  const retirement = s.retirementAnnual;
  const employerMatch = s.employerMatchAnnual;
  const hsa = s.hsaAnnual;
  return {
    retirement,
    employerMatch,
    ira,
    hsa,
    taxableExtra,
    total: retirement + employerMatch + ira + hsa + taxableExtra,
  };
}

/** Annual dollars a member currently routes into investments (from the budget). */
export function annualInvestingCapacity(s: MemberSummary): number {
  return investingBreakdown(s).total;
}

export interface RetirementInput {
  currentAge: number;
  retireAge: number;
  currentInvested: number;
  /** Annual amount invested now (phase 1). */
  annualContribution: number;
  realReturnPct: number;
  withdrawalRatePct: number;
  /** Annual spending in retirement (USD). */
  annualSpending: number;
  /** Optional second savings phase (e.g. after a resident becomes an attending). */
  futureContribution?: { annualContribution: number; startInYears: number };
  /** Safety cap on how many years to project. */
  maxYears?: number;
}

export interface RetirementPoint {
  year: number;
  age: number;
  /** Balance with ongoing contributions. */
  balance: number;
  /** Balance if you stopped contributing today (pure "coast"). */
  coastBalance: number;
}

export interface RetirementResult {
  fireNumber: number;
  yearsToRetire: number;
  /** Invested dollars needed today to coast (no more saving) to FIRE by retireAge. */
  coastNumber: number;
  coastProgress: number;
  alreadyCoasting: boolean;
  /** Years until the balance reaches the Coast FIRE number (null if beyond cap). */
  yearsToCoast: number | null;
  ageAtCoast: number | null;
  /** Projected balance at the target retirement age (with contributions). */
  balanceAtRetire: number;
  /** Whether the plan reaches the FIRE number by the target retirement age. */
  reachesFireByRetireAge: boolean;
  /** Years until the balance reaches the FIRE number (null if beyond the cap). */
  yearsToFI: number | null;
  ageAtFI: number | null;
  points: RetirementPoint[];
  steps: MathStep[];
}

/**
 * Projects an investment balance year by year (contributions at year end) and
 * derives the FIRE number, the Coast FIRE target, and time to independence.
 * All figures are in today's dollars (use a real, after-inflation return).
 */
export function projectRetirement(input: RetirementInput): RetirementResult {
  const {
    currentAge,
    retireAge,
    currentInvested,
    annualContribution,
    realReturnPct,
    withdrawalRatePct,
    annualSpending,
    futureContribution,
    maxYears = 70,
  } = input;

  const r = realReturnPct / 100;
  const swr = withdrawalRatePct / 100;
  const yearsToRetire = Math.max(0, retireAge - currentAge);

  const fireNumber = swr > 0 ? annualSpending / swr : Infinity;
  // Dollars needed *today* so growth alone reaches the FIRE number by retireAge.
  // With a positive real return this is always below the FIRE number.
  const coastNumber =
    Number.isFinite(fireNumber) && yearsToRetire > 0 && r > -1
      ? fireNumber / Math.pow(1 + r, yearsToRetire)
      : fireNumber;
  const coastProgress = coastNumber > 0 ? currentInvested / coastNumber : 0;
  const alreadyCoasting = currentInvested >= coastNumber;

  const contributionForYear = (yearIndex: number): number => {
    if (
      futureContribution &&
      yearIndex >= futureContribution.startInYears
    ) {
      return futureContribution.annualContribution;
    }
    return annualContribution;
  };

  const points: RetirementPoint[] = [];
  let balance = currentInvested;
  let coast = currentInvested;
  points.push({ year: 0, age: currentAge, balance, coastBalance: coast });

  let yearsToFI: number | null = balance >= fireNumber ? 0 : null;
  let yearsToCoast: number | null = balance >= coastNumber ? 0 : null;

  // Cap projection length (maxYears is a ceiling, not a minimum).
  const horizon = maxYears;
  for (let y = 1; y <= horizon; y++) {
    balance = balance * (1 + r) + contributionForYear(y - 1);
    coast = coast * (1 + r);
    points.push({ year: y, age: currentAge + y, balance, coastBalance: coast });
    if (yearsToCoast === null && balance >= coastNumber) yearsToCoast = y;
    if (yearsToFI === null && balance >= fireNumber) yearsToFI = y;
    if (y >= yearsToRetire && yearsToFI !== null && y >= yearsToFI + 1) break;
  }

  const balanceAtRetire =
    points.find((p) => p.year === yearsToRetire)?.balance ??
    points.at(-1)!.balance;
  const reachesFireByRetireAge = balanceAtRetire >= fireNumber;
  const ageAtFI = yearsToFI !== null ? currentAge + yearsToFI : null;
  const ageAtCoast = yearsToCoast !== null ? currentAge + yearsToCoast : null;

  const fmt = (n: number) =>
    Number.isFinite(n)
      ? `$${Math.round(n).toLocaleString("en-US")}`
      : "—";

  const steps: MathStep[] = [
    {
      label: "FIRE number (nest egg you need)",
      formula: `${fmt(annualSpending)}/yr ÷ ${withdrawalRatePct}% safe withdrawal`,
      result: fmt(fireNumber),
    },
    {
      label: "Years until target retirement age",
      formula: `${retireAge} − ${currentAge}`,
      result: `${yearsToRetire} years`,
    },
    {
      label: "Coast FIRE number (need invested today)",
      formula: `${fmt(fireNumber)} ÷ (1 + ${realReturnPct}%)^${yearsToRetire}`,
      result: fmt(coastNumber),
    },
    {
      label: "Coast progress",
      formula: `${fmt(currentInvested)} ÷ ${fmt(coastNumber)}`,
      result: `${Math.round(coastProgress * 100)}% ${alreadyCoasting ? "— you can coast" : "— keep saving"}`,
    },
    {
      label: "Reach the Coast FIRE number",
      formula:
        yearsToCoast !== null
          ? `saving until balance ≥ ${fmt(coastNumber)}`
          : `not within ${horizon} years at these inputs`,
      result:
        yearsToCoast === 0
          ? "already there"
          : yearsToCoast !== null
            ? `in ${yearsToCoast} yrs (age ${ageAtCoast})`
            : "—",
    },
    {
      label: "Projected balance at target age (still saving)",
      formula: `grow ${fmt(currentInvested)} + contributions at ${realReturnPct}% for ${yearsToRetire} yrs`,
      result: fmt(balanceAtRetire),
    },
    {
      label: "Reach full FIRE number",
      formula:
        yearsToFI !== null
          ? `balance ≥ ${fmt(fireNumber)}`
          : `not within ${horizon} years at these inputs`,
      result:
        yearsToFI !== null ? `in ${yearsToFI} yrs (age ${ageAtFI})` : "—",
    },
  ];

  return {
    fireNumber,
    yearsToRetire,
    coastNumber,
    coastProgress,
    alreadyCoasting,
    yearsToCoast,
    ageAtCoast,
    balanceAtRetire,
    reachesFireByRetireAge,
    yearsToFI,
    ageAtFI,
    points,
    steps,
  };
}
