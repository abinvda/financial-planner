"""Check when reference data was last updated."""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path
import json

REFERENCE_DIR = Path(__file__).resolve().parent.parent / "data" / "reference"


def main() -> None:
    threshold = datetime.utcnow() - timedelta(days=7)
    for file_name in ("fx_rates.json", "tax_tables.json"):
        path = REFERENCE_DIR / file_name
        if not path.exists():
            print(f"{file_name}: missing")
            continue
        payload = json.loads(path.read_text(encoding="utf-8"))
        retrieved_at = payload.get("retrieved_at")
        if not retrieved_at:
            print(f"{file_name}: no timestamp present")
            continue
        timestamp = datetime.fromisoformat(retrieved_at)
        status = "STALE" if timestamp < threshold else "fresh"
        print(f"{file_name}: {status} (last updated {timestamp.isoformat()})")


if __name__ == "__main__":
    main()
