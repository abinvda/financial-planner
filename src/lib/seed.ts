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

const JOHN_COLOR = "#f472b6";
const JANE_COLOR = "#818cf8";

const john: Member = {
  id: "john",
  name: "John",
  color: JOHN_COLOR,
  notes: "",
  cityTaxRatePct: 1.2,
  cityTaxLabel: "City income tax (non-resident)",
  incomes: [
    {
      id: "john-salary",
      name: "Salary",
      annualGross: 68000,
      currency: "USD",
      taxable: true,
      payout: "monthly",
    },
    {
      id: "john-side",
      name: "Side income",
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
    { id: "john-rent", name: "Rent", amount: 1500, currency: "USD", cadence: "monthly", category: "Housing", essential: true },
    { id: "john-groceries", name: "Groceries", amount: 400, currency: "USD", cadence: "monthly", category: "Food", essential: true },
    { id: "john-utilities", name: "Utilities + phone", amount: 160, currency: "USD", cadence: "monthly", category: "Housing", essential: true },
    { id: "john-transport", name: "Car + fuel", amount: 350, currency: "USD", cadence: "monthly", category: "Transport", essential: true },
    { id: "john-career", name: "Professional development", amount: 1800, currency: "USD", cadence: "yearly", category: "Career", essential: false },
    { id: "john-lifestyle", name: "Lifestyle", amount: 350, currency: "USD", cadence: "monthly", category: "Lifestyle", essential: false },
  ],
  accounts: [
    { id: "john-checking", name: "Checking", type: "checking", balance: 5000, currency: "USD", annualGrowthPct: 0, taxableGrowth: true, isPrimaryCash: true },
    { id: "john-hysa", name: "High-yield savings", type: "savings", balance: 14000, currency: "USD", annualGrowthPct: 3.8, taxableGrowth: true },
    { id: "john-403b", name: "403(b)", type: "403b", balance: 9000, currency: "USD", annualGrowthPct: 7, taxableGrowth: false },
    { id: "john-roth-ira", name: "Roth IRA", type: "brokerage", balance: 7000, currency: "USD", annualGrowthPct: 7, taxableGrowth: false },
  ],
  loans: [
    {
      id: "john-student",
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
    label: "Higher income",
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

const jane: Member = {
  id: "jane",
  name: "Jane",
  color: JANE_COLOR,
  hidden: true,
  notes: "",
  incomes: [
    { id: "jane-base", name: "Base salary", annualGross: 165000, currency: "USD", taxable: true, payout: "monthly" },
    { id: "jane-bonus", name: "Annual bonus", annualGross: 16500, currency: "USD", taxable: true, payout: "annual", payoutMonth: 2 },
    { id: "jane-rsu", name: "RSU vest", annualGross: 20000, currency: "USD", taxable: true, payout: "annual", payoutMonth: 3 },
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
    { id: "jane-rent", name: "Rent", amount: 1900, currency: "USD", cadence: "monthly", category: "Housing", essential: true },
    { id: "jane-groceries", name: "Groceries", amount: 450, currency: "USD", cadence: "monthly", category: "Food", essential: true },
    { id: "jane-utilities", name: "Utilities", amount: 180, currency: "USD", cadence: "monthly", category: "Housing", essential: true },
    { id: "jane-transport", name: "Car + fuel", amount: 500, currency: "USD", cadence: "monthly", category: "Transport", essential: true },
    { id: "jane-dining", name: "Dining out", amount: 350, currency: "USD", cadence: "monthly", category: "Lifestyle", essential: false },
    { id: "jane-family", name: "Family support", amount: 400, currency: "USD", cadence: "monthly", category: "Family", essential: false },
    { id: "jane-travel", name: "Travel", amount: 2500, currency: "USD", cadence: "yearly", category: "Travel", essential: false },
  ],
  accounts: [
    { id: "jane-checking", name: "Checking", type: "checking", balance: 8000, currency: "USD", annualGrowthPct: 0, taxableGrowth: true, isPrimaryCash: true },
    { id: "jane-hysa", name: "High-yield savings", type: "savings", balance: 32000, currency: "USD", annualGrowthPct: 3.8, taxableGrowth: true },
    { id: "jane-401k", name: "401(k)", type: "401k", balance: 62000, currency: "USD", annualGrowthPct: 7, taxableGrowth: false },
    { id: "jane-hsa", name: "HSA", type: "hsa", balance: 4500, currency: "USD", annualGrowthPct: 6, taxableGrowth: false },
    { id: "jane-brokerage", name: "Brokerage", type: "brokerage", balance: 18000, currency: "USD", annualGrowthPct: 7, taxableGrowth: true },
  ],
  loans: [
    {
      id: "jane-home",
      name: "Home loan",
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
    members: [structuredClone(john), structuredClone(jane)],
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

export const SCHEMA_VERSION = 6;
