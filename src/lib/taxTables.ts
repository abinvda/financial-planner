import type { FilingStatus, TaxBracket } from "../types";

// The tax year these tables describe. Everything is editable in-app; these are
// planning approximations, not tax advice.
export const TAX_YEAR = 2026;

// 2026 U.S. federal marginal brackets. Values are the upper bound of each
// bracket; the last bracket uses Infinity.
export const FEDERAL_BRACKETS: Record<FilingStatus, TaxBracket[]> = {
  single: [
    { upTo: 12400, rate: 0.1 },
    { upTo: 50400, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256225, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married_jointly: [
    { upTo: 24800, rate: 0.1 },
    { upTo: 100800, rate: 0.12 },
    { upTo: 211400, rate: 0.22 },
    { upTo: 403550, rate: 0.24 },
    { upTo: 512450, rate: 0.32 },
    { upTo: 768700, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  married_separately: [
    { upTo: 12400, rate: 0.1 },
    { upTo: 50400, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256225, rate: 0.32 },
    { upTo: 384350, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
  head_of_household: [
    { upTo: 17700, rate: 0.1 },
    { upTo: 67450, rate: 0.12 },
    { upTo: 105700, rate: 0.22 },
    { upTo: 201775, rate: 0.24 },
    { upTo: 256200, rate: 0.32 },
    { upTo: 640600, rate: 0.35 },
    { upTo: Infinity, rate: 0.37 },
  ],
};

// 2026 standard deduction (includes the OBBBA increase).
export const STANDARD_DEDUCTION: Record<FilingStatus, number> = {
  single: 16100,
  married_jointly: 32200,
  married_separately: 16100,
  head_of_household: 24150,
};

// 2026 FICA parameters.
export const SS_WAGE_BASE = 184500;
export const SS_RATE = 0.062;
export const MEDICARE_RATE = 0.0145;

// 2026 IRS contribution limits (for reference / UI hints).
export const LIMIT_401K_EMPLOYEE = 24500;
export const LIMIT_401K_CATCHUP = 8000; // additional at age 50+
export const LIMIT_HSA_SELF = 4400;
export const LIMIT_HSA_FAMILY = 8750;
export const LIMIT_HSA_CATCHUP = 1000; // additional at age 55+
export const LIMIT_ROTH_IRA = 7500;
export const LIMIT_ROTH_IRA_CATCHUP = 1100; // additional at age 50+

// 2026 Roth IRA MAGI phase-out ranges [start, end] by filing status.
// Contribution is reduced linearly across the range and disallowed above `end`.
export const ROTH_IRA_PHASEOUT: Record<FilingStatus, [number, number]> = {
  single: [153000, 168000],
  head_of_household: [153000, 168000],
  married_jointly: [242000, 252000],
  married_separately: [0, 10000],
};

export const FILING_STATUS_LABELS: Record<FilingStatus, string> = {
  single: "Single",
  married_jointly: "Married filing jointly",
  married_separately: "Married filing separately",
  head_of_household: "Head of household",
};
