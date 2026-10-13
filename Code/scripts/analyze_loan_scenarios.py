"""Analyze your home loan prepayment scenarios."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import data_store, loan_strategy


def main() -> None:
    """Load your data and compare scenarios."""
    print("\n" + "=" * 70)
    print("HOME LOAN STRATEGY ANALYSIS")
    print("=" * 70)
    
    # Load your data
    data_store.set_current_user("Me")
    user_data = data_store.load_user_data()
    
    loan = user_data["loan"]
    incomes = user_data["incomes"]
    
    principal = loan["principal_in_inr"]
    rate = loan["interest_rate"]
    emi = loan["emi_amount"]
    months = loan["remaining_tenure_months"]
    
    print(f"\n📊 Current Loan Status:")
    print(f"   Principal:  ₹{principal:,.0f}")
    print(f"   Rate:       {rate}% p.a.")
    print(f"   EMI:        ₹{emi:,.0f}")
    print(f"   Remaining:  {months} months (~{months/12:.1f} years)")
    
    base_annual_income = sum(inc["gross_amount"] for inc in incomes)
    print(f"\n💰 Annual USD Income: ${base_annual_income:,.0f}")
    
    # Define scenarios
    print("\n" + "-" * 70)
    print("📈 SCENARIO ANALYSIS")
    print("-" * 70)
    
    scenarios = {
        "Baseline (No Prepayment)": {},
        "₹50k/quarter (4x/year)": loan_strategy.get_prepayment_schedule(
            num_prepayments=24, amount_per_prepayment=50000, frequency_months=3
        ),
        "₹100k/quarter (4x/year)": loan_strategy.get_prepayment_schedule(
            num_prepayments=24, amount_per_prepayment=100000, frequency_months=3
        ),
        "₹150k/quarter (4x/year)": loan_strategy.get_prepayment_schedule(
            num_prepayments=24, amount_per_prepayment=150000, frequency_months=3
        ),
        "₹189k/month (Double EMI, 24 months)": {m: 189186 for m in range(1, 25)},
    }
    
    comparison = loan_strategy.compare_scenarios(
        principal_inr=principal,
        interest_rate=rate,
        emi_amount=emi,
        remaining_tenure_months=months,
        scenarios=scenarios,
    )
    
    print("\n" + comparison.to_string(index=False))
    
    # Monthly prepayment impact analysis
    print("\n" + "-" * 70)
    print("📉 MONTHLY PREPAYMENT SENSITIVITY (24-month window)")
    print("-" * 70)
    
    impact = loan_strategy.analyze_prepayment_impact(
        principal_inr=principal,
        interest_rate=rate,
        emi_amount=emi,
        remaining_tenure_months=months,
        max_annual_prepayment=0,  # Not used in this version
    )
    
    print("\n" + impact.to_string(index=False))
    
    # Key insights
    print("\n" + "=" * 70)
    print("💡 KEY INSIGHTS")
    print("=" * 70)
    
    baseline_interest = comparison.iloc[0]["Total Interest (₹)"]
    max_saving = comparison["Interest Saved (₹)"].max()
    time_saved = comparison["Time Saved (months)"].max()
    
    print(f"\nBaseline total interest (no prepayment): ₹{baseline_interest:,.0f}")
    print(f"Max interest you could save: ₹{max_saving:,.0f}")
    print(f"Max time you could save: {time_saved} months ({time_saved/12:.1f} years)")
    
    print("\n✅ Next steps:")
    print("   1. Decide which scenario fits your cash flow")
    print("   2. Check if you need 401k/HSA/savings for other goals")
    print("   3. Calculate USD impact via FX rates")
    print("   4. Use Streamlit UI to adjust parameters in real-time\n")


if __name__ == "__main__":
    main()
