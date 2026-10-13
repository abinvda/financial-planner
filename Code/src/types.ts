// Core domain model for the Household Finance Hub.
// Everything here is serializable so the whole household state can be
// persisted to the browser and exported/imported as a single JSON file.

export type Currency = "USD" | "INR";

export type Cadence = "monthly" | "yearly" | "one-time";

export type FilingStatus =
  | "single"
  | "married_jointly"
  | "married_separately"
  | "head_of_household";

export type ContributionType = "traditional" | "roth";

/** How an income stream is paid out over the year. */
export type PayoutSchedule = "monthly" | "annual";

export interface IncomeStream {
  id: string;
  name: string;
  /** Annual gross amount, expressed in `currency`. */
  annualGross: number;
  currency: Currency;
  taxable: boolean;
  /** "monthly" spreads evenly across 12 months; "annual" is a lump sum. */
  payout: PayoutSchedule;
  /** 1-12; only meaningful for annual (lump-sum) payouts, e.g. a Feb bonus. */
  payoutMonth?: number;
}

export interface Deductions {
  /** Employee pre/post-tax retirement contribution (401k/403b), annual. */
  retirementAnnual: number;
  retirementType: ContributionType;
  /** Annual IRA contribution (Roth = post-tax, traditional = pre-tax). */
  iraAnnual?: number;
  iraType?: ContributionType;
  /** Annual HSA contribution (always pre-tax). */
  hsaAnnual: number;
  /**
   * Employer retirement match as a fraction of base salary the employee
   * effectively receives (e.g. 0.10 for "100% up to 6% + 4% extra").
   * Assumes the employee contributes enough to capture the full match.
   */
  employerMatchPct: number;
}

export interface Expense {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  cadence: Cadence;
  category: string;
  essential: boolean;
  /** For one-time expenses: month offset (1-based) from the projection start. */
  month?: number;
}

export type AccountType =
  | "checking"
  | "savings"
  | "brokerage"
  | "401k"
  | "403b"
  | "hsa"
  | "other";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: Currency;
  /** Expected annual growth / APY as a percentage, e.g. 7 for 7%. */
  annualGrowthPct: number;
  /** True if gains are taxed at the marginal rate (e.g. brokerage, HYSA). */
  taxableGrowth: boolean;
  /** True if regular monthly surplus/contributions flow into this account. */
  isPrimaryCash?: boolean;
}

export type LoanKind = "home" | "student" | "auto" | "personal" | "other";

export interface Loan {
  id: string;
  name: string;
  kind: LoanKind;
  currency: Currency;
  /** Current outstanding balance in `currency`. */
  principal: number;
  annualRatePct: number;
  /** Regular monthly payment (EMI) in `currency`. */
  emi: number;
  /** Remaining tenure in months (upper bound for amortization). */
  termMonths: number;
  /** Optional extra monthly principal payment in `currency`. */
  extraMonthlyPayment?: number;
  /** Units of `currency` per 1 USD (used to convert non-USD loans to USD). */
  fxRate?: number;
}

/**
 * A future earnings phase, e.g. a resident who becomes an attending in a few
 * years. Used by Decisions (rate now vs. later) and Retirement (savings ramp).
 */
export interface CareerStage {
  /** Short label, e.g. "Attending physician". */
  label: string;
  /** Expected annual gross once this stage begins, in USD. */
  annualGrossUsd: number;
  /** Years from now until this stage begins. */
  startInYears: number;
}

/** Per-user retirement / FIRE planning assumptions. */
export interface RetirementPlan {
  currentAge: number;
  /** Target age to be financially independent / retire. */
  retireAge: number;
  /** Expected real (after-inflation) annual return %, e.g. 5. */
  realReturnPct: number;
  /** Safe withdrawal rate %, e.g. 4 (the "4% rule"). */
  withdrawalRatePct: number;
  /** Annual spending in retirement (USD). If omitted, derived from expenses. */
  annualSpendingUsd?: number;
  /**
   * Annual amount invested now (phase 1). If omitted, derived from the Budget
   * (surplus + retirement + match + HSA). Set it to simulate saving more/less.
   */
  annualSavingsUsd?: number;
}

/**
 * Student-loan repayment strategy assumptions. Every field is an optional
 * override — when omitted, the Student Loan page derives a sensible default
 * from the member's loans, income and career stage (so the tab stays in sync
 * with the Budget). Only edited values are persisted.
 */
export interface StudentLoanPlan {
  /** Whether this person is banking on Public Service Loan Forgiveness. */
  pursuePSLF?: boolean;
  /** Qualifying payments required before forgiveness (PSLF = 120). */
  forgivenessMonths?: number;
  /** Income-driven ("minimum") monthly payment while still in training. */
  idrResidentMonthly?: number;
  /** Income-driven monthly payment once at full (attending) income. */
  idrAttendingMonthly?: number;
  /** Fixed monthly side investment while still in training (easy savings). */
  residentSideInvestMonthly?: number;
  /** Aggressive monthly payment once at full income (defines post-training invest gap). */
  aggressiveAttendingMonthly?: number;
  /** Expected annual return on side investments while paying minimums (%). */
  investReturnPct?: number;
}

export interface Member {
  id: string;
  name: string;
  /** Hex color used across charts/badges. */
  color: string;
  /** Short persona / free-form notes, also fed to the AI chat as context. */
  notes: string;
  /** Hidden users are kept in the data but not shown in the UI. */
  hidden?: boolean;
  /**
   * Local/city income tax rate as a percentage that applies to this earner,
   * e.g. 1.2 for a Detroit non-resident. Location-specific, so it lives on the
   * member rather than the shared tax profile.
   */
  cityTaxRatePct?: number;
  /** Human label for the city tax, e.g. "Detroit city tax". */
  cityTaxLabel?: string;
  incomes: IncomeStream[];
  deductions: Deductions;
  expenses: Expense[];
  accounts: Account[];
  loans: Loan[];
  /** Optional future earnings phase (e.g. resident → attending). */
  futureStage?: CareerStage;
  /** Optional retirement / FIRE plan. */
  retirement?: RetirementPlan;
  /** Optional student-loan repayment strategy overrides. */
  studentLoan?: StudentLoanPlan;
}

export const DEFAULT_RETIREMENT: RetirementPlan = {
  currentAge: 30,
  retireAge: 50,
  realReturnPct: 5,
  withdrawalRatePct: 4,
};

export interface TaxBracket {
  /** Upper bound of this bracket (use Infinity for the top bracket). */
  upTo: number;
  /** Marginal rate as a fraction, e.g. 0.22. */
  rate: number;
}

export interface TaxProfile {
  year: number;
  filingStatus: FilingStatus;
  state: string;
  /** Simplified flat state income tax rate as a percentage, e.g. 4.25. */
  stateFlatRatePct: number;
  /**
   * State personal exemption in USD (states like Michigan have no standard
   * deduction and instead apply a per-filer exemption to AGI). Defaults to 0.
   */
  stateExemptionUsd?: number;
  standardDeduction: number;
  federalBrackets: TaxBracket[];
  ssWageBase: number;
  ssRatePct: number;
  medicareRatePct: number;
}

export interface LLMSettings {
  baseUrl: string;
  model: string;
  temperature: number;
}

export interface AppSettings {
  /** Default projection horizon in months. */
  projectionMonths: number;
  /** Target emergency-fund coverage in months of essential expenses. */
  emergencyFundMonths: number;
  /** Global USD/INR rate (INR per 1 USD) used for display conversions. */
  usdInrFxRate: number;
  llm: LLMSettings;
}

export type ScenarioEventType =
  | "one_time_expense"
  | "recurring_expense"
  | "income_delta"
  | "windfall";

export interface ScenarioEvent {
  id: string;
  name: string;
  /** Member id, or "household" to apply against combined cash flow. */
  target: string;
  type: ScenarioEventType;
  /** Amount in USD. */
  amountUsd: number;
  /** Month offset (1-based) from the projection start. */
  month: number;
  enabled: boolean;
}

export interface HouseholdState {
  members: Member[];
  tax: TaxProfile;
  settings: AppSettings;
  scenarios: ScenarioEvent[];
}

/** Special selector value representing the whole household. */
export const HOUSEHOLD = "household" as const;
export type ViewScope = string; // a member id or HOUSEHOLD
