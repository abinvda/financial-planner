"""
Analyze ICICI Overdraft Home Loan conversion option.

This script compares the current home loan structure with an overdraft (OD) home loan
and calculates interest savings as a function of extra monthly payments.
"""

import pandas as pd
import numpy as np
from typing import Tuple, Optional
import sys
import argparse


def calculate_weighted_interest_rate(
    principal1: float, rate1: float, principal2: float, rate2: float
) -> float:
    """Calculate weighted average interest rate."""
    total_principal = principal1 + principal2
    if total_principal == 0:
        return 0.0
    weighted_rate = (principal1 * rate1 + principal2 * rate2) / total_principal
    return weighted_rate


def calculate_current_loan_interest(
    principal1: float,
    rate1: float,
    principal2: float,
    rate2: float,
    emi: float,
    months: int = 12,
) -> Tuple[float, pd.DataFrame]:
    """
    Calculate interest for current loan structure (two parts with different rates).
    
    Returns:
        Tuple of (total_interest, amortization_schedule)
    """
    monthly_rate1 = (rate1 / 100) / 12
    monthly_rate2 = (rate2 / 100) / 12
    
    # Calculate EMI for each part
    # For part 1
    if monthly_rate1 == 0:
        emi1 = principal1 / months
    else:
        emi1 = principal1 * monthly_rate1 * (1 + monthly_rate1) ** months / (
            (1 + monthly_rate1) ** months - 1
        )
    
    # For part 2
    if monthly_rate2 == 0:
        emi2 = principal2 / months
    else:
        emi2 = principal2 * monthly_rate2 * (1 + monthly_rate2) ** months / (
            (1 + monthly_rate2) ** months - 1
        )
    
    total_emi = emi1 + emi2
    
    # If provided EMI is different, adjust proportionally
    if emi > 0:
        scale_factor = emi / total_emi
        emi1 *= scale_factor
        emi2 *= scale_factor
    
    balance1 = principal1
    balance2 = principal2
    total_interest = 0.0
    schedule = []
    
    for month in range(1, months + 1):
        # Interest for each part
        interest1 = balance1 * monthly_rate1
        interest2 = balance2 * monthly_rate2
        month_interest = interest1 + interest2
        
        # Principal payment for each part
        principal_payment1 = min(emi1 - interest1, balance1)
        principal_payment2 = min(emi2 - interest2, balance2)
        
        # Update balances
        balance1 = max(0, balance1 - principal_payment1)
        balance2 = max(0, balance2 - principal_payment2)
        
        total_interest += month_interest
        
        schedule.append({
            "month": month,
            "balance1": balance1,
            "balance2": balance2,
            "total_balance": balance1 + balance2,
            "interest": month_interest,
            "cumulative_interest": total_interest,
        })
    
    return total_interest, pd.DataFrame(schedule)


def calculate_od_loan_interest(
    total_principal: float,
    od_rate: float,
    emi: float,
    extra_monthly_payment: float = 0.0,
    upfront_payment: float = 0.0,
    months: int = 12,
) -> Tuple[float, pd.DataFrame]:
    """
    Calculate interest for OD loan with extra payments.
    
    In OD loans, interest is calculated daily on outstanding balance.
    Extra payments immediately reduce principal, reducing interest.
    
    Args:
        total_principal: Initial loan principal
        od_rate: OD loan interest rate (annual %)
        emi: Monthly EMI payment
        extra_monthly_payment: Extra monthly payment amount
        upfront_payment: One-time upfront payment at the beginning
        months: Number of months to calculate
    
    Returns:
        Tuple of (total_interest, amortization_schedule)
    """
    monthly_rate = (od_rate / 100) / 12
    balance = total_principal - upfront_payment  # Upfront payment reduces principal immediately
    total_interest = 0.0
    schedule = []
    
    for month in range(1, months + 1):
        # Interest for this month (calculated on outstanding balance)
        month_interest = balance * monthly_rate
        total_interest += month_interest
        
        # Principal payment from EMI
        principal_from_emi = min(emi - month_interest, balance)
        
        # Extra payment goes directly to principal
        extra_payment = min(extra_monthly_payment, balance - principal_from_emi)
        
        # Total principal reduction
        total_principal_payment = principal_from_emi + extra_payment
        
        # Update balance
        balance = max(0, balance - total_principal_payment)
        
        schedule.append({
            "month": month,
            "balance": balance,
            "interest": month_interest,
            "cumulative_interest": total_interest,
            "principal_payment": total_principal_payment,
            "extra_payment": extra_payment,
        })
    
    return total_interest, pd.DataFrame(schedule)


def calculate_interest_savings(
    principal1: float,
    rate1: float,
    principal2: float,
    rate2: float,
    od_rate: float,
    emi: float,
    extra_monthly_payment: float = 0.0,
    upfront_payment: float = 0.0,
    months: int = 12,
) -> dict:
    """
    Calculate interest savings from switching to OD loan with extra payments.
    
    Returns:
        Dictionary with detailed comparison
    """
    # Current loan interest
    current_interest, current_schedule = calculate_current_loan_interest(
        principal1, rate1, principal2, rate2, emi, months
    )
    
    # OD loan interest
    total_principal = principal1 + principal2
    od_interest, od_schedule = calculate_od_loan_interest(
        total_principal, od_rate, emi, extra_monthly_payment, upfront_payment, months
    )
    
    interest_saved = current_interest - od_interest
    
    return {
        "current_interest": current_interest,
        "od_interest": od_interest,
        "interest_saved": interest_saved,
        "current_schedule": current_schedule,
        "od_schedule": od_schedule,
        "extra_payment_total": extra_monthly_payment * months,
        "upfront_payment": upfront_payment,
    }


def find_break_even_extra_payment(
    principal1: float,
    rate1: float,
    principal2: float,
    rate2: float,
    od_rate: float,
    emi: float,
    target_savings: float,
    months: int = 12,
    tolerance: float = 100.0,
) -> float:
    """
    Find the extra monthly payment needed to save target_savings in interest.
    
    Uses binary search to find the break-even point.
    """
    # Get baseline (no extra payment)
    baseline = calculate_interest_savings(
        principal1, rate1, principal2, rate2, od_rate, emi, 0.0, 0.0, months
    )
    baseline_savings = baseline["interest_saved"]
    
    if baseline_savings >= target_savings:
        return 0.0  # Already saving enough without extra payments
    
    # Binary search for extra payment amount
    low = 0.0
    high = 500000.0  # Upper bound: Rs 5 lacs per month
    best_extra = 0.0
    
    while high - low > tolerance:
        mid = (low + high) / 2
        result = calculate_interest_savings(
            principal1, rate1, principal2, rate2, od_rate, emi, mid, 0.0, months
        )
        savings = result["interest_saved"]
        
        if savings >= target_savings:
            best_extra = mid
            high = mid
        else:
            low = mid
    
    return best_extra


def find_break_even_upfront_payment(
    principal1: float,
    rate1: float,
    principal2: float,
    rate2: float,
    od_rate: float,
    emi: float,
    target_savings: float,
    months: int = 12,
    tolerance: float = 1000.0,
) -> float:
    """
    Find the upfront payment needed to save target_savings in interest.
    
    Uses binary search to find the break-even point.
    """
    # Get baseline (no upfront payment)
    baseline = calculate_interest_savings(
        principal1, rate1, principal2, rate2, od_rate, emi, 0.0, 0.0, months
    )
    baseline_savings = baseline["interest_saved"]
    
    if baseline_savings >= target_savings:
        return 0.0  # Already saving enough without upfront payment
    
    # Binary search for upfront payment amount
    low = 0.0
    high = 50_00_000  # Upper bound: Rs 50 lacs
    best_upfront = 0.0
    
    while high - low > tolerance:
        mid = (low + high) / 2
        result = calculate_interest_savings(
            principal1, rate1, principal2, rate2, od_rate, emi, 0.0, mid, months
        )
        savings = result["interest_saved"]
        
        if savings >= target_savings:
            best_upfront = mid
            high = mid
        else:
            low = mid
    
    return best_upfront


def analyze_extra_payment_sensitivity(
    principal1: float,
    rate1: float,
    principal2: float,
    rate2: float,
    od_rate: float,
    emi: float,
    months: int = 12,
) -> pd.DataFrame:
    """
    Analyze interest savings for different extra payment amounts.
    
    Returns DataFrame with extra payment vs interest savings.
    """
    extra_payments = [0, 25000, 50000, 75000, 100000, 150000, 200000, 250000, 300000]
    results = []
    
    for extra in extra_payments:
        result = calculate_interest_savings(
            principal1, rate1, principal2, rate2, od_rate, emi, extra, 0.0, months
        )
        results.append({
            "Extra Monthly Payment (Rs)": extra,
            "Total Extra Paid (Rs)": extra * months,
            "Current Loan Interest (Rs)": result["current_interest"],
            "OD Loan Interest (Rs)": result["od_interest"],
            "Interest Saved (Rs)": result["interest_saved"],
            "Net Benefit (Rs)": result["interest_saved"],  # Before conversion fee
        })
    
    df = pd.DataFrame(results)
    return df


def calculate_interest_savings_for_inputs(
    od_rate: float,
    extra_monthly_payment: float,
    principal1: float = 69_00_000,
    rate1: float = 7.85,
    principal2: float = 42_00_000,
    rate2: float = 8.25,
    emi: float = 190_000,
    months: int = 12,
) -> dict:
    """
    Calculate interest savings for given OD rate and extra payment.
    
    This is the main function to answer: "Given interest rate X and extra payment Y,
    what is the interest saved?"
    
    Args:
        od_rate: OD loan interest rate (annual %)
        extra_monthly_payment: Extra monthly payment amount
        principal1: First part of current loan principal
        rate1: First part interest rate
        principal2: Second part of current loan principal
        rate2: Second part interest rate
        emi: Monthly EMI payment
        months: Number of months to analyze (default: 12 for first year)
    
    Returns:
        Dictionary with interest savings details
    """
    result = calculate_interest_savings(
        principal1, rate1, principal2, rate2, od_rate, emi, extra_monthly_payment, 0.0, months
    )
    return result


def main():
    """Main analysis function."""
    parser = argparse.ArgumentParser(
        description="Analyze ICICI Overdraft Home Loan conversion option"
    )
    parser.add_argument(
        "--od-rate",
        type=float,
        default=8.05,
        help="OD loan interest rate (default: 8.05)",
    )
    parser.add_argument(
        "--extra-payment",
        type=float,
        default=None,
        help="Extra monthly payment amount to analyze",
    )
    parser.add_argument(
        "--principal1",
        type=float,
        default=69_00_000,
        help="First part principal (default: 6900000)",
    )
    parser.add_argument(
        "--rate1",
        type=float,
        default=7.85,
        help="First part interest rate (default: 7.85)",
    )
    parser.add_argument(
        "--principal2",
        type=float,
        default=42_00_000,
        help="Second part principal (default: 4200000)",
    )
    parser.add_argument(
        "--rate2",
        type=float,
        default=8.25,
        help="Second part interest rate (default: 8.25)",
    )
    parser.add_argument(
        "--emi",
        type=float,
        default=190_000,
        help="Monthly EMI (default: 190000)",
    )
    parser.add_argument(
        "--conversion-fee",
        type=float,
        default=31_000,
        help="Conversion fee (default: 31000)",
    )
    
    args = parser.parse_args()
    
    # Loan parameters
    principal1 = args.principal1
    rate1 = args.rate1
    principal2 = args.principal2
    rate2 = args.rate2
    total_principal = principal1 + principal2
    emi = args.emi
    remaining_months = 84  # 7 years remaining
    conversion_fee = args.conversion_fee
    od_rate = args.od_rate
    
    print("=" * 80)
    print("ICICI OVERDRAFT HOME LOAN CONVERSION ANALYSIS")
    print("=" * 80)
    print()
    
    print("CURRENT LOAN STRUCTURE:")
    print(f"  Part 1: Rs {principal1:,.0f} at {rate1}%")
    print(f"  Part 2: Rs {principal2:,.0f} at {rate2}%")
    print(f"  Total Principal: Rs {total_principal:,.0f}")
    print(f"  Monthly EMI: Rs {emi:,.0f}")
    print(f"  Remaining Tenure: {remaining_months} months ({remaining_months/12:.1f} years)")
    print()
    
    weighted_rate = calculate_weighted_interest_rate(principal1, rate1, principal2, rate2)
    print(f"  Weighted Average Rate: {weighted_rate:.2f}%")
    print()
    
    print("PROPOSED OD LOAN:")
    print(f"  Interest Rate: {od_rate}%")
    print(f"  Conversion Fee: Rs {conversion_fee:,.0f}")
    print()
    
    # If specific extra payment is provided, show that analysis first
    if args.extra_payment is not None:
        print(f"ANALYSIS FOR SPECIFIC INPUTS:")
        print(f"  OD Interest Rate: {od_rate}%")
        print(f"  Extra Monthly Payment: Rs {args.extra_payment:,.0f}")
        print("-" * 80)
        
        specific_result = calculate_interest_savings(
            principal1, rate1, principal2, rate2, od_rate, emi, args.extra_payment, 0.0, 12
        )
        
        print(f"Current Loan Interest (Year 1): Rs {specific_result['current_interest']:,.2f}")
        print(f"OD Loan Interest (Year 1):      Rs {specific_result['od_interest']:,.2f}")
        print(f"Interest Saved (Year 1):        Rs {specific_result['interest_saved']:,.2f}")
        print(f"Net Benefit (after fee):        Rs {specific_result['interest_saved'] - conversion_fee:,.2f}")
        print(f"Total Extra Paid (Year 1):      Rs {specific_result['extra_payment_total']:,.2f}")
        print()
        return
    
    # Calculate first year interest for both scenarios (no extra payment)
    print("FIRST YEAR ANALYSIS (No Extra Payments):")
    print("-" * 80)
    
    baseline_result = calculate_interest_savings(
        principal1, rate1, principal2, rate2, od_rate, emi, 0.0, 0.0, 12
    )
    
    print(f"Current Loan Interest (Year 1): Rs {baseline_result['current_interest']:,.2f}")
    print(f"OD Loan Interest (Year 1):      Rs {baseline_result['od_interest']:,.2f}")
    print(f"Interest Saved (Year 1):        Rs {baseline_result['interest_saved']:,.2f}")
    print(f"Net Benefit (after Rs {conversion_fee:,.0f} fee): Rs {baseline_result['interest_saved'] - conversion_fee:,.2f}")
    print()
    
    if baseline_result['interest_saved'] < conversion_fee:
        print("WARNING: Without extra payments, conversion fee exceeds first year savings!")
        print()
    
    # Sensitivity analysis
    print("INTEREST SAVINGS vs EXTRA MONTHLY PAYMENT (First Year):")
    print("-" * 80)
    
    sensitivity_df = analyze_extra_payment_sensitivity(
        principal1, rate1, principal2, rate2, od_rate, emi, 12
    )
    
    # Add net benefit column (after conversion fee)
    sensitivity_df["Net Benefit After Fee (Rs)"] = (
        sensitivity_df["Interest Saved (Rs)"] - conversion_fee
    )
    
    # Format for display
    pd.set_option('display.max_columns', None)
    pd.set_option('display.width', None)
    pd.set_option('display.float_format', lambda x: f'{x:,.0f}' if abs(x) >= 1 else f'{x:.2f}')
    
    print(sensitivity_df.to_string(index=False))
    print()
    
    # Find break-even point (monthly extra payment)
    print("BREAK-EVEN ANALYSIS (Monthly Extra Payment):")
    print("-" * 80)
    print(f"Finding extra monthly payment needed to save Rs {conversion_fee:,.0f} in first year...")
    print()
    
    break_even_extra = find_break_even_extra_payment(
        principal1, rate1, principal2, rate2, od_rate, emi, conversion_fee, 12
    )
    
    if break_even_extra > 0:
        print(f"Extra Monthly Payment Needed: Rs {break_even_extra:,.0f}")
        print(f"   Total Extra Payment (Year 1): Rs {break_even_extra * 12:,.0f}")
        
        # Verify
        verify_result = calculate_interest_savings(
            principal1, rate1, principal2, rate2, od_rate, emi, break_even_extra, 0.0, 12
        )
        print(f"   Actual Interest Saved: Rs {verify_result['interest_saved']:,.2f}")
        print(f"   Net Benefit: Rs {verify_result['interest_saved'] - conversion_fee:,.2f}")
    else:
        print("No extra payment needed - conversion is already profitable!")
    print()
    
    # Find break-even point (upfront payment)
    print("BREAK-EVEN ANALYSIS (Upfront Payment):")
    print("-" * 80)
    print(f"Finding upfront payment needed to save Rs {conversion_fee:,.0f} in first year...")
    print()
    
    break_even_upfront = find_break_even_upfront_payment(
        principal1, rate1, principal2, rate2, od_rate, emi, conversion_fee, 12
    )
    
    if break_even_upfront > 0:
        print(f"Upfront Payment Needed: Rs {break_even_upfront:,.0f}")
        
        # Verify
        verify_result = calculate_interest_savings(
            principal1, rate1, principal2, rate2, od_rate, emi, 0.0, break_even_upfront, 12
        )
        print(f"   Actual Interest Saved: Rs {verify_result['interest_saved']:,.2f}")
        print(f"   Net Benefit: Rs {verify_result['interest_saved'] - conversion_fee:,.2f}")
        print()
        print(f"   Note: This upfront payment reduces your principal from Rs {total_principal:,.0f}")
        print(f"         to Rs {total_principal - break_even_upfront:,.0f} at the start.")
    else:
        print("No upfront payment needed - conversion is already profitable!")
    print()
    
    # Calculate total break-even (conversion fee + extra interest over 7 years)
    print("COMPLETE BREAK-EVEN ANALYSIS (7 Years - Upfront Payment):")
    print("-" * 80)
    print("Calculating upfront payment needed to break-even on:")
    print("  1. Conversion fee: Rs 31,000")
    print("  2. Extra interest from higher OD rate over 7 years")
    print()
    
    # Calculate total interest difference over 7 years (no extra payments)
    baseline_7year = calculate_interest_savings(
        principal1, rate1, principal2, rate2, od_rate, emi, 0.0, 0.0, remaining_months
    )
    
    # The interest_saved is negative (we pay more), so we need to cover that loss
    extra_interest_loss_7years = -baseline_7year['interest_saved']  # This is positive (loss)
    total_break_even_required = conversion_fee + extra_interest_loss_7years
    
    print(f"  Conversion Fee:                    Rs {conversion_fee:,.2f}")
    print(f"  Extra Interest (7 years):          Rs {extra_interest_loss_7years:,.2f}")
    print(f"  Total Break-Even Required:         Rs {total_break_even_required:,.2f}")
    print()
    
    # Find upfront payment needed to save this total amount over 7 years (break-even)
    complete_break_even_upfront = find_break_even_upfront_payment(
        principal1, rate1, principal2, rate2, od_rate, emi, total_break_even_required, remaining_months
    )
    
    # Find upfront payment needed to actually save money (net positive benefit)
    # We want interest_saved > (conversion_fee + extra_interest_loss)
    # So we need to save slightly more than break-even - let's add a small buffer
    target_for_savings = total_break_even_required + 1000  # Add Rs 1000 buffer to ensure net positive
    upfront_for_savings = find_break_even_upfront_payment(
        principal1, rate1, principal2, rate2, od_rate, emi, target_for_savings, remaining_months
    )
    
    if complete_break_even_upfront > 0:
        print(f"Upfront Payment Needed: Rs {complete_break_even_upfront:,.0f}")
        print()
        
        # Verify
        verify_result = calculate_interest_savings(
            principal1, rate1, principal2, rate2, od_rate, emi, 0.0, complete_break_even_upfront, remaining_months
        )
        print(f"Verification (over 7 years):")
        print(f"  Current Loan Interest:         Rs {verify_result['current_interest']:,.2f}")
        print(f"  OD Loan Interest:              Rs {verify_result['od_interest']:,.2f}")
        print(f"  Interest Saved:                 Rs {verify_result['interest_saved']:,.2f}")
        print(f"  Net Benefit (after fee):        Rs {verify_result['interest_saved'] - conversion_fee:,.2f}")
        print()
        print(f"Breakdown:")
        print(f"  - Covers conversion fee:       Rs {conversion_fee:,.2f}")
        print(f"  - Covers extra interest loss:   Rs {extra_interest_loss_7years:,.2f}")
        print(f"  - Total benefit:                Rs {verify_result['interest_saved']:,.2f}")
        print()
        print(f"Note: This upfront payment reduces your principal from Rs {total_principal:,.0f}")
        print(f"      to Rs {total_principal - complete_break_even_upfront:,.0f} at the start.")
        print(f"      This ensures you break-even on both the fee and the higher interest rate")
        print(f"      over the entire 7-year remaining tenure.")
    else:
        print("No upfront payment needed - conversion is already profitable over 7 years!")
    print()
    
    # Full loan tenure analysis
    print("FULL LOAN TENURE ANALYSIS (7 years remaining):")
    print("-" * 80)
    
    # Calculate for different extra payment scenarios
    full_tenure_extra = [0, 50000, 100000, 150000]
    print("\nExtra Payment | Total Interest Saved | Net Benefit (after fee)")
    print("-" * 70)
    
    for extra in full_tenure_extra:
        result = calculate_interest_savings(
            principal1, rate1, principal2, rate2, od_rate, emi, extra, 0.0, remaining_months
        )
        net_benefit = result['interest_saved'] - conversion_fee
        print(f"Rs {extra:>8,.0f}/month | Rs {result['interest_saved']:>18,.0f} | Rs {net_benefit:>20,.0f}")
    
    print()
    print()
    print("=" * 80)
    print("SIMPLIFIED SUMMARY - 7 YEAR ANALYSIS:")
    print("=" * 80)
    print()
    
    # Scenario 1: No extra payment - calculate total extra cost
    no_extra_result = calculate_interest_savings(
        principal1, rate1, principal2, rate2, od_rate, emi, 0.0, 0.0, remaining_months
    )
    # interest_saved is negative (we pay more with OD), so extra cost = conversion_fee + |interest_saved|
    extra_interest_cost = -no_extra_result['interest_saved']  # Make it positive (it's a cost)
    total_extra_cost_no_extra = conversion_fee + extra_interest_cost
    
    # Scenario 2: 80k monthly extra payment
    monthly_extra_80k = 80_000
    extra_80k_result = calculate_interest_savings(
        principal1, rate1, principal2, rate2, od_rate, emi, monthly_extra_80k, 0.0, remaining_months
    )
    extra_interest_cost_80k = -extra_80k_result['interest_saved']  # This will be negative (savings), so make positive
    if extra_interest_cost_80k < 0:
        interest_savings_80k = -extra_interest_cost_80k  # This is actual savings
        net_extra_cost_80k = conversion_fee - interest_savings_80k
    else:
        interest_savings_80k = 0
        net_extra_cost_80k = conversion_fee + extra_interest_cost_80k
    total_extra_paid_80k = monthly_extra_80k * remaining_months
    
    # Scenario 3: Upfront payment to break-even and to actually save money
    upfront_break_even = complete_break_even_upfront if complete_break_even_upfront > 0 else 0.0
    upfront_for_net_savings = upfront_for_savings if upfront_for_savings > 0 else upfront_break_even
    
    print("1. EXTRA COST OVER 7 YEARS (No Extra Payment):")
    print(f"   Conversion Fee:                    Rs {conversion_fee:,.2f}")
    print(f"   Extra Interest (due to higher rate): Rs {extra_interest_cost:,.2f}")
    print(f"   TOTAL EXTRA COST:                   Rs {total_extra_cost_no_extra:,.2f}")
    print()
    
    print("2. EXTRA COST OVER 7 YEARS (Rs 80,000/month Extra Payment):")
    print(f"   Conversion Fee:                    Rs {conversion_fee:,.2f}")
    print(f"   Interest Savings (from extra pmts): Rs {interest_savings_80k:,.2f}")
    print(f"   Net Extra Cost (after savings):     Rs {net_extra_cost_80k:,.2f}")
    print(f"   Total Extra Payments Made:          Rs {total_extra_paid_80k:,.2f}")
    print(f"   TOTAL OUTLAY (cost + payments):     Rs {net_extra_cost_80k + total_extra_paid_80k:,.2f}")
    print()
    
    print("3. UPFRONT PAYMENT TO SAVE MONEY (Covers fee + extra interest over 7 years):")
    print()
    print(f"   Total Extra Cost to Cover:")
    print(f"     Conversion Fee:                    Rs {conversion_fee:,.2f}")
    print(f"     Extra Interest (7 years):         Rs {extra_interest_cost:,.2f}")
    print(f"     TOTAL:                             Rs {total_extra_cost_no_extra:,.2f}")
    print()
    print(f"   Minimum Upfront Payment to BREAK-EVEN:  Rs {upfront_break_even:,.2f}")
    print(f"   Minimum Upfront Payment to SAVE MONEY: Rs {upfront_for_net_savings:,.2f}")
    print()
    print("   VERIFICATION (Break-Even Point):")
    verify_break_even = calculate_interest_savings(
        principal1, rate1, principal2, rate2, od_rate, emi, 0.0, upfront_break_even, remaining_months
    )
    net_benefit_break_even = verify_break_even['interest_saved'] - total_extra_cost_no_extra
    print(f"     Interest Saved (7 years):         Rs {verify_break_even['interest_saved']:,.2f}")
    print(f"     Less Total Extra Cost:            Rs {total_extra_cost_no_extra:,.2f}")
    print(f"       (Fee: Rs {conversion_fee:,.2f} + Extra Interest: Rs {extra_interest_cost:,.2f})")
    print(f"     NET BENEFIT:                       Rs {net_benefit_break_even:,.2f} (approximately break-even)")
    print()
    print("   VERIFICATION (Net Savings):")
    verify_savings = calculate_interest_savings(
        principal1, rate1, principal2, rate2, od_rate, emi, 0.0, upfront_for_net_savings, remaining_months
    )
    net_benefit_savings = verify_savings['interest_saved'] - total_extra_cost_no_extra
    print(f"     Interest Saved (7 years):         Rs {verify_savings['interest_saved']:,.2f}")
    print(f"     Less Total Extra Cost:            Rs {total_extra_cost_no_extra:,.2f}")
    print(f"       (Fee: Rs {conversion_fee:,.2f} + Extra Interest: Rs {extra_interest_cost:,.2f})")
    print(f"     NET SAVINGS:                       Rs {net_benefit_savings:,.2f}")
    print()
    print(f"   ANSWER: To save money with OD loan, make upfront payment of at least Rs {upfront_for_net_savings:,.0f}")
    print(f"           This upfront payment will save more interest than the total extra cost")
    print(f"           (conversion fee + extra interest from higher rate).")
    print()
    
    print("=" * 80)
    print("RECOMMENDATION:")
    print("=" * 80)
    
    if baseline_result['interest_saved'] >= conversion_fee:
        print("Conversion is profitable even without extra payments.")
    else:
        print(f"Conversion requires extra payments to be profitable.")
        print(f"   Minimum extra payment: Rs {break_even_extra:,.0f}/month to break even in Year 1.")
    
    print()
    print("Note: OD loans offer flexibility - you can withdraw extra payments if needed.")
    print("      This analysis assumes you maintain the extra payment throughout.")


if __name__ == "__main__":
    main()
