"""Loan strategy simulator - analyze prepayment scenarios.

This module calculates different home loan repayment strategies and compares
their financial outcomes (interest saved, time to payoff, impact on USD savings).
"""
from __future__ import annotations

import pandas as pd
from dataclasses import dataclass


@dataclass
class LoanSnapshot:
    """A point-in-time loan state."""
    month: int
    principal: float
    interest_paid_ytd: float
    total_paid_ytd: float
    prepayment: float  # Amount prepaid in this month
    emi_payment: float  # Regular EMI payment


@dataclass
class LoanScenarioResult:
    """Result of a prepayment scenario."""
    scenario_name: str
    total_months: int
    total_interest_paid: float
    total_prepayments: float
    total_paid: float
    interest_saved_vs_baseline: float
    time_saved_months: int
    timeline: list[LoanSnapshot]


def calculate_monthly_interest(principal: float, annual_rate: float) -> float:
    """Calculate interest for one month given principal and annual rate."""
    monthly_rate = annual_rate / 100 / 12
    return principal * monthly_rate


def simulate_loan_scenario(
    principal_inr: float,
    interest_rate: float,  # Annual %, e.g., 7.85
    emi_amount: float,
    remaining_tenure_months: int,
    prepayment_schedule: dict[int, float] | None = None,
    max_months: int = 500,  # Safety limit
) -> LoanScenarioResult:
    """
    Simulate a loan with optional prepayments.
    
    Args:
        principal_inr: Current outstanding principal
        interest_rate: Annual interest rate (%)
        emi_amount: Regular monthly EMI
        remaining_tenure_months: Original remaining tenure
        prepayment_schedule: Dict mapping month → prepayment amount
                            (e.g., {1: 50000, 2: 50000, ...})
        max_months: Safety limit to prevent infinite loops
    
    Returns:
        LoanScenarioResult with detailed timeline
    """
    prepayment_schedule = prepayment_schedule or {}
    
    principal = principal_inr
    month = 0
    total_interest = 0.0
    total_paid = 0.0
    total_prepayments = 0.0
    timeline = []
    
    while principal > 0 and month < max_months:
        month += 1
        
        # Calculate interest for this month
        monthly_interest = calculate_monthly_interest(principal, interest_rate)
        
        # Regular EMI payment (but don't overpay if principal is low)
        emi_payment = min(emi_amount, principal + monthly_interest)
        
        # Prepayment if scheduled
        prepayment = prepayment_schedule.get(month, 0.0)
        
        # Principal reduction = EMI - interest + prepayment
        principal_reduction = emi_payment - monthly_interest + prepayment
        principal -= principal_reduction
        
        total_interest += monthly_interest
        total_paid += emi_payment + prepayment
        total_prepayments += prepayment
        
        snapshot = LoanSnapshot(
            month=month,
            principal=max(0, principal),
            interest_paid_ytd=total_interest,
            total_paid_ytd=total_paid,
            prepayment=prepayment,
            emi_payment=emi_payment,
        )
        timeline.append(snapshot)
    
    # Determine scenario name from prepayment pattern
    if not prepayment_schedule:
        scenario_name = "Baseline (No Prepayment)"
    elif all(v == list(prepayment_schedule.values())[0] for v in prepayment_schedule.values()):
        # Regular prepayment
        freq = len(prepayment_schedule)
        amount = list(prepayment_schedule.values())[0]
        scenario_name = f"Regular: ₹{amount:,.0f} every {freq} months ({len(prepayment_schedule)} times)"
    else:
        scenario_name = "Custom Prepayment"
    
    return LoanScenarioResult(
        scenario_name=scenario_name,
        total_months=month,
        total_interest_paid=total_interest,
        total_prepayments=total_prepayments,
        total_paid=total_paid,
        interest_saved_vs_baseline=0.0,  # Will be set after baseline
        time_saved_months=0,
        timeline=timeline,
    )


def compare_scenarios(
    principal_inr: float,
    interest_rate: float,
    emi_amount: float,
    remaining_tenure_months: int,
    scenarios: dict[str, dict[int, float]],
) -> pd.DataFrame:
    """
    Compare multiple prepayment scenarios.
    
    Args:
        principal_inr: Current outstanding principal
        interest_rate: Annual interest rate (%)
        emi_amount: Regular monthly EMI
        remaining_tenure_months: Original remaining tenure
        scenarios: Dict of {scenario_name: prepayment_schedule}
                  e.g., {
                      "No Prepayment": {},
                      "₹50k/quarter": {3: 50000, 6: 50000, 9: 50000, ...},
                  }
    
    Returns:
        DataFrame comparing all scenarios
    """
    baseline_result = None
    results = []
    
    for scenario_name, prepayment_schedule in scenarios.items():
        result = simulate_loan_scenario(
            principal_inr=principal_inr,
            interest_rate=interest_rate,
            emi_amount=emi_amount,
            remaining_tenure_months=remaining_tenure_months,
            prepayment_schedule=prepayment_schedule,
        )
        result.scenario_name = scenario_name
        
        if "No Prepayment" in scenario_name or "Baseline" in scenario_name:
            baseline_result = result
        
        results.append(result)
    
    # Calculate savings relative to baseline
    if baseline_result:
        for result in results:
            result.interest_saved_vs_baseline = baseline_result.total_interest_paid - result.total_interest_paid
            result.time_saved_months = baseline_result.total_months - result.total_months
    
    # Build comparison DataFrame
    comparison = pd.DataFrame([
        {
            "Scenario": r.scenario_name,
            "Total Months": r.total_months,
            "Total Interest (₹)": r.total_interest_paid,
            "Total Prepayments (₹)": r.total_prepayments,
            "Interest Saved (₹)": r.interest_saved_vs_baseline,
            "Time Saved (months)": r.time_saved_months,
        }
        for r in results
    ])
    
    return comparison


def get_prepayment_schedule(
    num_prepayments: int,
    amount_per_prepayment: float,
    frequency_months: int = 3,
) -> dict[int, float]:
    """
    Generate a regular prepayment schedule.
    
    Args:
        num_prepayments: How many times to prepay
        amount_per_prepayment: Amount in INR each time
        frequency_months: How often (e.g., every 3 months)
    
    Returns:
        Dict mapping month → prepayment amount
    """
    schedule = {}
    for i in range(1, num_prepayments + 1):
        month = i * frequency_months
        schedule[month] = amount_per_prepayment
    return schedule


def analyze_prepayment_impact(
    principal_inr: float,
    interest_rate: float,
    emi_amount: float,
    remaining_tenure_months: int,
    max_annual_prepayment: float,
) -> pd.DataFrame:
    """
    Show impact of different prepayment amounts.
    
    Useful for answering: "If I prepay ₹X per month, how much interest do I save?"
    """
    monthly_prepayments = [0, 25000, 50000, 75000, 100000, 150000]
    results = []
    
    for monthly_prep in monthly_prepayments:
        if monthly_prep == 0:
            schedule = {}
        else:
            # Prepay monthly for 24 months
            schedule = {m: monthly_prep for m in range(1, 25)}
        
        result = simulate_loan_scenario(
            principal_inr=principal_inr,
            interest_rate=interest_rate,
            emi_amount=emi_amount,
            remaining_tenure_months=remaining_tenure_months,
            prepayment_schedule=schedule,
        )
        
        results.append({
            "Monthly Prepayment (₹)": monthly_prep,
            "Total Prepaid (₹)": result.total_prepayments,
            "Total Interest (₹)": result.total_interest_paid,
            "Months to Payoff": result.total_months,
            "Interest Saved (₹)": None,  # Will fill after baseline
        })
    
    df = pd.DataFrame(results)
    baseline_interest = df.loc[df["Monthly Prepayment (₹)"] == 0, "Total Interest (₹)"].values[0]
    df["Interest Saved (₹)"] = (baseline_interest - df["Total Interest (₹)"]).astype(int)
    
    return df
