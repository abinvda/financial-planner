import { describe, it, expect } from "vitest";
import { investedAssetsUsd, projectRetirement } from "./retirement";
import type { Account } from "../types";

describe("investedAssetsUsd", () => {
  it("sums everything except checking (cash)", () => {
    const accounts: Account[] = [
      { id: "c", name: "Checking", type: "checking", balance: 5000, currency: "USD", annualGrowthPct: 0, taxableGrowth: true },
      { id: "s", name: "HYSA", type: "savings", balance: 10000, currency: "USD", annualGrowthPct: 4, taxableGrowth: true },
      { id: "b", name: "Brokerage", type: "brokerage", balance: 20000, currency: "USD", annualGrowthPct: 7, taxableGrowth: true },
    ];
    expect(investedAssetsUsd(accounts, 86)).toBe(30000);
  });
});

describe("projectRetirement", () => {
  it("derives the FIRE number from spending and the withdrawal rate", () => {
    const r = projectRetirement({
      currentAge: 30,
      retireAge: 55,
      currentInvested: 100000,
      annualContribution: 20000,
      realReturnPct: 5,
      withdrawalRatePct: 4,
      annualSpending: 40000,
    });
    // 40,000 / 4% = 1,000,000.
    expect(r.fireNumber).toBeCloseTo(1_000_000, 0);
    // Coast number is the FIRE number discounted back over the years to retirement.
    expect(r.coastNumber).toBeCloseTo(1_000_000 / Math.pow(1.05, 25), 0);
    expect(r.coastNumber).toBeLessThan(r.fireNumber);
  });

  it("never sets Coast FIRE above the FIRE number when the real return is positive", () => {
    const r = projectRetirement({
      currentAge: 32,
      retireAge: 55,
      currentInvested: 200_000,
      annualContribution: 30_000,
      realReturnPct: 5,
      withdrawalRatePct: 4,
      annualSpending: 60_000,
    });
    expect(r.coastNumber).toBeLessThan(r.fireNumber);
    // Purple "coast path" may exceed FIRE before retire age if you're already past Coast FI.
    const last = r.points.at(-1)!;
    expect(last.coastBalance).toBeGreaterThanOrEqual(r.coastNumber);
  });

  it("flags Coast FIRE once current investments alone would grow into the FIRE number", () => {
    const coasting = projectRetirement({
      currentAge: 35,
      retireAge: 65,
      currentInvested: 300000,
      annualContribution: 0,
      realReturnPct: 5,
      withdrawalRatePct: 4,
      annualSpending: 40000,
    });
    expect(coasting.alreadyCoasting).toBe(true);
    expect(coasting.reachesFireByRetireAge).toBe(true);
  });

  it("reaches FI sooner with a bigger future contribution phase", () => {
    const base = projectRetirement({
      currentAge: 29,
      retireAge: 60,
      currentInvested: 30000,
      annualContribution: 10000,
      realReturnPct: 5,
      withdrawalRatePct: 4,
      annualSpending: 50000,
    });
    const withRamp = projectRetirement({
      currentAge: 29,
      retireAge: 60,
      currentInvested: 30000,
      annualContribution: 10000,
      realReturnPct: 5,
      withdrawalRatePct: 4,
      annualSpending: 50000,
      futureContribution: { annualContribution: 80000, startInYears: 3 },
    });
    expect(withRamp.yearsToFI).not.toBeNull();
    expect(base.yearsToFI).not.toBeNull();
    expect(withRamp.yearsToFI!).toBeLessThan(base.yearsToFI!);
  });
});
