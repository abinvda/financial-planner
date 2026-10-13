import { describe, it, expect } from "vitest";
import { simulateStudentLoan, computeStudentLoanAnalysis } from "./studentLoan";

describe("simulateStudentLoan", () => {
  it("pays off a loan and reports interest = totalPaid − principal", () => {
    const sim = simulateStudentLoan(10_000, 6, () => 500);
    expect(sim.paidOff).toBe(true);
    expect(sim.endingBalance).toBeCloseTo(0, 2);
    // Interest paid is everything above the original principal.
    expect(sim.interestPaid).toBeCloseTo(sim.totalPaid - 10_000, 2);
    expect(sim.interestPaid).toBeGreaterThan(0);
  });

  it("negatively amortizes when the payment is below the monthly interest", () => {
    // 6% on 100k = ~$500/mo interest; paying $200 grows the balance.
    const sim = simulateStudentLoan(100_000, 6, () => 200, { stopAtMonth: 12 });
    expect(sim.paidOff).toBe(false);
    expect(sim.endingBalance).toBeGreaterThan(100_000);
    expect(sim.payoffMonth).toBeNull();
  });

  it("stops at the forgiveness month", () => {
    const sim = simulateStudentLoan(50_000, 5, () => 300, { stopAtMonth: 120 });
    // 121 entries: opening balance + 120 months.
    expect(sim.balanceByMonth.length).toBe(121);
  });

  it("caps the final payment so the balance never goes negative", () => {
    const sim = simulateStudentLoan(1_000, 6, () => 10_000);
    expect(sim.paidOff).toBe(true);
    expect(sim.endingBalance).toBe(0);
    expect(sim.totalPaid).toBeLessThan(1_100); // one month of interest + principal
  });
});

describe("computeStudentLoanAnalysis", () => {
  const input = {
    balance: 210_000,
    annualRatePct: 6.5,
    monthsUntilAttending: 36,
    idrResidentMonthly: 250,
    idrAttendingMonthly: 2_180,
    residentSideInvestMonthly: 400,
    aggressiveAttendingMonthly: 5_000,
    forgivenessMonths: 120,
  };

  it("forgives a large balance under PSLF after minimum payments", () => {
    const a = computeStudentLoanAnalysis(input);
    // Minimums are below interest for years, so plenty is left to forgive.
    expect(a.pslfWorks.forgiven).toBeGreaterThan(0);
    expect(a.pslfWorks.outOfPocket).toBeLessThan(input.balance);
  });

  it("paying aggressively once attending costs less interest than PSLF denied", () => {
    const a = computeStudentLoanAnalysis(input);
    expect(a.aggressiveFromAttending.sim.interestPaid).toBeLessThan(a.pslfFails.sim.interestPaid);
  });

  it("quantifies the extra interest of a failed PSLF bet vs attending payoff", () => {
    const a = computeStudentLoanAnalysis(input);
    expect(a.extraInterestVsAttending).toBeGreaterThan(0);
    expect(a.extraInterestVsAttending).toBeCloseTo(
      a.pslfFails.sim.interestPaid - a.aggressiveFromAttending.sim.interestPaid,
      2,
    );
  });

  it("shows a positive PSLF upside vs. clearing it as an attending", () => {
    const a = computeStudentLoanAnalysis(input);
    expect(a.pslfSavingsVsAttending).toBeGreaterThan(0);
  });

  it("minimums-to-the-end costs more interest than aggressive paths", () => {
    const a = computeStudentLoanAnalysis(input);
    expect(a.minimumForever.sim.interestPaid).toBeGreaterThan(a.pslfFails.sim.interestPaid);
    expect(a.minimumForever.sim.payoffMonth).not.toBeNull();
  });

  it("side investing builds a portfolio and reduces interest if PSLF fails", () => {
    const a = computeStudentLoanAnalysis({ ...input, investReturnPct: 7 });
    expect(a.pslfHedgeInvest.hedge.portfolioAtForgiveness).toBeGreaterThan(a.pslfHedgeInvest.hedge.totalInvested);
    expect(a.pslfHedgeInvest.hedge.lumpSumApplied).toBeGreaterThan(0);
    expect(a.pslfHedgeInvest.sim.interestPaid).toBeLessThanOrEqual(a.pslfFails.sim.interestPaid);
  });

  it("if PSLF works with side investing, portfolio is kept alongside forgiveness", () => {
    const a = computeStudentLoanAnalysis({ ...input, investReturnPct: 7 });
    expect(a.pslfHedgeIfWorks.forgiven).toBeGreaterThan(0);
    expect(a.pslfHedgeIfWorks.hedge.portfolioAtForgiveness).toBeGreaterThan(0);
    expect(a.pslfHedgeIfWorks.hedge.lumpSumApplied).toBe(0);
  });

  it("hedge PSLF-fail interest reflects accrued interest, not zero when lump sum clears the loan", () => {
    const a = computeStudentLoanAnalysis({ ...input, investReturnPct: 7 });
    const { pslfHedgeInvest: h } = a;
    const totalToLoan = h.outOfPocket + h.hedge.lumpSumApplied;
    expect(totalToLoan).toBeGreaterThan(input.balance);
    expect(h.sim.interestPaid).toBeGreaterThan(0);
    expect(h.sim.interestPaid).toBeLessThan(totalToLoan);
  });
});
