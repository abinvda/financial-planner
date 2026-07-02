"""CLI harness to test the budget projection engine."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import budget


def main() -> None:
    """Run the budget projection and print results."""
    print("\n" + "=" * 80)
    print("BUDGET PROJECTION – 24 MONTH FORECAST")
    print("=" * 80 + "\n")
    
    # Generate projection
    df = budget.project_months(24)
    
    # Print summary statistics
    stats = budget.get_summary_stats(df)
    print("SUMMARY STATISTICS")
    print("-" * 80)
    print(f"Current Account Balance:    ${stats['current_balance']:>15,.2f}")
    print(f"Projected Balance (Month 24): ${stats['projected_balance']:>12,.2f}")
    print(f"Total Net Cash Flow (24mo):  ${stats['total_net_cash_flow']:>12,.2f}")
    print(f"Average Monthly Net Flow:    ${stats['avg_monthly_net_flow']:>12,.2f}")
    print(f"Emergency Fund Coverage:     {stats['emergency_fund_months']:>15.1f} months")
    print()
    
    # Print detailed month-by-month table
    print("MONTH-BY-MONTH BREAKDOWN")
    print("-" * 80)
    
    # Display every 3rd month to keep output readable
    display_cols = ["month", "date", "gross_income", "total_expenses", 
                    "net_cash_flow", "account_balance", "emergency_fund_months"]
    
    for idx, row in df.iterrows():
        if idx % 3 == 0 or idx == 0:  # Show months 1, 4, 7, 10, ...
            print(f"Month {int(row['month']):2d} ({row['date']})")
            print(f"  Gross Income:       ${row['gross_income']:>12,.2f}")
            print(f"  Total Expenses:     ${row['total_expenses']:>12,.2f}")
            print(f"  Net Cash Flow:      ${row['net_cash_flow']:>12,.2f}")
            print(f"  Account Balance:    ${row['account_balance']:>12,.2f}")
            print(f"  E-Fund Coverage:    {row['emergency_fund_months']:>14.2f} months")
            print()
    
    # Final month detail
    final = df.iloc[-1]
    print(f"Month {int(final['month']):2d} ({final['date']}) [FINAL]")
    print(f"  Gross Income:       ${final['gross_income']:>12,.2f}")
    print(f"  Total Expenses:     ${final['total_expenses']:>12,.2f}")
    print(f"  Net Cash Flow:      ${final['net_cash_flow']:>12,.2f}")
    print(f"  Account Balance:    ${final['account_balance']:>12,.2f}")
    print(f"  E-Fund Coverage:    {final['emergency_fund_months']:>14.2f} months")
    print()
    
    print("=" * 80)
    print("✅ Projection complete. Use this to review your financial runway.\n")


if __name__ == "__main__":
    main()
