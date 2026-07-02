"""Placeholder script for refreshing FX rates (Module 5)."""
from __future__ import annotations

from pathlib import Path
from datetime import datetime
import json

REFERENCE_PATH = Path(__file__).resolve().parent.parent / "data" / "reference" / "fx_rates.json"


def main() -> None:
    REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    stub_payload = {"USD_INR": 0.0, "retrieved_at": datetime.utcnow().isoformat()}
    REFERENCE_PATH.write_text(json.dumps(stub_payload, indent=2), encoding="utf-8")
    print("FX placeholder data updated.")


if __name__ == "__main__":
    main()
