import type { HouseholdState, Member } from "../types";
import {
  FEDERAL_BRACKETS,
  MEDICARE_RATE,
  SS_RATE,
  SS_WAGE_BASE,
  STANDARD_DEDUCTION,
  TAX_YEAR,
} from "./taxTables";

// Realistic but entirely placeholder figures. Everything is editable in-app;
// nothing here reflects real accounts.

const SHWETA_COLOR = "#f472b6";
const KARAN_COLOR = "#818cf8";

const shweta: Member = {
  id: "shweta",
  name: "Shweta",
  color: SHWETA_COLOR,
  notes:
    "US citizen, Internal Medicine resident (single filer). Modest resident stipend and a low tax " +
    "bracket right now, but expects to become an attending in a few years with a large pay jump. " +
    "That temporary low bracket is exactly when Roth contributions and a direct Roth IRA are most valuable. " +
    "Works in Detroit but lives outside the city, so she also owes the 1.2% non-resident city income tax.",
  cityTaxRatePct: 1.2,
  cityTaxLabel: "Detroit city tax (non-resident 1.2%)",
  incomes: [
    {
      id: "shweta-stipend",
      name: "Residency stipend",
      annualGross: 68000,
      currency: "USD",
      taxable: true,
      payout: "monthly",
    },
    {
      id: "shweta-moonlight",
      name: "Moonlighting",
      annualGross: 6000,
      currency: "USD",
      taxable: true,
      payout: "annual",
      payoutMonth: 9,
    },
  ],
  deductions: {
    retirementAnnual: 7000,
    retirementType: "roth",
    iraAnnual: 7000,
    iraType: "roth",
    hsaAnnual: 0,
    employerMatchPct: 0.03,
  },
  expenses: [
    { id: "shweta-rent", name: "Rent", amount: 1500, currency: "USD", cadence: "monthly", category: "Housing", essential: true },
    { id: "shweta-groceries", name: "Groceries", amount: 400, currency: "USD", cadence: "monthly", category: "Food", essential: true },
    { id: "shweta-utilities", name: "Utilities + phone", amount: 160, currency: "USD", cadence: "monthly", category: "Housing", essential: true },
    { id: "shweta-transport", name: "Car + fuel", amount: 350, currency: "USD", cadence: "monthly", category: "Transport", essential: true },
    { id: "shweta-board", name: "Board exams / CME", amount: 1800, currency: "USD", cadence: "yearly", category: "Career", essential: false },
    { id: "shweta-lifestyle", name: "Lifestyle", amount: 350, currency: "USD", cadence: "monthly", category: "Lifestyle", essential: false },
  ],
  accounts: [
    { id: "shweta-checking", name: "Checking", type: "checking", balance: 5000, currency: "USD", annualGrowthPct: 0, taxableGrowth: true, isPrimaryCash: true },
    { id: "shweta-hysa", name: "High-yield savings", type: "savings", balance: 14000, currency: "USD", annualGrowthPct: 3.8, taxableGrowth: true },
    { id: "shweta-403b", name: "403(b)", type: "403b", balance: 9000, currency: "USD", annualGrowthPct: 7, taxableGrowth: false },
    { id: "shweta-roth-ira", name: "Roth IRA", type: "brokerage", balance: 7000, currency: "USD", annualGrowthPct: 7, taxableGrowth: false },
  ],
  loans: [
    {
      id: "shweta-student",
      name: "Student loans",
      kind: "student",
      currency: "USD",
      principal: 210000,
      annualRatePct: 6.5,
      emi: 250,
      termMonths: 240,
      extraMonthlyPayment: 0,
    },
  ],
  futureStage: {
    label: "Attending physician",
    annualGrossUsd: 285000,
    startInYears: 3,
  },
  retirement: {
    currentAge: 29,
    retireAge: 50,
    realReturnPct: 5,
    withdrawalRatePct: 4,
  },
};

const karan: Member = {
  id: "karan",
  name: "Karan",
  color: KARAN_COLOR,
  hidden: true,
  notes:
    "Immigrant from India on a work visa, mid/senior software engineer (single filer). Paid well: " +
    "base plus bonus and RSUs. Maxes 401(k) and HSA. Carries a home loan in India (INR).",
  incomes: [
    { id: "karan-base", name: "Base salary", annualGross: 165000, currency: "USD", taxable: true, payout: "monthly" },
    { id: "karan-bonus", name: "Annual bonus", annualGross: 16500, currency: "USD", taxable: true, payout: "annual", payoutMonth: 2 },
    { id: "karan-rsu", name: "RSU vest", annualGross: 20000, currency: "USD", taxable: true, payout: "annual", payoutMonth: 3 },
  ],
  deductions: {
    retirementAnnual: 24500,
    retirementType: "traditional",
    iraAnnual: 7500,
    iraType: "traditional",
    hsaAnnual: 4400,
    employerMatchPct: 0.1,
  },
  expenses: [
    { id: "karan-rent", name: "Rent", amount: 1900, currency: "USD", cadence: "monthly", category: "Housing", essential: true },
    { id: "karan-groceries", name: "Groceries", amount: 450, currency: "USD", cadence: "monthly", category: "Food", essential: true },
    { id: "karan-utilities", name: "Utilities", amount: 180, currency: "USD", cadence: "monthly", category: "Housing", essential: true },
    { id: "karan-transport", name: "Car + fuel", amount: 500, currency: "USD", cadence: "monthly", category: "Transport", essential: true },
    { id: "karan-dining", name: "Dining out", amount: 350, currency: "USD", cadence: "monthly", category: "Lifestyle", essential: false },
    { id: "karan-family", name: "Family support (India)", amount: 400, currency: "USD", cadence: "monthly", category: "Family", essential: false },
    { id: "karan-travel", name: "India trip", amount: 2500, currency: "USD", cadence: "yearly", category: "Travel", essential: false },
  ],
  accounts: [
    { id: "karan-checking", name: "Checking", type: "checking", balance: 8000, currency: "USD", annualGrowthPct: 0, taxableGrowth: true, isPrimaryCash: true },
    { id: "karan-hysa", name: "High-yield savings", type: "savings", balance: 32000, currency: "USD", annualGrowthPct: 3.8, taxableGrowth: true },
    { id: "karan-401k", name: "401(k)", type: "401k", balance: 62000, currency: "USD", annualGrowthPct: 7, taxableGrowth: false },
    { id: "karan-hsa", name: "HSA", type: "hsa", balance: 4500, currency: "USD", annualGrowthPct: 6, taxableGrowth: false },
    { id: "karan-brokerage", name: "Brokerage", type: "brokerage", balance: 18000, currency: "USD", annualGrowthPct: 7, taxableGrowth: true },
  ],
  loans: [
    {
      id: "karan-home-inr",
      name: "Home loan (India)",
      kind: "home",
      currency: "INR",
      principal: 11427161,
      annualRatePct: 8.05,
      emi: 203000,
      termMonths: 76,
      extraMonthlyPayment: 0,
      fxRate: 86,
    },
  ],
  retirement: {
    currentAge: 33,
    retireAge: 50,
    realReturnPct: 5,
    withdrawalRatePct: 4,
  },
};

export function makeSeedState(): HouseholdState {
  const filingStatus = "single";
  return {
    members: [structuredClone(shweta), structuredClone(karan)],
    tax: {
      year: TAX_YEAR,
      filingStatus,
      state: "Michigan",
      stateFlatRatePct: 4.25,
      stateExemptionUsd: 5900, // MI 2026 personal exemption (no standard deduction)
      standardDeduction: STANDARD_DEDUCTION[filingStatus],
      federalBrackets: FEDERAL_BRACKETS[filingStatus],
      ssWageBase: SS_WAGE_BASE,
      ssRatePct: SS_RATE * 100,
      medicareRatePct: MEDICARE_RATE * 100,
    },
    settings: {
      projectionMonths: 60,
      emergencyFundMonths: 4,
      usdInrFxRate: 86,
      llm: {
        baseUrl: "http://localhost:11434",
        model: "llama3.1",
        temperature: 0.4,
      },
    },
    scenarios: [],
  };
}

export const SCHEMA_VERSION = 5;
