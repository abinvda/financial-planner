# Frontend (React + Vite) Skeleton

Single-page app that surfaces the decision dashboards.

## Planned Structure
- `src/pages/`
  - `BudgetTab.tsx` – salary & expense inputs, emergency-fund tracker, projection charts.
  - `LoanStrategyTab.tsx` – loan assumptions, FX sliders, comparison charts.
- `src/components/`
  - Shared chart wrappers, KPI cards, forms, scenario toggles.
- `src/hooks/` *(to add)* – React Query data hooks + local-state store (Zustand).
- `src/utils/` *(to add)* – currency/number formatters, date helpers.
- `public/` – static assets, manifest, favicons.

## UI/UX Considerations
- Responsive tab layout with persistent summary header (monthly net cash flow, emergency-fund months, loan payoff ETA).
- Use MUI or Chakra for accessible components + theming.
- Visualization libraries: Recharts or Visx for projections, Nivo for sensitivity tornado charts.
- Embrace optimistic UI: when a user tweaks assumptions, update charts immediately while backend recomputes for confirmation.

## Data Flow Plan
1. Generate a typed API client from the FastAPI OpenAPI schema.
2. Use TanStack Query for caching + background refetch.
3. Store cross-tab assumptions in a dedicated Zustand store so both tabs stay in sync.
4. Provide import/export (JSON/CSV) for manual data entry when offline.

## Setup TODOs
- Initialize via `npm create vite@latest frontend -- --template react-ts` (once ready).
- Add ESLint + Prettier config aligned with backend lint rules.
- Write Storybook stories for critical components (cards, charts, forms).
