"""Home loan calculations and amortization."""
from __future__ import annotations

import pandas as pd
from datetime import datetime, timedelta
from typing import Optional


def calculate_monthly_payment(principal: float, annual_rate: float, term_months: int) -> float:
    """
    Calculate monthly payment for a loan.
    
    Args:
        principal: Loan amount
        annual_rate: Annual interest rate (as percentage, e.g., 8.5 for 8.5%)
        term_months: Loan term in months
    
    Returns:
        Monthly payment amount
    """
    if annual_rate == 0:
        return principal / term_months
    
    monthly_rate = (annual_rate / 100) / 12
    num_payments = term_months
    
    # EMI formula: P * r * (1 + r)^n / ((1 + r)^n - 1)
    payment = principal * monthly_rate * (1 + monthly_rate) ** num_payments / ((1 + monthly_rate) ** num_payments - 1)
    
    return payment


def generate_amortization_schedule(
    principal: float,
    annual_rate: float,
    term_months: int,
    extra_payment: float = 0.0,
    one_time_payments: Optional[dict] = None,
    start_date: Optional[datetime] = None
) -> pd.DataFrame:
    """
    Generate loan amortization schedule.
    
    Args:
        principal: Loan amount
        annual_rate: Annual interest rate (as percentage)
        term_months: Loan term in months
        extra_payment: Additional monthly payment
        one_time_payments: Dict of {month_number: amount} for one-time extra payments
        start_date: Start date of loan (default: today)
    
    Returns:
        DataFrame with columns: month, date, payment, principal_payment, interest_payment,
                                extra_payment, total_payment, balance, total_interest_paid
    """
    if start_date is None:
        start_date = datetime.now()
    
    if one_time_payments is None:
        one_time_payments = {}
    
    monthly_payment = calculate_monthly_payment(principal, annual_rate, term_months)
    monthly_rate = (annual_rate / 100) / 12
    
    balance = principal
    total_interest = 0.0
    rows = []
    month = 0
    
    # Continue until balance is paid off OR we reach the term limit (whichever comes first)
    max_months = min(term_months * 2, 1000)  # Safety limit
    
    while balance > 0.01 and month < max_months:
        month += 1
        payment_date = start_date + timedelta(days=30 * (month - 1))
        
        # Interest for this month
        interest_payment = balance * monthly_rate
        
        # Principal payment (from regular payment)
        principal_payment = min(monthly_payment - interest_payment, balance)
        
        # Extra payment (regular monthly + any one-time payment for this month)
        extra_this_month = extra_payment
        if month in one_time_payments:
            extra_this_month += one_time_payments[month]
        
        extra_this_month = min(extra_this_month, balance - principal_payment)
        
        # Total payment
        total_payment = interest_payment + principal_payment + extra_this_month
        
        # Update balance
        balance -= (principal_payment + extra_this_month)
        total_interest += interest_payment
        
        rows.append({
            "month": month,
            "date": payment_date.strftime("%Y-%m"),
            "payment": monthly_payment,
            "principal_payment": principal_payment,
            "interest_payment": interest_payment,
            "extra_payment": extra_this_month,
            "total_payment": total_payment,
            "balance": max(0, balance),
            "total_interest_paid": total_interest,
        })
    
    return pd.DataFrame(rows)


def calculate_loan_savings(
    principal: float,
    annual_rate: float,
    term_months: int,
    extra_payment: float,
    one_time_payments: Optional[dict] = None
) -> dict:
    """
    Calculate savings from extra payments.
    
    Returns:
        Dict with baseline and with_extra scenarios
    """
    # Baseline (no extra payment)
    baseline_schedule = generate_amortization_schedule(principal, annual_rate, term_months, 0, None)
    baseline_months = len(baseline_schedule)
    baseline_total_interest = baseline_schedule["total_interest_paid"].iloc[-1]
    baseline_total_paid = baseline_schedule["total_payment"].sum()
    
    # With extra payment
    extra_schedule = generate_amortization_schedule(principal, annual_rate, term_months, extra_payment, one_time_payments)
    extra_months = len(extra_schedule)
    extra_total_interest = extra_schedule["total_interest_paid"].iloc[-1]
    extra_total_paid = extra_schedule["total_payment"].sum()
    
    return {
        "baseline": {
            "months": baseline_months,
            "years": baseline_months / 12,
            "total_interest": baseline_total_interest,
            "total_paid": baseline_total_paid,
        },
        "with_extra": {
            "months": extra_months,
            "years": extra_months / 12,
            "total_interest": extra_total_interest,
            "total_paid": extra_total_paid,
        },
        "savings": {
            "months_saved": baseline_months - extra_months,
            "years_saved": (baseline_months - extra_months) / 12,
            "interest_saved": baseline_total_interest - extra_total_interest,
            "total_saved": baseline_total_paid - extra_total_paid,
        }
    }

