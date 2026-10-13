"""Manual helper to ingest tax tables into SQLite (Module 5)."""
from __future__ import annotations

from pathlib import Path

from app import data_store

INPUT_PATH = Path(__file__).resolve().parent.parent / "data" / "inputs" / "tax_brackets.json"


def main() -> None:
    data_store.init_db()
    if not INPUT_PATH.exists():
        print(f"Create {INPUT_PATH} with your marginal brackets before running this script.")
        return
    print("TODO: Read JSON and upsert TaxProfile rows.")


if __name__ == "__main__":
    main()
