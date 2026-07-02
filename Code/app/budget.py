"""Budget projection engine - simplified version."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional
import pandas as pd

from . import data_store, taxes


def get_monthly_net_pay(user_data: dict, include_bonus: bool = False) -> float:
    """Calculate monthly net pay from gross income.
    
    Args:
        user_data: User data dictionary
        include_bonus: If True, includes bonus (for March calculation). Default False.
    """
    gross_income = user_data["gross_income"]
    base_salary = gross_income["base_salary"]
    extras = gross_income.get("extras", 0.0)
    
    # Bonus is paid in March, not distributed monthly
    bonus = gross_income.get("bonus", 0.0) if include_bonus else 0.0
    
    annual_income = base_salary + extras + bonus
    
    hsa = user_data["deductions"].get("hsa_annual", 0.0)
    k401 = user_data["deductions"].get("k401_employee_annual", 0.0)
    
    breakdown = taxes.calculate_take_home(annual_income, hsa, k401)
    annual_net = breakdown["net_pay"]
    
    if include_bonus:
        # Return the after-tax bonus amount
        base_breakdown = taxes.calculate_take_home(base_salary + extras, hsa, k401)
        bonus_net = annual_net - base_breakdown["net_pay"]
        return bonus_net
    else:
        # Return monthly net from base + extras only
        return annual_net / 12


def get_total_monthly_expenses(expenses: list[dict]) -> float:
    """Calculate total monthly expenses from expense list."""
    monthly_total = 0.0
    
    for exp in expenses:
        amount = exp.get("amount", 0.0)
        cadence = exp.get("cadence", "monthly")
        
        if cadence == "monthly":
            monthly_total += amount
        elif cadence == "yearly":
            monthly_total += amount / 12
        # "one-time" expenses are handled separately
    
    return monthly_total


def get_one_time_expenses(expenses: list[dict]) -> dict[int, float]:
    """
    Get one-time expenses mapped to month numbers.
    
    Returns:
        Dict of {month_number: total_amount}
    """
    one_time = {}
    
    for exp in expenses:
        if exp.get("cadence") == "one-time":
            month = exp.get("month", 1)  # Assume month 1 if not specified
            one_time[month] = one_time.get(month, 0.0) + exp.get("amount", 0.0)
    
    return one_time


def project_accounts(username: str, num_months: int = 24, scenario_expenses: Optional[list] = None) -> pd.DataFrame:
    """
    Project account balances over time with growth rates and interest.
    
    Args:
        username: User to project for
        num_months: Number of months to project
        scenario_expenses: Optional list of one-time scenario expenses to test
    
    Returns DataFrame with columns:
    - month, date
    - monthly_net_income
    - monthly_expenses
    - one_time_expenses
    - disposable_income
    - brokerage_contribution
    - savings_balance (with 3.5% APY interest, taxed at marginal rate)
    - k401_balance (with growth)
    - hsa_balance (with growth)
    - brokerage_balance (with growth, taxed at marginal rate)
    """
    data_store.set_current_user(username)
    user_data = data_store.load_user_data()
    
    # Get components
    monthly_net = get_monthly_net_pay(user_data, include_bonus=False)  # Base monthly without bonus
    bonus_net = get_monthly_net_pay(user_data, include_bonus=True)  # Net bonus amount
    monthly_expenses = get_total_monthly_expenses(user_data["expenses"])
    brokerage_monthly = user_data["savings"].get("brokerage_monthly", 0.0)
    
    # Tax breakdown for account contributions
    gross = user_data["gross_income"]["total_gross"]
    hsa_annual = user_data["deductions"].get("hsa_annual", 0.0)
    k401_annual = user_data["deductions"].get("k401_employee_annual", 0.0)
    tax_info = taxes.calculate_take_home(gross, hsa_annual, k401_annual)
    
    # Monthly contributions
    hsa_monthly = hsa_annual / 12
    k401_employee_monthly = k401_annual / 12
    k401_employer_monthly = tax_info["k401_employer_match"] / 12
    
    # One-time expenses (including scenario expenses if provided)
    one_time_exp = get_one_time_expenses(user_data["expenses"])
    if scenario_expenses:
        scenario_one_time = get_one_time_expenses(scenario_expenses)
        for month_num, amount in scenario_one_time.items():
            one_time_exp[month_num] = one_time_exp.get(month_num, 0.0) + amount
    
    # Growth rates (annual percentage)
    growth_params = user_data.get("investment_growth", {})
    k401_annual_growth = growth_params.get("k401_annual_rate", 7.0) / 100.0
    hsa_annual_growth = growth_params.get("hsa_annual_rate", 5.0) / 100.0
    brokerage_annual_growth = growth_params.get("brokerage_annual_rate", 8.0) / 100.0
    savings_annual_interest = 0.035  # 3.5% APY
    
    # Convert to monthly rates (compound monthly)
    k401_monthly_rate = (1 + k401_annual_growth) ** (1/12) - 1
    hsa_monthly_rate = (1 + hsa_annual_growth) ** (1/12) - 1
    brokerage_monthly_rate = (1 + brokerage_annual_growth) ** (1/12) - 1
    savings_monthly_rate = (1 + savings_annual_interest) ** (1/12) - 1
    
    # Marginal tax rate for taxable gains
    marginal_rate = tax_info.get("marginal_tax_rate", 0.22)
    
    # Starting balances
    balances = user_data["account_balances"]
    savings_balance = balances["savings"]
    k401_balance = balances["k401"]
    hsa_balance = balances["hsa"]
    brokerage_balance = balances["brokerage"]
    
    # Build projection
    rows = []
    start_date = datetime.now()
    
    for month in range(1, num_months + 1):
        month_date = start_date + timedelta(days=30 * (month - 1))
        
        # Add bonus in March (month 3)
        monthly_income = monthly_net
        if month == 3:
            monthly_income += bonus_net
        
        # Get one-time expense for this month
        one_time_this_month = one_time_exp.get(month, 0.0)
        
        # Disposable = net income - expenses - one-time - brokerage
        disposable = monthly_income - monthly_expenses - one_time_this_month - brokerage_monthly
        
        # Apply growth to existing balances (before adding new contributions)
        savings_gain = savings_balance * savings_monthly_rate
        savings_gain_after_tax = savings_gain * (1 - marginal_rate)  # Tax on interest
        
        k401_gain = k401_balance * k401_monthly_rate  # Tax-deferred
        hsa_gain = hsa_balance * hsa_monthly_rate  # Tax-free
        
        brokerage_gain = brokerage_balance * brokerage_monthly_rate
        brokerage_gain_after_tax = brokerage_gain * (1 - marginal_rate)  # Tax on gains
        
        # Update balances with gains and contributions
        savings_balance += savings_gain_after_tax + disposable
        k401_balance += k401_gain + k401_employee_monthly + k401_employer_monthly
        hsa_balance += hsa_gain + hsa_monthly
        brokerage_balance += brokerage_gain_after_tax + brokerage_monthly
        
        rows.append({
            "month": month,
            "date": month_date.strftime("%Y-%m"),
            "monthly_net_income": monthly_income,
            "monthly_expenses": monthly_expenses,
            "one_time_expenses": one_time_this_month,
            "brokerage_contribution": brokerage_monthly,
            "disposable_income": disposable,
            "savings_balance": savings_balance,
            "k401_balance": k401_balance,
            "hsa_balance": hsa_balance,
            "brokerage_balance": brokerage_balance,
        })
    
    return pd.DataFrame(rows)
