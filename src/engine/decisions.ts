import type { FilingStatus } from "../types";
import { ROTH_IRA_PHASEOUT } from "../lib/taxTables";
import { formatPct, formatUsd } from "../lib/util";

/** One verifiable line of a calculation: what we did, the formula, the result. */
export interface MathStep {
  label: string;
  formula: string;
  result: string;
}

/** Future value of an annuity: `annual` contributed at the end of each year. */
export function fvAnnuity(annual: number, ratePct: number, years: number): number {
  const r = ratePct / 100;
  if (r === 0) return annual * years;
  return annual * ((Math.pow(1 + r, years) - 1) / r);
}

// ------------------------------------------------------------------
// Roth vs. Traditional 401(k)/403(b)
// ------------------------------------------------------------------

export interface RothVsTradInput {
  /** Pre-tax dollars committed to retirement each year. */
  annualContribution: number;
  /** Marginal tax rate today (fraction, e.g. 0.264). */
  currentRate: number;
  /** Expected marginal tax rate in retirement (fraction). */
  retirementRate: number;
  returnPct: number;
  years: number;
}

export interface RothVsTradResult {
  tradFvPretax: number;
  tradAfterTax: number;
  rothContribution: number;
  rothFvAfterTax: number;
  taxSavedNowPerYear: number;
  winner: "roth" | "traditional" | "tie";
  difference: number;
  steps: MathStep[];
}

export function rothVsTraditional(input: RothVsTradInput): RothVsTradResult {
  const { annualContribution: c, currentRate, retirementRate, returnPct, years } = input;

  const tradFvPretax = fvAnnuity(c, returnPct, years);
  const tradAfterTax = tradFvPretax * (1 - retirementRate);
  const taxSavedNowPerYear = c * currentRate;

  const rothContribution = c * (1 - currentRate);
  const rothFvAfterTax = fvAnnuity(rothContribution, returnPct, years);

  const difference = Math.abs(rothFvAfterTax - tradAfterTax);
  const winner: RothVsTradResult["winner"] =
    Math.abs(rothFvAfterTax - tradAfterTax) < 1
      ? "tie"
      : rothFvAfterTax > tradAfterTax
        ? "roth"
        : "traditional";

  const steps: MathStep[] = [
    {
      label: "Committing the same pre-tax dollars",
      formula: `${formatUsd(c)} / year for ${years} years`,
      result: `${formatUsd(c * years)} of gross contributions`,
    },
    {
      label: "Traditional: full amount grows tax-deferred",
      formula: `FV of ${formatUsd(c)}/yr at ${returnPct}% for ${years} yrs`,
      result: formatUsd(tradFvPretax),
    },
    {
      label: "Traditional: taxed on withdrawal at retirement rate",
      formula: `${formatUsd(tradFvPretax)} × (1 − ${formatPct(retirementRate)})`,
      result: formatUsd(tradAfterTax),
    },
    {
      label: "Roth: pay tax now, so less goes in",
      formula: `${formatUsd(c)} × (1 − ${formatPct(currentRate)})`,
      result: `${formatUsd(rothContribution)} / year`,
    },
    {
      label: "Roth: grows tax-free, nothing owed later",
      formula: `FV of ${formatUsd(rothContribution)}/yr at ${returnPct}% for ${years} yrs`,
      result: formatUsd(rothFvAfterTax),
    },
    {
      label: "After-tax difference",
      formula: `${formatUsd(rothFvAfterTax)} − ${formatUsd(tradAfterTax)}`,
      result: `${winner === "roth" ? "+" : "−"}${formatUsd(difference)} for ${winner === "tie" ? "either" : winner === "roth" ? "Roth" : "Traditional"}`,
    },
  ];

  return {
    tradFvPretax,
    tradAfterTax,
    rothContribution,
    rothFvAfterTax,
    taxSavedNowPerYear,
    winner,
    difference,
    steps,
  };
}

// ------------------------------------------------------------------
// Roth IRA: should you contribute (and how much are you allowed)?
// ------------------------------------------------------------------

export interface RothIraInput {
  annualContribution: number;
  returnPct: number;
  years: number;
  /** Long-term capital-gains rate on the taxable alternative (fraction). */
  ltcgRate: number;
  /** Modified AGI used for the phase-out (approximated by gross income). */
  magi: number;
  filingStatus: FilingStatus;
  /** Statutory contribution limit (e.g. 7000 in 2025). */
  limit: number;
}

export interface RothIraResult {
  phaseoutStart: number;
  phaseoutEnd: number;
  eligible: boolean;
  maxAllowed: number;
  effectiveContribution: number;
  rothFv: number;
  taxableAfterTax: number;
  advantage: number;
  steps: MathStep[];
  note: string;
}

export function rothIraDecision(input: RothIraInput): RothIraResult {
  const { annualContribution, returnPct, years, ltcgRate, magi, filingStatus, limit } = input;
  const [start, end] = ROTH_IRA_PHASEOUT[filingStatus];

  let maxAllowed: number;
  if (magi <= start) maxAllowed = limit;
  else if (magi >= end) maxAllowed = 0;
  else {
    const fraction = (end - magi) / (end - start);
    maxAllowed = Math.floor((limit * fraction) / 10) * 10;
  }
  const eligible = maxAllowed > 0;
  const effectiveContribution = Math.min(annualContribution, maxAllowed);

  const rothFv = fvAnnuity(effectiveContribution, returnPct, years);
  const taxableFvPre = fvAnnuity(effectiveContribution, returnPct, years);
  const contributionsTotal = effectiveContribution * years;
  const gains = taxableFvPre - contributionsTotal;
  const taxOnGains = gains * ltcgRate;
  const taxableAfterTax = taxableFvPre - taxOnGains;
  const advantage = rothFv - taxableAfterTax;

  const steps: MathStep[] = [
    {
      label: "Eligibility (MAGI phase-out)",
      formula: `MAGI ${formatUsd(magi)} vs ${formatUsd(start)}–${formatUsd(end)}`,
      result: eligible
        ? `Allowed up to ${formatUsd(maxAllowed)}`
        : "Above the limit — direct Roth IRA not allowed",
    },
    {
      label: "Contribution used in this estimate",
      formula: `min(${formatUsd(annualContribution)}, ${formatUsd(maxAllowed)}) × ${years} yrs`,
      result: `${formatUsd(effectiveContribution)}/yr → ${formatUsd(contributionsTotal)} in`,
    },
    {
      label: "Roth IRA value (tax-free)",
      formula: `FV at ${returnPct}% for ${years} yrs`,
      result: formatUsd(rothFv),
    },
    {
      label: "Same money in a taxable account, gains taxed",
      formula: `${formatUsd(taxableFvPre)} − (${formatUsd(gains)} gain × ${formatPct(ltcgRate)})`,
      result: formatUsd(taxableAfterTax),
    },
    {
      label: "Roth advantage (taxes avoided)",
      formula: `${formatUsd(rothFv)} − ${formatUsd(taxableAfterTax)}`,
      result: formatUsd(advantage),
    },
  ];

  const note = !eligible
    ? "Your income is above the direct Roth IRA range. Look into a 'backdoor Roth IRA' (contribute to a traditional IRA, then convert)."
    : magi > start
      ? "You're in the phase-out range, so your allowed amount is reduced. A backdoor Roth IRA can side-step this."
      : "You can contribute the full amount. Tax-free growth is especially valuable while your tax rate is low.";

  return {
    phaseoutStart: start,
    phaseoutEnd: end,
    eligible,
    maxAllowed,
    effectiveContribution,
    rothFv,
    taxableAfterTax,
    advantage,
    steps,
    note,
  };
}

// ------------------------------------------------------------------
// Should you max the HSA?
// ------------------------------------------------------------------

export interface HsaInput {
  annualContribution: number;
  /** Combined federal + state marginal rate (fraction). */
  marginalRate: number;
  /** Include the 7.65% FICA savings (true if contributed via employer payroll). */
  includeFica: boolean;
  returnPct: number;
  years: number;
  ltcgRate: number;
}

export interface HsaResult {
  upfrontTaxSavedPerYear: number;
  ficaSavedPerYear: number;
  totalUpfrontPerYear: number;
  fvTaxFree: number;
  taxableAfterTax: number;
  advantage: number;
  steps: MathStep[];
}

const FICA_RATE = 0.0765;

export function hsaDecision(input: HsaInput): HsaResult {
  const { annualContribution: c, marginalRate, includeFica, returnPct, years, ltcgRate } = input;

  const upfrontTaxSavedPerYear = c * marginalRate;
  const ficaSavedPerYear = includeFica ? c * FICA_RATE : 0;
  const totalUpfrontPerYear = upfrontTaxSavedPerYear + ficaSavedPerYear;

  const fvTaxFree = fvAnnuity(c, returnPct, years);

  // Alternative: take it as income (lose the deduction), invest what's left.
  const taxableContribution = c * (1 - marginalRate);
  const taxableFvPre = fvAnnuity(taxableContribution, returnPct, years);
  const taxableContribTotal = taxableContribution * years;
  const gains = taxableFvPre - taxableContribTotal;
  const taxableAfterTax = taxableFvPre - gains * ltcgRate;
  const advantage = fvTaxFree - taxableAfterTax;

  const steps: MathStep[] = [
    {
      label: "Immediate income-tax saved",
      formula: `${formatUsd(c)} × ${formatPct(marginalRate)} marginal rate`,
      result: `${formatUsd(upfrontTaxSavedPerYear)} / year`,
    },
    ...(includeFica
      ? [
          {
            label: "Payroll (FICA) tax also saved",
            formula: `${formatUsd(c)} × 7.65%`,
            result: `${formatUsd(ficaSavedPerYear)} / year`,
          },
        ]
      : []),
    {
      label: "HSA value if invested (tax-free for medical)",
      formula: `FV of ${formatUsd(c)}/yr at ${returnPct}% for ${years} yrs`,
      result: formatUsd(fvTaxFree),
    },
    {
      label: "Alternative: taxed income, then invested",
      formula: `FV of ${formatUsd(taxableContribution)}/yr, gains taxed ${formatPct(ltcgRate)}`,
      result: formatUsd(taxableAfterTax),
    },
    {
      label: "HSA advantage over time",
      formula: `${formatUsd(fvTaxFree)} − ${formatUsd(taxableAfterTax)}`,
      result: formatUsd(advantage),
    },
  ];

  return {
    upfrontTaxSavedPerYear,
    ficaSavedPerYear,
    totalUpfrontPerYear,
    fvTaxFree,
    taxableAfterTax,
    advantage,
    steps,
  };
}
