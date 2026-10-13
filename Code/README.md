# Finance Decision Hub

Personal command center for juggling a USD-denominated lifestyle, an INR mortgage, and long-term savings decisions.

## Current Target Tabs
- **Tab 1 – Personal Budget & Emergency Fund:** ingest salary, recurring expenses, bonuses, account balances, and project runway + emergency-fund coverage.
- **Tab 2 – Loan vs. Investment Strategy:** compare aggressive INR loan prepayment against funding a 401(k) or parking cash in USD savings until FX rates are favorable.

## Current Stack at a Glance
| Layer | Choice | Why |
| --- | --- | --- |
| UI | Streamlit tabs | Quick Python-native visuals + editable tables |
| Services | Plain Python modules (`app/budget.py`, `app/loan.py`) | Keeps financial math testable outside the UI |
| Persistence | SQLite (`finance.db`) via thin helper | Single file, easy to back up, no server needed |
| Data processing | pandas, NumPy | Vectorized projections + amortization |
| Automation | Lightweight scripts in `scripts/` | Manual or scheduled runs without Celery |

See `docs/blueprint.md` + `docs/course.md` for the learning path and architectural rationale.

See `docs/blueprint.md` for the deep-dive architecture, assumptions, and question backlog.

## Directory Structure
```
Code/
├── app/                   # Core Python modules (models, data_store, budget, loan)
├── ui/
│   └── streamlit_app.py   # Two-tab Streamlit UI
├── data/
│   ├── reference/         # FX/tax JSON snapshots
│   └── inputs/            # Editable YAML/JSON assumptions (loan sheet, tax tables)
├── docs/                  # Blueprint + course materials
├── scripts/               # seed_data, run_budget_projection, fetch_fx, etc.
└── infra/                 # (future) automation/IaC experiments
```

## Suggested Next Steps
1. **Work through `docs/course.md` Module 0–1** to confirm assumptions and stand up `finance.db` + seed data.
2. **Implement the budget engine** (`app/budget.py`) and verify via `scripts/run_budget_projection.py`.
3. **Build the loan strategy simulator** (`app/loan.py`) with scenario comparisons + pytest coverage.
4. **Wire the Streamlit UI** so tables are editable and sync with SQLite.
5. **Add refresh scripts** for FX/tax data and the stale-data checker.

## Data & Integration Backlog
- U.S. federal & Michigan marginal tax tables (auto-ingest or manual JSON upload).
- 401(k) contribution limits (employee + employer) by tax year.
- USD ↔ INR FX feed with caching and manual override UI.
- Savings account APY + tax treatment assumptions.

## Documentation Map
- `docs/blueprint.md` – full architecture blueprint, domain model, scenario engine plan, and open questions.
- Future docs to add:
  - `docs/api-contract.md` – OpenAPI schema once endpoints are defined.
  - `docs/data-sources.md` – provenance of tax/FX datasets.
  - `docs/ux-wireframes/` – tab mockups (to be added).

The repo currently contains only scaffolding so you can evolve each slice incrementally without dragging along unfinished code.
