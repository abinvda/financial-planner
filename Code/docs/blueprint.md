# Finance Decision Hub – Architecture Blueprint

## Vision & Outcomes
- Give a single-pane view of day-to-day cash flow, emergency fund strength, and home-loan strategy trade-offs.
- Run quick simulations to see how bonuses, tax changes, FX swings, or investment choices influence net worth.
- Automate ingestion of data (bank balances, FX, tax brackets) so the manual input burden stays minimal.
- Keep the system extensible for future decision tabs (e.g., car purchase, kid's college planning).

## Personas & Usage Scenarios
| Persona | Motivation | Typical Actions |
| --- | --- | --- |
| Household CFO (you) | Reduce anxiety about liquidity vs. debt | Update salary/expense assumptions, monitor emergency fund coverage, compare strategies |
| Future collaborator (spouse/accountant) | Validate assumptions when major life events happen | Toggle scenarios, export reports, comment on assumptions |

## Scope by Tab
### Tab 1 – Personal Budget & Emergency Fund Tracker
- Capture recurring income (salary, RSUs, bonuses) with gross/net breakdown.
- Track expenses grouped by essentials vs. discretionary plus one-time big-ticket items.
- Model emergency-fund target (in months of expenses) vs. current balance trends.
- Show account balances (checking, HYSA, brokerage) and month-by-month projection using current burn rate and planned bonuses.
- Allow flexible bonus configuration (amount, payout month, frequency) and see projection impact.

### Tab 2 – Home Loan Repayment vs. Investment Strategy
- Store rupee loan parameters: outstanding principal, interest rate, EMI, prepayment penalties, FX exposure.
- Compare at least three strategies:
  1. Aggressive INR loan prepayment (USD → INR instantly).
  2. Invest surplus in 401(k) up to annual cap (adjust for tax-deferred contributions).
  3. Park cash in USD savings/HYSA until FX conditions are attractive, then lump-sum repay.
- Incorporate currency forecasts (optimistic/base/pessimistic) and show sensitivity.
- Blend in U.S. federal + Michigan marginal tax rates to compute after-tax yields on savings vs. opportunity cost of loan interest.

## Non-Functional Goals
- **Data reliability**: track input provenance (manual vs. API) and timestamps.
- **Scenario transparency**: every chart references the assumptions behind it.
- **Security**: secrets (API keys, bank exports) stay in `.env`/secret manager; no credentials in repo.
- **Portability**: run locally via Docker Compose; later deploy to a lightweight PaaS (Fly.io/Render).

## Recommended Tech Stack
| Layer | Choice | Notes |
| --- | --- | --- |
| Frontend | React + Vite + TypeScript, component lib (MUI or Chakra) | Tabbed layout, charts via Recharts/Visx, state via TanStack Query + Zustand |
| Backend API | FastAPI (Python 3.12) | Async endpoints, Pydantic models, integrates well with pandas for projections |
| Background jobs | APScheduler or Celery (with Redis) | Fetch FX/tax tables nightly, recompute projections |
| Data store | PostgreSQL (prod) + SQLite (dev) | Entities: incomes, expenses, accounts, loans, simulation runs |
| Analytics | pandas + NumPy | Scenario math, Monte Carlo for FX sensitivity |
| Infrastructure | Docker Compose dev stack; IaC via Terraform (infra/automation) | Future S3 bucket for exports |
| Auth | Auth0 or simple passwordless magic link (optional) | Since this is a personal tool, can start with local-only auth |

## High-Level Architecture Flow
1. **UI layer** submits data through a typed API client.
2. **API layer (FastAPI)** validates payloads, persists to DB, and queues recalculation jobs when assumptions change.
3. **Computation services** (BudgetService, LoanStrategyService, ScenarioEngine) crunch projections and cache outputs.
4. **External connectors** fetch FX rates (e.g., exchangerate.host), IRS + Michigan tax tables, and optionally bank exports.
5. **Result cache** (Redis/table) stores latest charts for fast reloads.

```
[React Tabs] → [FastAPI REST/GraphQL] → [Service layer] → [Postgres]
                                  ↘
                         [Background Jobs + External APIs]
```

## Domain & Data Model (initial)
| Entity | Key Fields | Relationships |
| --- | --- | --- |
| `IncomeStream` | name, currency, gross amount, cadence, taxable flag, bonus schedule | Linked to Scenario snapshots |
| `Expense` | category, amount, cadence, essential flag | Feeds emergency-fund calculation |
| `AccountBalance` | institution, type, currency, balance history | Used for projections and FX conversions |
| `EmergencyFundTarget` | months_of_expenses, current_balance, shortfall | Derived from expenses + accounts |
| `LoanProfile` | principal_in_inr, rate, EMI, remaining_tenure, fx_reference | Base for strategy comparisons |
| `StrategyScenario` | name, assumptions (JSON), outputs (NPV, payoff date) | Visualized on Tab 2 |
| `TaxProfile` | year, filing_status, marginal_rates, deductions | Applies to salary and savings yields |

## Tab Interactions
- Net cash flow from Tab 1 feeds the surplus input for Tab 2 strategy simulations.
- Loan EMI captured in Tab 2 can be mirrored as a recurring expense in Tab 1.
- Emergency-fund alerts can recommend whether surplus should stay liquid or can go toward loan/401k.

## External Data Connectors
| Data | Source Ideas | Handling |
| --- | --- | --- |
| USD→INR FX | exchangerate.host, AlphaVantage, FRED DEXINUS | Nightly pull with fallback manual override |
| Federal tax brackets | IRS published tables (scrape or static JSON) | Annual refresh, store by filing status |
| Michigan state tax | MI DoT PDF/HTML tables | Manual seed + watch for updates |
| 401(k) limits | IRS Notice 2024-75 etc. | Store by tax year |
| Savings APY | Bank API or manual input | Optional integration |

## Analytics & Scenario Engine
- Deterministic projection: hold salary, expenses, EMI constant; integrate bonuses and inflation assumptions.
- Scenario toggles: 
  - FX drift ±X% annually.
  - Bonus payout probabilities.
  - Adjusted salary growth/layoff risk.
- Strategy scoring metrics:
  - Time to zero loan balance.
  - Net-worth delta vs. baseline (after-tax) over N years.
  - Liquidity buffer impact (months of runway).
- Visualizations:
  - Stacked area chart for account balances.
  - Bar/line mix for comparing strategies.
  - Tornado chart for sensitivity (optional).

## Infrastructure & Dev Workflow
- **Repo layout**: separate `frontend` and `backend` folders, shared `.env.example` under root, `docs/` for specs, `infra/` for Terraform.
- **Dev tooling**: pre-commit hooks (ruff, black, eslint), Makefile or Invoke tasks.
- **Testing**: pytest for backend services, Vitest/React Testing Library for UI.
- **CI**: GitHub Actions to lint/test/publish Docker images.

## MVP Delivery Slices
1. Skeleton UI with tabs + mocked charts.
2. Backend CRUD for incomes/expenses + monthly projection engine.
3. Loan strategy simulator with manual FX assumption.
4. External data ingestion automation (FX + tax rates).
5. Quality-of-life: PDF/CSV export, scenario comparisons, notifications.

## Open Questions & Required Inputs
### Cross-cutting
- Preferred authentication (local-only vs. hosted) and sharing needs? - Local-only
- Budgeting granularity: monthly only or allow weekly/annual entries? - No weekly needed. But have provision of adding one-off expenses and I'd like to see how a particular expense affect the overall outcomes.
- Desired retention policy for historical data (all-time vs. last N years)? - All time
- Do you want automated bank connectors (Plaid) or manual CSV imports? - Why is this needed?
- Target deployment surface (local desktop app, LAN server, cloud)? - Local

### Tab 1 – Budget/Emergency Fund
- Salary structure details: base pay frequency, RSU/bonus cadence, pre-tax deductions. - base pay bi-monthly, bonus once a year in Feb (percentage of base pay), contributing max to 401k and HSA, not eligible for Roth IRA
- Employer 401(k) match and limits for both employee + employer contributions. - 100% match upto 6% + 4% additional
- Expense categorization preference (YNAB-style envelopes vs. free-form tags). - I've no idea what these mean.
- Minimum emergency-fund months you’re comfortable with; should it adapt by risk level? - 4 month
- Which account types to include (checking, brokerage, HSA, ESPP)? - All. I'd like to keep track of all of these.
- How should irregular expenses (vacations, repairs) be modeled—sinking funds or lump sums? - vacations can be a value I can enter as avg. amount per month. There can be n number of extra expenses that I should be allowed to add, e.g., dental work, supporting family expenses, etc.
- Need for household-level vs. individual-level tracking? - Both are the same for me.

### Tab 2 – Loan vs. Investment Strategy
- Complete Indian loan sheet: principal outstanding, interest type (fixed/floating), reset frequency, prepayment fees. - I'll give these details through a form. That should be part of the interface or the data (maybe create a text file where I can enter these)
- Bank rules on partial prepayment (minimum amount, number per year) - minimum amount equal to one EMI, no maximum number
- Expected USD→INR trigger level at which you’d convert savings to INR. - Not a level, just wanna understand how things will change when we assume a certain change in the FX rates.
- Projected annual INR inflation (affects real cost of loan) to include? - Should be able to enter in a text box or something.
- Savings account APY and whether interest is taxed at marginal rate or special treatment. - Marginal rate
- Current marginal tax brackets (federal + Michigan) and expected changes. - I can enter in a text file.
- 401(k) contribution strategy today; do you want to model Roth vs. traditional? - Help me understand. How does this work with company match.
- Time horizon for comparison (payoff ASAP vs. align with other goals?). - Few years

### Data Automation
- Are you comfortable providing API keys for FX/tax services, or should we rely on public/free endpoints? - Public free endpoints. What are these keys needed for?
- Should tax tables auto-update annually or prompt manual review first? - Manual
- Need notifications when assumptions go stale (e.g., FX > 7 days old)? Yes

## Next Steps Checklist
1. Confirm answers to open questions to finalize schemas.
2. Create detailed API contract (OpenAPI/JSON Schema).
3. Stand up FastAPI skeleton with health checks + stub endpoints.
4. Scaffold React UI with routing + shared layout.
5. Implement first end-to-end flow: capture income/expense → view projection chart.
