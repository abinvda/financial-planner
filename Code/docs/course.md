# Finance Decision Hub – Mini-Course (10 Hours)

Structured learning path to build your multi-tab finance decision tool while understanding **why** each architectural choice exists. Work through the modules sequentially; each one blends theory, reasoning, and exercises. Expect ~10 total hours including quizzes and hands-on builds.

### Simplified Architecture You’ll Build
- **Python services only** – projections and strategies live in `app/budget.py` and `app/loan.py`.
- **SQLite for persistence** – a single `finance.db` file plus a tiny `app/data_store.py` helper.
- **Streamlit UI** – two tabs that read/write tables (using `st.data_editor`) so you can edit rows and push changes back to SQLite.
- **JSON reference data** – FX/tax tables live under `data/reference/` until you fetch new ones via automation scripts.

No FastAPI, React, Docker, or background workers are required in this version, so every artifact stays approachable.

---
## Module Overview
| Module | Time | Focus | Key Artifacts |
| --- | --- | --- | --- |
| 0. Orientation | 0.5 h | Goals + simplified Python/SQLite/Streamlit stack | Architecture sketch & notes |
| 1. Domain Modeling & Storage | 2 h | Pydantic + SQLModel schemas, seed SQLite | `app/models.py`, `finance.db`, seed script |
| 2. Budget Engine | 2 h | Cash-flow math, emergency-fund logic, pandas projections | `app/budget.py`, CLI tester |
| 3. Loan vs Investment Simulator | 2.5 h | Amortization, FX scenarios, after-tax returns | `app/loan.py` + pytest cases |
| 4. Streamlit UI & Editable Tables | 2 h | Two tabs, inline table editing synced to SQLite | `ui/streamlit_app.py` |
| 5. Automation & Quality Loops | 1 h | FX/tax refresh scripts, stale-data reminders | `scripts/fetch_fx.py`, `scripts/stale_checker.py` |

> **Tip:** Keep a learning journal (Bullets per module) noting what resonated, open questions, and quiz answers.

---
## Module 0 – Orientation & Architecture (0.5 h)
**Why these tools now?**
- *pandas/NumPy* for deterministic projections.
- *SQLModel + SQLite* for a single-file database you can inspect easily.
- *Streamlit* for a quick UI that still supports rich tables and charts.
- *Plain scripts* for automation so you’re never locked into hidden schedulers.

**Lesson Flow**
1. Read `README.md` + `docs/blueprint.md` (15 min) – highlight where the simplified stack is called out.
2. Repo scavenger hunt (10 min): find `app/`, `ui/`, `data/`, `scripts/`. Write down what lives in each.
3. Reflect (5 min): 3 reasons keeping data in SQLite beats editing numbers directly in Python files.

**Quiz**
- Q1: Name two ways Tab 1 data influences Tab 2 strategies.
- Q2: Why is SQLite + `st.data_editor` a safer workflow than hardcoding values?

**Checkpoint Output**: a short note in `docs/notes.md` summarizing answers and any worries.

---
## Module 1 – Domain Modeling & Storage (2 h)
**Objectives**
- Translate financial concepts into typed models that double as SQL tables.
- Seed SQLite with your current salary, expenses, accounts, and loan profile.

**Steps**
1. Review blueprint “Domain & Data Model” table (10 min).
2. Create `app/models.py` with SQLModel/Pydantic classes: `IncomeStream`, `Expense`, `Account`, `LoanProfile`, `TaxProfile`. (45 min)
3. Write `app/data_store.py` that opens `finance.db`, creates tables, and exposes helpers such as `list_incomes()`, `upsert_expense()`. (25 min)
4. Seed script: `scripts/seed_data.py` reads a JSON/YAML file (or prompts) and inserts starter rows. (20 min)
5. Quiz (10 min):
   - “How would you store a one-off dental bill versus a recurring expense?”
   - “What does `nullable=False` protect you from in this context?”

**Deliverable**: `finance.db` with your real data + helper functions.

---
## Module 2 – Budget Projection Engine (2 h)
**Why Pandas?** Vector math makes 24-month projections trivial once the data is in DataFrames.

**Steps**
1. Draft contract for `BudgetService` in `app/budget.py` (inputs pulled from `data_store`, outputs a `DataFrame` with monthly runway + emergency-fund delta). (20 min)
2. Implement projection assuming constant salary/expense with configurable bonus timing. (45 min)
3. Exercise: add emergency-fund shortfall calculation (target months vs. actual) and annotate the DataFrame. (20 min)
4. CLI harness `scripts/run_budget_projection.py` prints summary tables for manual tests. (20 min)
5. Quiz/discussion (15 min):
   - “How does changing bonus timing shift the projection line?”
   - “What loan data should flow back in as expenses?”

**Deliverable**: Functioning service + CLI output stored in `docs/artifacts/module2.md`.

---
## Module 3 – Loan vs Investment Strategy Simulator (2.5 h)
**Reasoning for choices**
- Keeping amortization + FX math in `app/loan.py` means the Streamlit tab stays thin.
- Config-driven scenarios let you compare “prepay vs 401(k) vs HYSA” using the same engine.

**Steps**
1. Map out loan/investment questions (15 min). Reference `docs/blueprint.md` Tab 2 section.
2. Build amortization helper producing month-by-month balances with INR inflation adjustments. (35 min)
3. Implement strategy comparison functions:
   - Aggressive INR prepay.
   - 401(k)-first (respect IRS limit + employer match).
   - Liquidity-first (HYSA until FX shift). (60 min)
4. Include FX drift scenarios (optimistic/base/pessimistic) and marginal-tax adjustments on savings interest. (20 min)
5. Tests: parameterized pytest cases verifying payoff time + net worth deltas. (20 min)
6. Quiz (15 min):
   - “If INR depreciates faster than expected, which strategy benefits most and why?”
   - “How do tax rates alter the after-tax yield on savings?”

**Deliverable**: `app/loan.py` + tests with scenario fixtures.

---
## Module 4 – Streamlit UI & Editable Tables (2 h)
**Why this matters**
- You stay entirely in Python yet gain a UI that lets you edit assumptions without touching code.
- `st.data_editor` (or `st.dataframe` + custom buttons) keeps SQLite in sync when you change rows.

**Steps**
1. Create `ui/streamlit_app.py` with two tabs: “Budget & Emergency Fund” and “Loan Strategy”. (20 min)
2. Tab 1: display incomes/expenses/accounts pulled from SQLite via `data_store`, plus projection charts from `BudgetService`. Add an editable table (`st.data_editor`). On save, write changes back with `upsert_*` helpers. (40 min)
3. Tab 2: show loan profile + strategy comparison chart. Provide forms for INR inflation, FX scenarios, and run button to refresh outputs. (30 min)
4. Add toast/notice when reference data (FX/tax tables) is older than 7 days by checking timestamps stored in SQLite. (15 min)
5. Quiz (15 min):
   - “How do you prevent partially edited rows from saving incorrect data?”
   - “Why is it still useful to keep computation logic outside the Streamlit file?”

**Deliverable**: Streamlit app screenshot + a short note describing the edit-save workflow.

---
## Module 5 – Automation & Quality Loops (1 h)
**Goal**: Keep your assumptions current without over-engineering.

**Steps**
1. Write `scripts/fetch_fx.py` that hits a public API (or logs instructions) and updates `data/reference/fx_rates.json`, recording `retrieved_at`. (20 min)
2. Write `scripts/fetch_tax_tables.py` (or manual placeholder) to import your marginal brackets from a text/CSV file into SQLite. (15 min)
3. Add `scripts/stale_checker.py` that checks timestamps and prints/alerts when FX or tax data is older than 7 days. (10 min)
4. Quiz (15 min):
   - “Why keep manual approval before applying new tax tables?”
   - “How could you run these scripts weekly without leaving your laptop on?”

**Deliverable**: Script stubs with docstrings + sample output pasted into `docs/artifacts/module5.md`.

---
## Capstone & Reflection (Optional 0.5 h)
- Write a summary in `docs/notes.md` answering:
  - Biggest takeaway from each module.
  - One improvement you’d make if you had 5 more hours.
- Self-assessment quiz:
  - “Explain the data flow when you tweak a bonus amount from the UI.”
  - “List 3 safeguards to keep your financial assumptions trustworthy.”

---
## How to Use This Course
1. Block calendar chunks matching module durations.
2. For each module: read objectives → do lessons → complete hands-on tasks → answer quiz.
3. Store answers/artifacts under `docs/artifacts/` (create folder) to track progress.
4. When stuck, log questions for future clarification.

**Next Instructor Step:** Once you complete Module 0, ping me with your quiz answers and any blockers; I’ll adapt the next lessons or deepen dives as needed.
