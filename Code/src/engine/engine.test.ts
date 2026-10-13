import { describe, it, expect } from "vitest";
import {
  amortize,
  comparePrepayments,
  computeEmi,
  computeMemberSummary,
  emergencyFundStatus,
  federalMarginalRate,
  federalTax,
  loanVsInvest,
  projectHousehold,
} from "./index";
import { FEDERAL_BRACKETS, SS_WAGE_BASE, STANDARD_DEDUCTION } from "../lib/taxTables";
import { makeSeedState } from "../lib/seed";
import type { Loan, Member, TaxProfile } from "../types";

const singleTax: TaxProfile = {
  year: 2026,
  filingStatus: "single",
  state: "Michigan",
  stateFlatRatePct: 4.25,
  standardDeduction: STANDARD_DEDUCTION.single,
  federalBrackets: FEDERAL_BRACKETS.single,
  ssWageBase: SS_WAGE_BASE,
  ssRatePct: 6.2,
  medicareRatePct: 1.45,
};

describe("federal tax", () => {
  it("applies progressive brackets", () => {
    // Single 2026 on $50,000 taxable: 10% of 12,400 + 12% of 37,600.
    const tax = federalTax(50000, FEDERAL_BRACKETS.single);
    expect(tax).toBeCloseTo(5752, 0);
  });

  it("returns 0 for non-positive income", () => {
    expect(federalTax(0, FEDERAL_BRACKETS.single)).toBe(0);
    expect(federalTax(-1000, FEDERAL_BRACKETS.single)).toBe(0);
  });

  it("reports the marginal bracket", () => {
    expect(federalMarginalRate(50000, FEDERAL_BRACKETS.single)).toBe(0.12);
    expect(federalMarginalRate(10000, FEDERAL_BRACKETS.single)).toBe(0.1);
    expect(federalMarginalRate(300000, FEDERAL_BRACKETS.single)).toBe(0.35);
  });
});

describe("EMI + amortization", () => {
  it("computes a standard EMI", () => {
    // $100k at 12% for 12 months.
    expect(computeEmi(100000, 12, 12)).toBeCloseTo(8884.88, 1);
  });

  it("pays off a loan and accrues interest", () => {
    const loan: Loan = {
      id: "l1",
      name: "Test",
      kind: "home",
      currency: "USD",
      principal: 100000,
      annualRatePct: 12,
      emi: computeEmi(100000, 12, 12),
      termMonths: 12,
    };
    const r = amortize(loan);
    expect(r.totalMonths).toBe(12);
    expect(r.months.at(-1)!.balance).toBeLessThan(1);
    expect(r.totalInterest).toBeGreaterThan(0);
  });

  it("extra payments cut interest and time", () => {
    const loan: Loan = {
      id: "l2",
      name: "Home INR",
      kind: "home",
      currency: "INR",
      principal: 11427161,
      annualRatePct: 8.05,
      emi: 203000,
      termMonths: 76,
      fxRate: 86,
    };
    const rows = comparePrepayments(loan, [0, 50000]);
    const [base, extra] = rows;
    expect(extra.totalInterest).toBeLessThan(base.totalInterest);
    expect(extra.totalMonths).toBeLessThan(base.totalMonths);
    expect(extra.interestSaved).toBeGreaterThan(0);
  });

  it("loan-vs-invest compares interest saved to investment gain", () => {
    const loan: Loan = {
      id: "l3",
      name: "Home INR",
      kind: "home",
      currency: "INR",
      principal: 11427161,
      annualRatePct: 8.05,
      emi: 203000,
      termMonths: 76,
      fxRate: 86,
    };
    const res = loanVsInvest(loan, 50000, 10);
    expect(res.interestSaved).toBeGreaterThan(0);
    expect(res.investmentFutureValue).toBeGreaterThan(res.contributionsTotal);
    expect(Number.isFinite(res.netAdvantageOfInvesting)).toBe(true);
  });
});

describe("member finance", () => {
  const member: Member = {
    id: "m1",
    name: "Test",
    color: "#fff",
    notes: "",
    incomes: [
      { id: "i1", name: "Salary", annualGross: 120000, currency: "USD", taxable: true, payout: "monthly" },
      { id: "i2", name: "Bonus", annualGross: 12000, currency: "USD", taxable: true, payout: "annual", payoutMonth: 2 },
    ],
    deductions: { retirementAnnual: 12000, retirementType: "traditional", hsaAnnual: 0, employerMatchPct: 0.05 },
    expenses: [
      { id: "e1", name: "Rent", amount: 1500, currency: "USD", cadence: "monthly", category: "Housing", essential: true },
      { id: "e2", name: "Fun", amount: 500, currency: "USD", cadence: "monthly", category: "Lifestyle", essential: false },
    ],
    accounts: [
      { id: "a1", name: "Checking", type: "checking", balance: 5000, currency: "USD", annualGrowthPct: 0, taxableGrowth: true, isPrimaryCash: true },
    ],
    loans: [],
  };

  it("produces sensible take-home and savings rate", () => {
    const s = computeMemberSummary(member, singleTax, 86);
    expect(s.grossAnnualUsd).toBe(132000);
    expect(s.takeHomeAnnual).toBeGreaterThan(0);
    expect(s.takeHomeAnnual).toBeLessThan(s.grossAnnualUsd);
    expect(s.monthlyBaseNet).toBeGreaterThan(0);
    expect(s.savingsRate).toBeGreaterThan(0);
    expect(s.savingsRate).toBeLessThanOrEqual(1);
    // Bonus lands in Feb (month 2).
    expect(s.lumpsByMonth[2]).toBeGreaterThan(0);
    expect(s.employerMatchAnnual).toBeCloseTo(120000 * 0.05, 0);
  });

  it("converts INR income to USD", () => {
    const inr: Member = {
      ...member,
      incomes: [
        { id: "i1", name: "INR salary", annualGross: 8600000, currency: "INR", taxable: true, payout: "monthly" },
      ],
    };
    const s = computeMemberSummary(inr, singleTax, 86);
    expect(s.grossAnnualUsd).toBeCloseTo(100000, 0);
  });
});

describe("projection + emergency fund", () => {
  it("projects growing net worth for the seed household", () => {
    const seed = makeSeedState();
    const { points, summaries } = projectHousehold(seed.members, seed.tax, seed.settings, {
      months: 24,
    });
    expect(points.length).toBe(25); // month 0..24
    expect(points[0].label).toBe("Now");
    // Net worth should be assets - debt at every point.
    for (const p of points) {
      expect(p.netWorthUsd).toBeCloseTo(p.assetsUsd - p.debtUsd, 3);
    }
    // Debt should shrink over time (loans amortize).
    expect(points.at(-1)!.debtUsd).toBeLessThan(points[0].debtUsd);
    expect(summaries.length).toBe(2);
  });

  it("computes emergency-fund coverage", () => {
    const seed = makeSeedState();
    const summaries = seed.members.map((m) =>
      computeMemberSummary(m, seed.tax, seed.settings.usdInrFxRate),
    );
    const ef = emergencyFundStatus(
      seed.members,
      summaries,
      seed.settings.emergencyFundMonths,
      seed.settings.usdInrFxRate,
    );
    expect(ef.liquidUsd).toBeGreaterThan(0);
    expect(ef.monthlyEssentialUsd).toBeGreaterThan(0);
    expect(ef.coverageMonths).toBeGreaterThan(0);
    expect(ef.targetUsd).toBeCloseTo(ef.monthlyEssentialUsd * 4, 3);
  });

  it("applies scenario events to the projection", () => {
    const seed = makeSeedState();
    const base = projectHousehold(seed.members, seed.tax, seed.settings, { months: 12 });
    const withWindfall = projectHousehold(seed.members, seed.tax, seed.settings, {
      months: 12,
      scenarioEvents: [
        {
          id: "s1",
          name: "Windfall",
          target: "household",
          type: "windfall",
          amountUsd: 50000,
          month: 1,
          enabled: true,
        },
      ],
    });
    expect(withWindfall.points.at(-1)!.netWorthUsd).toBeGreaterThan(
      base.points.at(-1)!.netWorthUsd,
    );
  });
});
