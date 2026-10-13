# Backend (FastAPI) Skeleton

Planned Python service that powers budgeting logic, loan strategy simulations, and background data refreshes.

## Modules (future)
- `app/api/` – FastAPI routers grouped by domain (budget, loan, reference data).
- `app/services/` – pure-python calculation engines (BudgetService, LoanStrategyService, TaxService, FXService).
- `app/models/` (to be created) – SQLModel/SQLAlchemy entities + Pydantic schemas.
- `app/core/` (to be created) – settings, logging, dependency injection helpers.
- `app/integrations/` (optional) – HTTP clients for FX/tax providers.
- `tests/` – pytest suites (unit + integration) focused on deterministic financial math.

## Roadmap
1. Initialize `pyproject.toml` with FastAPI, Uvicorn, SQLModel, Pydantic, and pandas.
2. Wire Alembic migrations for Postgres + SQLite dev mode.
3. Build service layer with clear contracts so projections are testable independently of the API.
4. Add background scheduler (APScheduler/Celery) for FX + tax data ingestion.
5. Expose OpenAPI docs and generate typed client for the frontend.

## Configuration TODOs
- `.env.example` with DB URL, FX API keys, IRS data source toggles.
- Settings module that reads env vars and exposes typed config objects.
- Logging format tuned for financial audit trails (input assumptions, outputs, timestamps).
