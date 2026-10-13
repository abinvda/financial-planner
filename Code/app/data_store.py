"""Simple JSON-based data storage for the Finance Decision Hub.

Each user's data is stored in a single JSON file at data/users/<username>.json.
No database, no migrations, just plain files.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

# Path to user data directory
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "users"
DATA_DIR.mkdir(parents=True, exist_ok=True)

# Currently active user (default)
_current_user = "default"


def set_current_user(username: str) -> None:
    """Set the active user for all operations."""
    global _current_user
    _current_user = username


def get_current_user() -> str:
    """Get the currently active username."""
    return _current_user


def list_users() -> list[str]:
    """List all available users (JSON files in data/users/)."""
    return [f.stem for f in DATA_DIR.glob("*.json")]


def get_user_file(username: str | None = None) -> Path:
    """Get the path to a user's JSON file."""
    username = username or _current_user
    return DATA_DIR / f"{username}.json"


def load_user_data(username: str | None = None) -> dict[str, Any]:
    """
    Load a user's data from JSON.
    
    Returns a dict with keys: incomes, expenses, accounts, loan, tax
    """
    user_file = get_user_file(username)
    
    if not user_file.exists():
        # Return empty template
        return {
            "name": username or _current_user,
            "incomes": [],
            "expenses": [],
            "accounts": [],
            "loan": None,
            "tax": None,
        }
    
    with open(user_file, "r", encoding="utf-8") as f:
        return json.load(f)


def save_user_data(data: dict[str, Any], username: str | None = None) -> None:
    """Save a user's data to JSON."""
    user_file = get_user_file(username)
    
    with open(user_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


# ==================== Convenience Methods ====================

def list_incomes(username: str | None = None) -> list[dict]:
    """Return all income streams."""
    data = load_user_data(username)
    return data.get("incomes", [])


def save_incomes(incomes: list[dict], username: str | None = None) -> None:
    """Save income list."""
    data = load_user_data(username)
    data["incomes"] = incomes
    save_user_data(data, username)


def list_expenses(username: str | None = None) -> list[dict]:
    """Return all expenses."""
    data = load_user_data(username)
    return data.get("expenses", [])


def save_expenses(expenses: list[dict], username: str | None = None) -> None:
    """Save expense list."""
    data = load_user_data(username)
    data["expenses"] = expenses
    save_user_data(data, username)


def list_accounts(username: str | None = None) -> list[dict]:
    """Return all accounts."""
    data = load_user_data(username)
    return data.get("accounts", [])


def save_accounts(accounts: list[dict], username: str | None = None) -> None:
    """Save account list."""
    data = load_user_data(username)
    data["accounts"] = accounts
    save_user_data(data, username)


def get_loan(username: str | None = None) -> dict | None:
    """Get loan profile."""
    data = load_user_data(username)
    return data.get("loan")


def save_loan(loan: dict, username: str | None = None) -> None:
    """Save loan profile."""
    data = load_user_data(username)
    data["loan"] = loan
    save_user_data(data, username)


def get_tax(username: str | None = None) -> dict | None:
    """Get tax profile."""
    data = load_user_data(username)
    return data.get("tax")


def save_tax(tax: dict, username: str | None = None) -> None:
    """Save tax profile."""
    data = load_user_data(username)
    data["tax"] = tax
    save_user_data(data, username)
