import type { TaxBracket, TaxProfile } from "../types";

export interface TaxInput {
  /** Total taxable gross wages in USD. */
  grossWages: number;
  /** Traditional (pre-tax) retirement contributions in USD. */
  traditionalRetirement: number;
  /** HSA contributions in USD (always pre-tax for income tax). */
  hsa: number;
  profile: TaxProfile;
  /**
   * Optional local/city flat income tax rate as a percentage, e.g. 1.2 for a
   * Detroit non-resident.
   */
  cityRatePct?: number;
  /** Optional city exemption in USD subtracted before the city rate (Detroit ≈ $600). */
  cityExemptionUsd?: number;
}

export interface TaxResult {
  grossWages: number;
  preTaxDeductions: number;
  taxableIncome: number;
  federalTax: number;
  stateTax: number;
  /** Local/city income tax (0 when no city rate is supplied). */
  cityTax: number;
  socialSecurity: number;
  medicare: number;
  totalFica: number;
  totalTax: number;
  /** Cash the earner keeps after taxes only (before retirement/HSA outflow). */
  afterTaxIncome: number;
  /** Combined federal + state + city marginal rate as a fraction (e.g. 0.2745). */
  marginalRate: number;
  /** Total tax / gross wages as a fraction. */
  effectiveRate: number;
}

/** Progressive federal tax for a taxable income against a bracket table. */
export function federalTax(taxableIncome: number, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0) return 0;
  let tax = 0;
  let prev = 0;
  for (const { upTo, rate } of brackets) {
    if (taxableIncome <= prev) break;
    const slice = Math.min(taxableIncome, upTo) - prev;
    tax += slice * rate;
    prev = upTo;
  }
  return tax;
}

/** Federal marginal rate (fraction) for a given taxable income. */
export function federalMarginalRate(
  taxableIncome: number,
  brackets: TaxBracket[],
): number {
  if (taxableIncome <= 0) return 0;
  let marginal = brackets[0]?.rate ?? 0;
  let prev = 0;
  for (const { upTo, rate } of brackets) {
    if (taxableIncome > prev) marginal = rate;
    if (taxableIncome <= upTo) break;
    prev = upTo;
  }
  return marginal;
}

export function computeTax(input: TaxInput): TaxResult {
  const { grossWages, traditionalRetirement, hsa, profile } = input;
  const preTaxDeductions = Math.max(0, traditionalRetirement) + Math.max(0, hsa);

  // AGI-like base after pre-tax payroll deductions. Federal, state and local
  // taxes each start from this but apply *different* deductions/exemptions.
  const agi = Math.max(0, grossWages - preTaxDeductions);

  // Federal uses the standard deduction.
  const taxableIncome = Math.max(0, agi - profile.standardDeduction);

  // State (e.g. Michigan) has no standard deduction — it uses a small personal
  // exemption instead, applied to AGI, not to the federal taxable income.
  const stateExemption = Math.max(0, profile.stateExemptionUsd ?? 0);
  const stateTaxable = Math.max(0, agi - stateExemption);

  // City/local (e.g. Detroit) taxes wages less its own small exemption.
  const cityRate = Math.max(0, input.cityRatePct ?? 0);
  const cityExemption = Math.max(0, input.cityExemptionUsd ?? 0);
  const cityTaxable = Math.max(0, agi - cityExemption);

  const fed = federalTax(taxableIncome, profile.federalBrackets);
  const state = stateTaxable * (profile.stateFlatRatePct / 100);
  const city = cityTaxable * (cityRate / 100);

  const ss = Math.min(grossWages, profile.ssWageBase) * (profile.ssRatePct / 100);
  const medicare = grossWages * (profile.medicareRatePct / 100);
  const totalFica = ss + medicare;

  const totalTax = fed + state + city + totalFica;
  const afterTaxIncome = grossWages - totalTax;

  const marginalRate =
    federalMarginalRate(taxableIncome, profile.federalBrackets) +
    profile.stateFlatRatePct / 100 +
    cityRate / 100;

  return {
    grossWages,
    preTaxDeductions,
    taxableIncome,
    federalTax: fed,
    stateTax: state,
    cityTax: city,
    socialSecurity: ss,
    medicare,
    totalFica,
    totalTax,
    afterTaxIncome,
    marginalRate,
    effectiveRate: grossWages > 0 ? totalTax / grossWages : 0,
  };
}
