"""Quick test to verify data_store.py works."""
from app import data_store, models

# Initialize the database
data_store.init_db()

# Add a test income
test_income = models.IncomeStream(
    name="Base Salary",
    currency=models.Currency.USD,
    gross_amount=120000.0,
    cadence="bi-monthly",
    taxable=True,
)
saved_income = data_store.upsert_income(test_income)
print(f"✓ Saved income with ID: {saved_income.id}")

# List all incomes
incomes = data_store.list_incomes()
print(f"✓ Retrieved {len(incomes)} income(s):")
for inc in incomes:
    print(f"  - {inc.name}: ${inc.gross_amount} ({inc.cadence})")

# Add a test expense
test_expense = models.Expense(
    name="Rent",
    amount=2000.0,
    cadence="monthly",
    essential=True,
    category="housing",
)
saved_expense = data_store.upsert_expense(test_expense)
print(f"✓ Saved expense with ID: {saved_expense.id}")

# List all expenses
expenses = data_store.list_expenses()
print(f"✓ Retrieved {len(expenses)} expense(s):")
for exp in expenses:
    print(f"  - {exp.name}: ${exp.amount} ({exp.cadence})")

print("\n✅ All tests passed!")
