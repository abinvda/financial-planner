"""Tax calculations for 2025."""
from __future__ import annotations


# 2025 Federal tax brackets (single filer)
FEDERAL_BRACKETS_2025 = [
    (11600, 0.10),
    (47150, 0.12),
    (100525, 0.22),
    (191950, 0.24),
    (243725, 0.32),
    (609350, 0.35),
    (float("inf"), 0.37),
]

# 2025 Michigan state tax (flat 4.25%)
MICHIGAN_TAX_RATE = 0.0425

# 2025 FICA rates
SOCIAL_SECURITY_RATE = 0.062
MEDICARE_RATE = 0.0145
FICA_RATE = SOCIAL_SECURITY_RATE + MEDICARE_RATE  # 7.65%

# Standard deduction 2025 (single)
STANDARD_DEDUCTION_2025 = 14600

# Social Security wage base (2025)
SOCIAL_SECURITY_WAGE_BASE = 168600


def calculate_federal_tax(taxable_income: float) -> float:
    """Calculate 2025 federal income tax (single filer)."""
    if taxable_income <= 0:
        return 0.0
    
    tax = 0.0
    prev_bracket = 0.0
    
    for bracket_limit, rate in FEDERAL_BRACKETS_2025:
        if taxable_income <= prev_bracket:
            break
        
        taxable_in_bracket = min(taxable_income, bracket_limit) - prev_bracket
        tax += taxable_in_bracket * rate
        prev_bracket = bracket_limit
    
    return tax


def calculate_michigan_tax(taxable_income: float) -> float:
    """Calculate Michigan state tax (flat 4.25%)."""
    if taxable_income <= 0:
        return 0.0
    return taxable_income * MICHIGAN_TAX_RATE


def calculate_fica(gross_income: float) -> tuple[float, float]:
    """
    Calculate Social Security and Medicare taxes.
    
    Returns:
        (social_security_tax, medicare_tax)
    """
    # Social Security capped at wage base
    ss_tax = min(gross_income, SOCIAL_SECURITY_WAGE_BASE) * SOCIAL_SECURITY_RATE
    
    # Medicare is uncapped (plus 0.9% surtax on income >$200k, but ignoring for now)
    medicare_tax = gross_income * MEDICARE_RATE
    
    return ss_tax, medicare_tax


def get_marginal_tax_rate(taxable_income: float) -> float:
    """
    Get the marginal tax rate (federal + state) for a given taxable income.
    Used for taxing investment gains.
    
    Returns:
        Combined federal + state marginal rate
    """
    if taxable_income <= 0:
        return 0.0
    
    # Find federal marginal bracket
    federal_marginal = 0.10  # Default to lowest bracket
    prev_bracket = 0.0
    
    for bracket_limit, rate in FEDERAL_BRACKETS_2025:
        if taxable_income > prev_bracket:
            federal_marginal = rate
        if taxable_income <= bracket_limit:
            break
        prev_bracket = bracket_limit
    
    # Add Michigan flat tax
    return federal_marginal + MICHIGAN_TAX_RATE


def calculate_take_home(
    gross_income: float,
    hsa_annual: float = 0.0,
    k401_employee_annual: float = 0.0,
) -> dict:
    """
    Calculate take-home pay from gross income.
    
    Args:
        gross_income: Annual gross income
        hsa_annual: Annual HSA contribution (pre-tax)
        k401_employee_annual: Annual 401k employee contribution (pre-tax)
    
    Returns:
        Dict with detailed breakdown:
        - gross_income
        - hsa_contribution
        - k401_employee_contribution
        - k401_employer_match
        - taxable_income
        - federal_tax
        - michigan_tax
        - social_security_tax
        - medicare_tax
        - marginal_tax_rate
        - net_pay
    """
    # Pre-tax deductions
    pre_tax_deductions = hsa_annual + k401_employee_annual
    
    # Employer 401k match (100% up to 6% of gross)
    base_salary = gross_income - hsa_annual - k401_employee_annual  # Approximate
    k401_employer_match = min(k401_employee_annual, base_salary * 0.06)
    
    # Taxable income
    taxable_income = gross_income - pre_tax_deductions - STANDARD_DEDUCTION_2025
    taxable_income = max(0, taxable_income)
    
    # Calculate taxes
    federal_tax = calculate_federal_tax(taxable_income)
    michigan_tax = calculate_michigan_tax(taxable_income)
    ss_tax, medicare_tax = calculate_fica(gross_income)
    
    # Net pay
    total_taxes = federal_tax + michigan_tax + ss_tax + medicare_tax
    net_pay = gross_income - pre_tax_deductions - total_taxes
    
    # Calculate marginal rate for investment gains
    marginal_rate = get_marginal_tax_rate(taxable_income)
    
    return {
        "gross_income": gross_income,
        "hsa_contribution": hsa_annual,
        "k401_employee_contribution": k401_employee_annual,
        "k401_employer_match": k401_employer_match,
        "taxable_income": taxable_income,
        "federal_tax": federal_tax,
        "michigan_tax": michigan_tax,
        "social_security_tax": ss_tax,
        "medicare_tax": medicare_tax,
        "total_fica": ss_tax + medicare_tax,
        "total_taxes": total_taxes,
        "net_pay": net_pay,
        "marginal_tax_rate": marginal_rate,
    }
