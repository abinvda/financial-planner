"""Complete financial analysis - budget + loan scenarios."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import data_store, budget, loan_strategy


def main() -> None:
    """Run complete analysis."""
    print("\n" + "=" * 70)
    print("COMPLETE FINANCIAL ANALYSIS")
    print("=" * 70)
    
    # Load data
    data_store.set_current_user("Me")
    user_data = data_store.load_user_data()
    
    loan = user_data["loan"]
    tax = user_data["tax"]
    
    # Part 1: Budget Projection
    print("\n📊 BUDGET PROJECTION (24 months)")
    print("-" * 70)
    
    projection = budget.project_months(username="Me", num_months=24)
    
    # Show key metrics
    monthly_net = projection["Net Cash Flow"].mean()
    total_balance_end = projection["Total Balance"].iloc[-1]
    emergency_fund_target = budget.get_monthly_expenses("Me") * 4
    
    print(f"\nAverage monthly net cash flow: ${monthly_net:,.2f}")
    print(f"Projected balance in 24 months: ${total_balance_end:,.2f}")
    print(f"Emergency fund target (4 months): ${emergency_fund_target:,.2f}")
    
    current_balance = budget.get_current_total_balance("Me")
    if current_balance >= emergency_fund_target:
        surplus = current_balance - emergency_fund_target
        print(f"✅ Emergency fund covered! Surplus: ${surplus:,.2f}")
    else:
        deficit = emergency_fund_target - current_balance
        print(f"⚠️  Emergency fund gap: ${deficit:,.2f}")
    
    # Part 2: Loan Scenarios with USD Impact
    print("\n" + "=" * 70)
    print("🏠 LOAN PREPAYMENT SCENARIOS")
    print("-" * 70)
    
    principal = loan["principal_in_inr"]
    rate = loan["interest_rate"]
    emi = loan["emi_amount"]
    months_loan = loan["remaining_tenure_months"]
    fx_rate = loan["fx_reference"]
    
    print(f"\nLoan: ₹{principal:,.0f} at {rate}%, {months_loan} months left")
    print(f"Exchange rate: ${1} = ₹{fx_rate}")
    
    # Define scenarios with USD equivalents
    scenarios = {
        "Baseline": {},
        "₹100k quarterly": loan_strategy.get_prepayment_schedule(24, 100000, 3),
        "₹189k monthly (24 months)": {m: 189186 for m in range(1, 25)},
    }
    
    comparison = loan_strategy.compare_scenarios(
        principal_inr=principal,
        interest_rate=rate,
        emi_amount=emi,
        remaining_tenure_months=months_loan,
        scenarios=scenarios,
    )
    
    print("\n" + comparison.to_string(index=False))
    
    # Calculate USD impact
    print("\n💵 USD IMPACT ANALYSIS")
    print("-" * 70)
    
    for _, row in comparison.iterrows():
        scenario = row["Scenario"]
        prepayments_inr = row["Total Prepayments (₹)"]
        prepayments_usd = prepayments_inr / fx_rate
        interest_saved_inr = row["Interest Saved (₹)"]
        interest_saved_usd = interest_saved_inr / fx_rate
        
        if prepayments_usd > 0:
            roi = (interest_saved_usd / prepayments_usd) * 100
            print(f"\n{scenario}:")
            print(f"  Total prepayment: ${prepayments_usd:,.2f} (₹{prepayments_inr:,.0f})")
            print(f"  Interest saved: ${interest_saved_usd:,.2f} (₹{interest_saved_inr:,.0f})")
            print(f"  ROI: {roi:.1f}%")
            print(f"  Months saved: {row['Time Saved (months)']}")
    
    # Part 3: Feasibility Check
    print("\n" + "=" * 70)
    print("✅ FEASIBILITY CHECK")
    print("=" * 70)
    
    # Monthly prepayment options
    quarterly_prepay_usd = 100000 / fx_rate
    monthly_prepay_usd = quarterly_prepay_usd / 3
    
    print(f"\nAverage net cash flow: ${monthly_net:,.2f}/month")
    print(f"Quarterly ₹100k prepayment = ${quarterly_prepay_usd:,.2f}/quarter = ${monthly_prepay_usd:,.2f}/month")
    
    if monthly_net > monthly_prepay_usd:
        print(f"✅ You can afford ₹100k quarterly prepayments")
        print(f"   Remaining for savings/investment: ${monthly_net - monthly_prepay_usd:,.2f}/month")
    else:
        print(f"⚠️  ₹100k quarterly may strain cash flow")
        print(f"   Consider smaller amounts or withdrawing from savings")
    
    print("\n" + "=" * 70)
    print("💡 RECOMMENDATIONS")
    print("=" * 70)
    print("\n1. Maintain emergency fund (4 months expenses)")
    print("2. Use surplus cash flow for loan prepayments")
    print("3. Consider 401k/HSA max contributions for tax benefits")
    print("4. Monitor FX rates - prepay when USD is strong vs INR")
    print("5. Review scenarios quarterly and adjust\n")


if __name__ == "__main__":
    main()
