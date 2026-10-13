"""Simple data validation helpers (no database, just type checking).

These are optional—you can work with plain dicts if you prefer.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Optional


class Currency(str, Enum):
    USD = "USD"
    INR = "INR"


@dataclass
class IncomeStream:
    name: str
    gross_amount: float
    cadence: str = "monthly"
    currency: str = "USD"
    taxable: bool = True
    bonus_month: Optional[int] = None


@dataclass
class Expense:
    name: str
    amount: float
    cadence: str = "monthly"
    essential: bool = True
    category: Optional[str] = None


@dataclass
class Account:
    name: str
    account_type: str
    balance: float
    currency: str = "USD"
    last_updated: Optional[str] = None


@dataclass
class LoanProfile:
    principal_in_inr: float
    interest_rate: float
    emi_amount: float
    remaining_tenure_months: int
    fx_reference: float
    prepayment_rule: str = "min_one_emi"


@dataclass
class TaxProfile:
    year: int
    federal_marginal_rate: float
    state_marginal_rate: float
    filing_status: str = "single"
    hsa_contribution_limit: Optional[float] = None
    k401_employee_limit: Optional[float] = None
    k401_employer_match_rate: Optional[float] = None
