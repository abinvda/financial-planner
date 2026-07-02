import { describe, it, expect } from "vitest";
import { fvAnnuity, hsaDecision, rothIraDecision, rothVsTraditional } from "./decisions";
import { LIMIT_ROTH_IRA } from "../lib/taxTables";

describe("fvAnnuity", () => {
  it("sums contributions with no growth", () => {
    expect(fvAnnuity(1000, 0, 10)).toBe(10000);
  });
  it("compounds annual contributions", () => {
    // $1,000/yr at 10% for 3 yrs, end-of-year = 1000*(1.1^2+1.1+1) = 3310.
    expect(fvAnnuity(1000, 10, 3)).toBeCloseTo(3310, 6);
  });
});

describe("Roth vs Traditional", () => {
  it("Roth wins when retirement rate exceeds today's rate", () => {
    const r = rothVsTraditional({
      annualContribution: 10000,
      currentRate: 0.2,
      retirementRate: 0.3,
      returnPct: 7,
      years: 30,
    });
    expect(r.winner).toBe("roth");
    // Ratio of after-tax values should equal (1-tNow)/(1-tRet).
    expect(r.rothFvAfterTax / r.tradAfterTax).toBeCloseTo((1 - 0.2) / (1 - 0.3), 6);
  });

  it("Traditional wins when today's rate is higher", () => {
    const r = rothVsTraditional({
      annualContribution: 10000,
      currentRate: 0.32,
      retirementRate: 0.22,
      returnPct: 7,
      years: 25,
    });
    expect(r.winner).toBe("traditional");
    expect(r.taxSavedNowPerYear).toBeCloseTo(3200, 6);
  });

  it("is a tie when the rates match", () => {
    const r = rothVsTraditional({
      annualContribution: 5000,
      currentRate: 0.24,
      retirementRate: 0.24,
      returnPct: 6,
      years: 20,
    });
    expect(r.winner).toBe("tie");
  });
});

describe("Roth IRA", () => {
  it("allows the full limit below the phase-out (single, low income)", () => {
    const r = rothIraDecision({
      annualContribution: LIMIT_ROTH_IRA,
      returnPct: 7,
      years: 30,
      ltcgRate: 0.15,
      magi: 65000,
      filingStatus: "single",
      limit: LIMIT_ROTH_IRA,
    });
    expect(r.eligible).toBe(true);
    expect(r.maxAllowed).toBe(LIMIT_ROTH_IRA);
    expect(r.advantage).toBeGreaterThan(0);
  });

  it("disallows contributions above the phase-out (high income)", () => {
    const r = rothIraDecision({
      annualContribution: LIMIT_ROTH_IRA,
      returnPct: 7,
      years: 30,
      ltcgRate: 0.15,
      magi: 400000,
      filingStatus: "married_jointly",
      limit: LIMIT_ROTH_IRA,
    });
    expect(r.eligible).toBe(false);
    expect(r.maxAllowed).toBe(0);
    expect(r.note.toLowerCase()).toContain("backdoor");
  });
});

describe("HSA", () => {
  it("quantifies upfront tax savings and long-term advantage", () => {
    const r = hsaDecision({
      annualContribution: 8550,
      marginalRate: 0.264,
      includeFica: true,
      returnPct: 7,
      years: 30,
      ltcgRate: 0.15,
    });
    expect(r.upfrontTaxSavedPerYear).toBeCloseTo(8550 * 0.264, 6);
    expect(r.ficaSavedPerYear).toBeCloseTo(8550 * 0.0765, 6);
    expect(r.advantage).toBeGreaterThan(0);
    expect(r.fvTaxFree).toBeGreaterThan(r.taxableAfterTax);
  });
});
