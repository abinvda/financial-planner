"""Seed JSON files with initial financial data."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import data_store


def prompt_float(label: str, default: float = 0.0) -> float:
    """Prompt user for a floating-point number."""
    try:
        val = input(f"{label} (default: {default}): ").strip()
        return float(val) if val else default
    except ValueError:
        print("Invalid number. Using default.")
        return default


def prompt_text(label: str, default: str = "") -> str:
    """Prompt user for text."""
    val = input(f"{label} (default: {default}): ").strip()
    return val if val else default


def seed_gross_income() -> dict:
    """Prompt for gross income components."""
    print("\n" + "=" * 60)
    print("GROSS INCOME (Annual)")
    print("=" * 60)
    print("Enter your annual gross income BEFORE any deductions.\n")
    
    base_salary = prompt_float("Base salary (annual, USD)", default=160000.0)
    bonus = prompt_float("Annual bonus (USD)", default=20000.0)
    extras = prompt_float("Other income (stock awards, side hustle, USD)", default=0.0)
    
    return {
        "base_salary": base_salary,
        "bonus": bonus,
        "extras": extras,
        "total_gross": base_salary + bonus + extras,
    }


def seed_pre_tax_deductions() -> dict:
    """Prompt for pre-tax deductions."""
    print("\n" + "=" * 60)
    print("PRE-TAX DEDUCTIONS (Annual)")
    print("=" * 60)
    print("These reduce your taxable income.\n")
    
    hsa_annual = prompt_float("HSA contribution (annual, USD)", default=2800.0)
    k401_employee = prompt_float("401(k) employee contribution (annual, USD)", default=15000.0)
    
    print("\nNote: 401(k) employer match is 100% up to 6% of base salary (automatic)")
    
    return {
        "hsa_annual": hsa_annual,
        "k401_employee_annual": k401_employee,
    }


def seed_post_tax_savings() -> dict:
    """Prompt for post-tax savings (after taxes)."""
    print("\n" + "=" * 60)
    print("POST-TAX SAVINGS (Monthly)")
    print("=" * 60)
    print("These come out AFTER taxes are calculated.\n")
    
    brokerage_monthly = prompt_float("Monthly brokerage contribution (USD)", default=500.0)
    
    return {
        "brokerage_monthly": brokerage_monthly,
    }


def seed_expenses() -> list[dict]:
    """Prompt for expenses."""
    print("\n" + "=" * 60)
    print("EXPENSES")
    print("=" * 60)
    print("Enter your expenses. You can add more in the Streamlit UI.\n")
    
    default_expenses = [
        ("Rent (US)", 1000.0, "monthly"),
        ("Groceries", 400.0, "monthly"),
        ("Utilities", 200.0, "monthly"),
        ("Insurance", 250.0, "monthly"),
        ("Transportation", 500.0, "monthly"),
        ("Dining Out", 300.0, "monthly"),
        ("Entertainment", 300.0, "monthly"),
    ]
    
    expenses = []
    
    for name, default_amt, cadence in default_expenses:
        amount = prompt_float(f"{name} ({cadence})", default=default_amt)
        if amount > 0:
            expenses.append({
                "name": name,
                "amount": amount,
                "cadence": cadence,  # "monthly", "yearly", "one-time"
                "category": name.lower().split()[0],
            })
    
    return expenses


def seed_account_balances() -> dict:
    """Prompt for current account balances."""
    print("\n" + "=" * 60)
    print("CURRENT ACCOUNT BALANCES")
    print("=" * 60)
    print("Enter your current balances (we don't track checking).\n")
    
    return {
        "savings": prompt_float("Savings account (USD)", default=30000.0),
        "k401": prompt_float("401(k) balance (USD)", default=50000.0),
        "hsa": prompt_float("HSA balance (USD)", default=3000.0),
        "brokerage": prompt_float("Brokerage account (USD)", default=10000.0),
    }


def main() -> None:
    """Main seed routine."""
    print("\n")
    print("=" * 60)
    print("BUDGET PLANNER – DATA SEEDING")
    print("=" * 60)
    print("This script will set up your financial profile.\n")
    
    username = prompt_text("Username", default="default")
    data_store.set_current_user(username)
    
    # Collect all data
    gross_income = seed_gross_income()
    pre_tax = seed_pre_tax_deductions()
    post_tax = seed_post_tax_savings()
    expenses = seed_expenses()
    balances = seed_account_balances()
    
    # Build user data
    user_data = {
        "name": username,
        "gross_income": gross_income,
        "deductions": pre_tax,
        "savings": post_tax,
        "expenses": expenses,
        "account_balances": balances,
    }
    
    # Save to JSON
    data_store.save_user_data(user_data, username)
    
    print("\n" + "=" * 60)
    print("✅ SEEDING COMPLETE!")
    print("=" * 60)
    print(f"Your data is saved at: {data_store.get_user_file(username)}")
    print("Start the Streamlit app with: streamlit run ui/streamlit_app.py\n")


if __name__ == "__main__":
    main()
