import type { FilingStatus, TaxProfile } from "../types";
import { computeTax, federalMarginalRate, federalTax } from "./tax";
import type { MathStep } from "./decisions";
import { formatPct, formatUsd } from "../lib/util";

/**
 * Portion of Social Security benefits subject to federal income tax, using the
 * IRS provisional-income formula. Thresholds are fixed (not inflation-indexed).
 * `otherOrdinaryIncome` is the rest of your ordinary income (e.g. a 401(k)
 * withdrawal) — the more you withdraw, the more of your SS becomes taxable
 * (the "tax torpedo"). Michigan and most states do not tax SS.
 */
export function taxableSocialSecurity(
  ssBenefit: number,
  otherOrdinaryIncome: number,
  filingStatus: FilingStatus,
): number {
  if (ssBenefit <= 0) return 0;
  const [base1, base2] =
    filingStatus === "married_jointly"
      ? [32000, 44000]
      : filingStatus === "married_separately"
        ? [0, 0]
        : [25000, 34000];
  const provisional = Math.max(0, otherOrdinaryIncome) + 0.5 * ssBenefit;
  if (provisional <= base1) return 0;
  if (provisional <= base2) return Math.min(0.5 * ssBenefit, 0.5 * (provisional - base1));
  const lesser = Math.min(0.5 * ssBenefit, 0.5 * (base2 - base1));
  return Math.min(0.85 * ssBenefit, 0.85 * (provisional - base2) + lesser);
}

// ------------------------------------------------------------------
// Roth vs. Traditional 401(k) — full multi-year projection.
//
// Models "max out the 401(k) every year" from now until retirement, growing
// income (with an optional future step-up, e.g. resident → attending) and
// applying real US tax brackets (federal + a flat state such as Michigan).
//
// The fair comparison of *net usable money*:
//   • You contribute the SAME dollar amount (the employee limit) either way, so
//     the 401(k) balance from your contributions is identical for Roth and
//     Traditional.
//   • Traditional gives you an income-tax deduction each year. To keep the two
//     choices equal out-of-pocket, that annual tax saving is invested in a
//     taxable brokerage "side account" (gains taxed at LTCG on withdrawal).
//   • At retirement: Roth contributions are tax-free; Traditional's 401(k) is
//     taxed as ordinary income at withdrawal, plus the after-tax side account.
//
// Employer match and any starting 401(k) balance are ALWAYS pre-tax (they sit
// in the traditional bucket regardless of your election), so they are identical
// on both sides and do not change the winner — but they are included in the
// total balance and net-usable figures for a realistic picture.
//
// Everything is in today's dollars — use a real (after-inflation) return so the
// (non-inflated) tax brackets stay consistent year to year.
// ------------------------------------------------------------------

export interface RothTradProjectionInput {
  currentAge: number;
  retireAge: number;
  /** Current gross wages, today's dollars. */
  currentIncome: number;
  /** Expected future/peak gross wages once the step-up hits (today's dollars). */
  futureIncome: number;
  /** Years from now until income steps up to `futureIncome` (0 = already there). */
  yearsUntilFutureIncome: number;
  /** Real annual raise applied on top of the base/step income (%). */
  annualRaisePct: number;
  /** Amount contributed to the 401(k) each year (the employee max). */
  annualContribution: number;
  /** Employer match as a percent of gross income each year (always pre-tax). */
  employerMatchPct: number;
  /** Current traditional (pre-tax) 401(k) balance to grow alongside. */
  startingBalance: number;
  /** Expected real (after-inflation) investment return (%). */
  realReturnPct: number;
  /** Planned total annual spending in retirement (today's $). */
  retirementSpending: number;
  /** Expected annual Social Security benefit in retirement (today's $). */
  socialSecurityAnnual: number;
  /**
   * Other ordinary taxable income in retirement (today's $): pensions, rental /
   * passive / business income, a working spouse, dividends & RMDs from other
   * accounts. This stacks UNDER the 401(k) withdrawal, raising its tax rate.
   */
  otherRetirementIncome: number;
  /** Long-term capital-gains rate applied to the traditional side account (%). */
  ltcgRatePct: number;
  /** Tax profile (federal brackets + flat state), from the store. */
  profile: TaxProfile;
  /** Optional local/city flat income-tax rate (%). */
  cityRatePct?: number;
}

export interface RothTradYear {
  age: number;
  /** Gross wages that year (today's dollars). */
  income: number;
  contribution: number;
  /** Employer match contributed that year (pre-tax). */
  matchContribution: number;
  /** Marginal income-tax rate that valued the deduction this year (fraction). */
  marginalRate: number;
  /** Income tax saved by the traditional deduction this year. */
  taxSaved: number;
  /** 401(k) balance from your contributions — identical for Roth and Traditional. */
  balance: number;
  /** Pre-tax total: your contributions + employer match + grown starting balance. */
  total401k: number;
  /** Traditional's taxable side account (the invested tax savings). */
  sideBalance: number;
}

export interface RothTradProjectionResult {
  years: number;
  rows: RothTradYear[];

  /** 401(k) balance from your contributions (identical Roth or Traditional). */
  finalBalance: number;
  /** Employer match balance at retirement (pre-tax). */
  matchBalanceFinal: number;
  /** Starting balance grown to retirement (pre-tax). */
  startingBalanceGrown: number;
  /** Total pre-tax 401(k) at retirement: contributions + match + starting. */
  total401kBalance: number;
  totalContributed: number;
  /** Total employer match contributed (nominal sum). */
  employerMatchTotal: number;

  // Traditional path
  /** Effective income-tax rate on the traditional withdrawal, incl. SS stacking (fraction). */
  retirementEffRate: number;
  /** Annual traditional 401(k) withdrawal needed (spending − SS − other income). */
  annualWithdrawal: number;
  /** Portion of Social Security that is federally taxable given the withdrawal. */
  socialSecurityTaxable: number;
  /** Other ordinary retirement income that stacks under the withdrawal. */
  otherRetirementIncomeUsed: number;
  /**
   * Retirement tax rate at which Roth and Traditional tie for your contributions
   * (= after-tax side account ÷ your 401(k) balance). Above this ⇒ Roth wins.
   */
  breakEvenRetRate: number;
  /** Your-contributions 401(k) balance net of retirement income tax. */
  tradAfterTax401k: number;
  /** Match + starting balance after retirement income tax (common to both paths). */
  pretaxCommonAfterTax: number;
  /** Taxable side account after paying LTCG on its gains. */
  tradSideAfterTax: number;
  /** Total net usable money (Traditional). */
  tradTotalNet: number;
  /** Total income tax deferred over all years (nominal sum). */
  tradTaxSavingsTotal: number;

  // Roth path
  /** Your Roth contributions at retirement (tax-free). */
  rothContribNet: number;
  /** Total net usable money (Roth) = tax-free contributions + taxed match/starting. */
  rothTotalNet: number;
  /** Extra out-of-pocket to max the Roth vs Traditional (forgone deductions). */
  rothExtraOutOfPocket: number;

  // Comparison
  winner: "roth" | "traditional" | "tie";
  /** Absolute net-usable gap between the winner and loser. */
  difference: number;
  /** Average marginal rate that valued the deductions (fraction). */
  avgMarginalNow: number;
  steps: MathStep[];
}

export function rothVsTradProjection(
  input: RothTradProjectionInput,
): RothTradProjectionResult {
  const {
    currentAge,
    retireAge,
    currentIncome,
    futureIncome,
    yearsUntilFutureIncome,
    annualRaisePct,
    annualContribution,
    employerMatchPct,
    startingBalance,
    realReturnPct,
    retirementSpending,
    socialSecurityAnnual,
    otherRetirementIncome,
    ltcgRatePct,
    profile,
    cityRatePct,
  } = input;

  const years = Math.max(1, Math.round(retireAge - currentAge));
  const r = realReturnPct / 100;
  const ltcg = ltcgRatePct / 100;
  const raise = annualRaisePct / 100;
  const matchRate = Math.max(0, employerMatchPct) / 100;

  const rows: RothTradYear[] = [];
  let balance = 0; // 401(k) balance from your contributions (Roth == Traditional)
  let matchBalance = 0; // employer match (pre-tax) balance
  let startBalance = Math.max(0, startingBalance); // grows with no additions
  let sideBalance = 0; // Traditional's taxable side account (invested tax savings)
  let sideBasis = 0; // contributions into the side account (for LTCG)
  let totalContributed = 0;
  let employerMatchTotal = 0;
  let tradTaxSavingsTotal = 0;
  let marginalSum = 0;

  for (let i = 0; i < years; i++) {
    const age = currentAge + i;

    // Income in today's dollars. Step to futureIncome at the given year, then
    // apply real raises; before the step, grow the current income by raises.
    let income: number;
    if (i >= yearsUntilFutureIncome && futureIncome > 0) {
      income = futureIncome * Math.pow(1 + raise, i - yearsUntilFutureIncome);
    } else {
      income = currentIncome * Math.pow(1 + raise, i);
    }

    // Can't defer more than you earn.
    const contribution = Math.min(annualContribution, Math.max(0, income));
    totalContributed += contribution;

    const matchContribution = Math.max(0, income) * matchRate;
    employerMatchTotal += matchContribution;

    // Value the traditional deduction: income tax with vs without the pre-tax
    // contribution. FICA is on gross wages (unchanged), so it cancels here.
    const taxWith = computeTax({
      grossWages: income,
      traditionalRetirement: contribution,
      hsa: 0,
      profile,
      cityRatePct,
    });
    const taxWithout = computeTax({
      grossWages: income,
      traditionalRetirement: 0,
      hsa: 0,
      profile,
      cityRatePct,
    });
    const taxSaved = Math.max(0, taxWithout.totalTax - taxWith.totalTax);
    const marginalRate = contribution > 0 ? taxSaved / contribution : 0;
    marginalSum += marginalRate;
    tradTaxSavingsTotal += taxSaved;

    // Grow accounts (end-of-year contribution convention).
    balance = balance * (1 + r) + contribution;
    matchBalance = matchBalance * (1 + r) + matchContribution;
    startBalance = startBalance * (1 + r);
    sideBalance = sideBalance * (1 + r) + taxSaved;
    sideBasis += taxSaved;

    rows.push({
      age,
      income,
      contribution,
      matchContribution,
      marginalRate,
      taxSaved,
      balance,
      total401k: balance + matchBalance + startBalance,
      sideBalance,
    });
  }

  const finalBalance = balance;
  const matchBalanceFinal = matchBalance;
  const startingBalanceGrown = startBalance;
  const total401kBalance = finalBalance + matchBalanceFinal + startingBalanceGrown;

  // Retirement income tax (income tax only — no FICA on distributions).
  //
  // Real-world stacking: your OTHER retirement income (pensions, rental /
  // passive / business income, a working spouse, dividends & RMDs from other
  // accounts) plus the taxable part of Social Security fill the low brackets
  // FIRST. Your 401(k) withdrawal is then taxed on TOP of that stack — at
  // higher marginal rates. So the more other income you have, the higher the
  // effective rate on every traditional dollar (and it also drags more of your
  // Social Security into the taxable range). This is what tips the math toward
  // Roth for people who build up passive income before retirement.
  const ss = Math.max(0, socialSecurityAnnual);
  const other = Math.max(0, otherRetirementIncome);
  // SS + other income cover part of spending, so the 401(k) funds the rest.
  const annualWithdrawal = Math.max(0, retirementSpending - ss - other);
  const stdDed = profile.standardDeduction;
  const stateExemption = Math.max(0, profile.stateExemptionUsd ?? 0);
  const stateRate = profile.stateFlatRatePct / 100;
  const cityRate = (cityRatePct ?? 0) / 100;

  // Total income tax (fed + state + city) for a given amount of ordinary,
  // non-Social-Security income, with SS taxed per the provisional-income rule.
  const retTaxFor = (ordinaryNonSS: number): number => {
    const taxSS = taxableSocialSecurity(ss, ordinaryNonSS, profile.filingStatus);
    const fed = federalTax(
      Math.max(0, ordinaryNonSS + taxSS - stdDed),
      profile.federalBrackets,
    );
    const state = Math.max(0, ordinaryNonSS - stateExemption) * stateRate;
    const city = Math.max(0, ordinaryNonSS) * cityRate;
    return fed + state + city;
  };

  const baseTax = retTaxFor(other); // SS + other income, no 401(k) draw
  const withTax = retTaxFor(other + annualWithdrawal); // + the 401(k) draw on top
  const socialSecurityTaxable = taxableSocialSecurity(
    ss,
    other + annualWithdrawal,
    profile.filingStatus,
  );

  let retirementEffRate: number;
  if (annualWithdrawal > 0) {
    // Effective rate on the withdrawal = the extra tax it triggers, stacked on
    // top of the other income + Social Security.
    retirementEffRate = Math.max(0, withTax - baseTax) / annualWithdrawal;
  } else {
    // SS + other income already cover spending, but the balance must still come
    // out eventually (RMDs) — value it at the marginal rate it would face on
    // top of the existing stack.
    const taxSS = taxableSocialSecurity(ss, other, profile.filingStatus);
    retirementEffRate =
      federalMarginalRate(
        Math.max(0, other + taxSS - stdDed),
        profile.federalBrackets,
      ) +
      stateRate +
      cityRate;
  }

  // Match + starting balance are pre-tax in BOTH scenarios: taxed on withdrawal,
  // identical either way.
  const pretaxCommonAfterTax = (matchBalanceFinal + startingBalanceGrown) * (1 - retirementEffRate);

  // Traditional net usable = after-tax contributions 401(k) + after-tax side
  // account + the common (match + starting) after-tax pot.
  const tradAfterTax401k = finalBalance * (1 - retirementEffRate);
  const sideGains = Math.max(0, sideBalance - sideBasis);
  const tradSideAfterTax = sideBalance - sideGains * ltcg;
  const tradTotalNet = tradAfterTax401k + tradSideAfterTax + pretaxCommonAfterTax;

  // Break-even: on your own contributions the two paths tie when
  //   finalBalance × retRate = after-tax side account
  // so Roth wins whenever your retirement rate clears side ÷ balance.
  const breakEvenRetRate = finalBalance > 0 ? tradSideAfterTax / finalBalance : 0;

  // Roth net usable = tax-free contributions + the common (match + starting) pot.
  const rothContribNet = finalBalance;
  const rothTotalNet = rothContribNet + pretaxCommonAfterTax;
  const rothExtraOutOfPocket = tradTaxSavingsTotal;

  const diff = rothTotalNet - tradTotalNet;
  const winner: RothTradProjectionResult["winner"] =
    Math.abs(diff) < 1 ? "tie" : diff > 0 ? "roth" : "traditional";
  const avgMarginalNow = years > 0 ? marginalSum / years : 0;

  const steps: MathStep[] = [
    {
      label: "Contribute the same limit every year",
      formula: `${formatUsd(annualContribution)}/yr × ${years} yrs`,
      result: `${formatUsd(totalContributed)} contributed`,
    },
    {
      label: "Total 401(k) at retirement (same either way)",
      formula: `your contributions + employer match + starting balance, grown at ${realReturnPct}%`,
      result: `${formatUsd(total401kBalance)} (you ${formatUsd(finalBalance)} + match ${formatUsd(matchBalanceFinal)} + start ${formatUsd(startingBalanceGrown)})`,
    },
    {
      label: "Other income + Social Security stack UNDER the withdrawal",
      formula:
        other > 0 || ss > 0
          ? `${formatUsd(other)} other + ${formatUsd(socialSecurityTaxable)} taxable SS fill low brackets; ${formatUsd(annualWithdrawal)} draw taxed on top`
          : "No other income or Social Security — withdrawal fills brackets from $0",
      result: `${formatPct(retirementEffRate)} effective rate on the 401(k) withdrawal`,
    },
    {
      label: "Match + starting balance are pre-tax either way",
      formula: `(${formatUsd(matchBalanceFinal)} + ${formatUsd(startingBalanceGrown)}) × (1 − ${formatPct(retirementEffRate)})`,
      result: `${formatUsd(pretaxCommonAfterTax)} after tax — identical for Roth & Traditional`,
    },
    {
      label: "Traditional: your contributions taxed on withdrawal",
      formula: `${formatUsd(finalBalance)} × (1 − ${formatPct(retirementEffRate)})`,
      result: formatUsd(tradAfterTax401k),
    },
    {
      label: "Traditional: tax deducted now, invested taxable (avg marginal)",
      formula: `avg ${formatPct(avgMarginalNow)} → ${formatUsd(tradTaxSavingsTotal)} deferred → side account`,
      result: `${formatUsd(tradSideAfterTax)} after LTCG`,
    },
    {
      label: "Traditional total net usable",
      formula: `${formatUsd(tradAfterTax401k)} + ${formatUsd(tradSideAfterTax)} side + ${formatUsd(pretaxCommonAfterTax)} common`,
      result: formatUsd(tradTotalNet),
    },
    {
      label: "Roth: contributions tax-free, match/starting still taxed",
      formula: `${formatUsd(rothContribNet)} + ${formatUsd(pretaxCommonAfterTax)} common — extra ${formatUsd(rothExtraOutOfPocket)} tax paid while working`,
      result: formatUsd(rothTotalNet),
    },
    {
      label: "Break-even: Roth wins if your retirement rate beats this",
      formula: `side account ${formatUsd(tradSideAfterTax)} ÷ your 401(k) ${formatUsd(finalBalance)}`,
      result: `${formatPct(breakEvenRetRate)} break-even — you're at ${formatPct(retirementEffRate)}`,
    },
    {
      label: "Net-usable difference",
      formula: `${formatUsd(rothTotalNet)} − ${formatUsd(tradTotalNet)}`,
      result: `${winner === "roth" ? "+" : winner === "traditional" ? "−" : ""}${formatUsd(Math.abs(diff))} for ${winner === "tie" ? "either" : winner === "roth" ? "Roth" : "Traditional"}`,
    },
  ];

  return {
    years,
    rows,
    finalBalance,
    matchBalanceFinal,
    startingBalanceGrown,
    total401kBalance,
    totalContributed,
    employerMatchTotal,
    retirementEffRate,
    annualWithdrawal,
    socialSecurityTaxable,
    otherRetirementIncomeUsed: other,
    breakEvenRetRate,
    tradAfterTax401k,
    pretaxCommonAfterTax,
    tradSideAfterTax,
    tradTotalNet,
    tradTaxSavingsTotal,
    rothContribNet,
    rothTotalNet,
    rothExtraOutOfPocket,
    winner,
    difference: Math.abs(diff),
    avgMarginalNow,
    steps,
  };
}
