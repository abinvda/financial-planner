"""Quick script to update a single expense."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app import data_store, models


def update_expense(name: str, new_amount: float) -> None:
    """
    Find an expense by name and update its amount.
    
    Args:
        name: The expense name (e.g., "Mortgage")
        new_amount: The new monthly amount
    """
    expenses = data_store.list_expenses()
    
    # Find the expense
    found = None
    for exp in expenses:
        if exp.name.lower() == name.lower():
            found = exp
            break
    
    if not found:
        print(f"❌ Expense '{name}' not found.")
        print("Available expenses:")
        for exp in expenses:
            print(f"  - {exp.name}: ${exp.amount}")
        return
    
    # Update it
    found.amount = new_amount
    data_store.upsert_expense(found)
    print(f"✓ Updated '{found.name}' to ${new_amount:.2f}/month")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python update_expense.py <expense_name> <new_amount>")
        print("Example: python update_expense.py Mortgage 2500")
        sys.exit(1)
    
    name = sys.argv[1]
    amount = float(sys.argv[2])
    update_expense(name, amount)
