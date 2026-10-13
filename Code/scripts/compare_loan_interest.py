"""
Compare total interest paid: Current two-loan setup vs OD loan.
"""

def calculate_loan_interest_with_emi(
    principal: float,
    rate: float,
    emi: float,
    months: int,
) -> float:
    """
    Calculate total interest paid given principal, rate, EMI, and months.
    """
    monthly_rate = (rate / 100) / 12
    balance = principal
    total_interest = 0.0
    
    for month in range(1, months + 1):
        if balance <= 0:
            break
        
        # Interest for this month
        month_interest = balance * monthly_rate
        total_interest += month_interest
        
        # Principal payment from EMI
        principal_payment = min(emi - month_interest, balance)
        
        # Update balance
        balance = max(0, balance - principal_payment)
    
    return total_interest


def calculate_od_loan_interest(
    total_principal: float,
    od_rate: float,
    emi: float,
    upfront_payment: float = 0.0,
    months: int = 12,
) -> float:
    """
    Calculate total interest for OD loan with optional upfront payment.
    """
    monthly_rate = (od_rate / 100) / 12
    balance = total_principal - upfront_payment  # Upfront payment reduces principal immediately
    total_interest = 0.0
    
    for month in range(1, months + 1):
        if balance <= 0:
            break
        
        # Interest for this month
        month_interest = balance * monthly_rate
        total_interest += month_interest
        
        # Principal payment from EMI
        principal_payment = min(emi - month_interest, balance)
        
        # Update balance
        balance = max(0, balance - principal_payment)
    
    return total_interest


def find_upfront_for_savings(
    total_principal: float,
    od_rate: float,
    emi: float,
    target_savings: float,
    months: int = 12,
    tolerance: float = 1000.0,
) -> float:
    """
    Find upfront payment needed to save target_savings in interest over given months.
    Uses binary search.
    """
    # Get baseline (no upfront payment)
    baseline_interest = calculate_od_loan_interest(total_principal, od_rate, emi, 0.0, months)
    
    # Binary search for upfront payment amount
    low = 0.0
    high = 1_00_00_000  # Upper bound: Rs 1 crore
    best_upfront = 0.0
    
    while high - low > tolerance:
        mid = (low + high) / 2
        interest_with_upfront = calculate_od_loan_interest(total_principal, od_rate, emi, mid, months)
        savings = baseline_interest - interest_with_upfront
        
        if savings >= target_savings:
            best_upfront = mid
            high = mid
        else:
            low = mid
    
    return best_upfront


def main():
    # Current loan details
    principal1 = 68_83_676
    rate1 = 7.85
    emi1 = 1_16_581
    
    principal2 = 42_29_691
    rate2 = 8.0
    emi2 = 72_605
    
    remaining_months = 74
    
    # OD loan details
    total_principal_od = principal1 + principal2
    od_rate = 8.05
    total_emi = emi1 + emi2  # Combined EMI
    
    print("=" * 80)
    print("LOAN INTEREST COMPARISON")
    print("=" * 80)
    print()
    
    print("CURRENT SETUP:")
    print(f"  Loan 1: Principal Rs {principal1:,.2f}, Rate {rate1}%, EMI Rs {emi1:,.2f}")
    print(f"  Loan 2: Principal Rs {principal2:,.2f}, Rate {rate2}%, EMI Rs {emi2:,.2f}")
    print(f"  Remaining Term: {remaining_months} months")
    print()
    
    # Calculate interest for current setup
    interest1 = calculate_loan_interest_with_emi(principal1, rate1, emi1, remaining_months)
    interest2 = calculate_loan_interest_with_emi(principal2, rate2, emi2, remaining_months)
    total_interest_current = interest1 + interest2
    
    print("PROPOSED OD LOAN:")
    print(f"  Combined Principal: Rs {total_principal_od:,.2f}")
    print(f"  Interest Rate: {od_rate}%")
    print(f"  Combined EMI: Rs {total_emi:,.2f}")
    print(f"  Remaining Term: {remaining_months} months")
    print()
    
    # Calculate interest for OD loan (no upfront payment)
    total_interest_od = calculate_od_loan_interest(total_principal_od, od_rate, total_emi, 0.0, remaining_months)
    
    # Calculate first year interest for OD loan (no upfront payment)
    first_year_interest_od = calculate_od_loan_interest(total_principal_od, od_rate, total_emi, 0.0, 12)
    
    # Calculate difference
    interest_difference = total_interest_od - total_interest_current
    
    print("=" * 80)
    print("RESULTS:")
    print("=" * 80)
    print()
    print("CURRENT SETUP (Two Separate Loans):")
    print(f"  Loan 1 Interest:              Rs {interest1:,.2f}")
    print(f"  Loan 2 Interest:              Rs {interest2:,.2f}")
    print(f"  TOTAL INTEREST:               Rs {total_interest_current:,.2f}")
    print()
    print("OD LOAN (Combined):")
    print(f"  TOTAL INTEREST:               Rs {total_interest_od:,.2f}")
    print()
    print("COMPARISON:")
    print(f"  Interest Difference:          Rs {interest_difference:,.2f}")
    if interest_difference > 0:
        print(f"  OD loan costs MORE by:        Rs {interest_difference:,.2f}")
    else:
        print(f"  OD loan SAVES:                Rs {-interest_difference:,.2f}")
    print()
    
    # Calculate weighted average rate for current setup
    weighted_rate = (principal1 * rate1 + principal2 * rate2) / (principal1 + principal2)
    print(f"  Current Weighted Average Rate: {weighted_rate:.2f}%")
    print(f"  OD Loan Rate:                  {od_rate}%")
    print(f"  Rate Difference:              {od_rate - weighted_rate:.2f}%")
    print()
    
    # Calculate upfront payment needed to save ₹75,000 over different time periods
    print("=" * 80)
    print("UPFRONT PAYMENT ANALYSIS - DURATION WISE:")
    print("=" * 80)
    print()
    print("Calculating upfront payment needed to save Rs 75,000 over different time periods")
    print()
    
    target_savings = interest_difference + 40_000
    durations = [12, 24, 36, 48, 60, 74]  # 1 year, 2 years, 3 years, 4 years, 5 years, full term
    
    print(f"{'Duration':<15} {'Months':<10} {'Upfront Payment':<20} {'Interest Saved':<20} {'Principal After':<20}")
    print("-" * 85)
    
    for months in durations:
        # Calculate baseline interest for this duration
        baseline_interest = calculate_od_loan_interest(total_principal_od, od_rate, total_emi, 0.0, months)
        
        # Find upfront payment needed
        upfront_needed = find_upfront_for_savings(
            total_principal_od, od_rate, total_emi, target_savings, months
        )
        
        if upfront_needed > 0:
            # Verify
            interest_with_upfront = calculate_od_loan_interest(
                total_principal_od, od_rate, total_emi, upfront_needed, months
            )
            actual_savings = baseline_interest - interest_with_upfront
            principal_after = total_principal_od - upfront_needed
            
            years = months / 12
            duration_str = f"{years:.1f} year{'s' if years != 1 else ''}"
            
            print(f"{duration_str:<15} {months:<10} Rs {upfront_needed:>15,.0f}  Rs {actual_savings:>15,.2f}  Rs {principal_after:>15,.2f}")
        else:
            years = months / 12
            duration_str = f"{years:.1f} year{'s' if years != 1 else ''}"
            print(f"{duration_str:<15} {months:<10} {'N/A':<20} {'N/A':<20} {'N/A':<20}")
    
    print()
    print("=" * 80)
    print("DETAILED BREAKDOWN:")
    print("=" * 80)
    print()
    
    # Show detailed breakdown for key durations
    key_durations = [12, 24, 36, 74]
    for months in key_durations:
        years = months / 12
        print(f"{years:.1f} Year{'s' if years != 1 else ''} ({months} months):")
        print("-" * 80)
        
        baseline_interest = calculate_od_loan_interest(total_principal_od, od_rate, total_emi, 0.0, months)
        upfront_needed = find_upfront_for_savings(
            total_principal_od, od_rate, total_emi, target_savings, months
        )
        
        if upfront_needed > 0:
            interest_with_upfront = calculate_od_loan_interest(
                total_principal_od, od_rate, total_emi, upfront_needed, months
            )
            actual_savings = baseline_interest - interest_with_upfront
            
            print(f"  Upfront Payment Needed:        Rs {upfront_needed:,.2f}")
            print(f"  Interest (No Upfront):        Rs {baseline_interest:,.2f}")
            print(f"  Interest (With Upfront):      Rs {interest_with_upfront:,.2f}")
            print(f"  Interest Saved:                Rs {actual_savings:,.2f}")
            print(f"  Principal Reduction:           From Rs {total_principal_od:,.2f} to Rs {total_principal_od - upfront_needed:,.2f}")
        else:
            print(f"  No upfront payment needed")
        print()


if __name__ == "__main__":
    main()
