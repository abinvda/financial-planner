# Household Finance Hub

A private, offline-friendly budgeting and decision app. It keeps budgeting simple,
turns the big tax-advantaged-savings questions into verifiable, numbers-first
answers, and plans your path to retirement (FIRE / Coast FIRE) - backed by an AI
chat that runs on a **local** LLM (Ollama).

Everything runs in your browser. Your data is stored locally and never uploaded.
The same build runs on your machine and on a static host like GitHub Pages.

The app treats each person as an independent **single filer** and ships with a
sample user you can edit or replace:

- **John** — lower income today with a planned pay jump in a few years. That
  temporary low bracket is exactly when Roth contributions and a direct Roth IRA
  are most valuable.

A second sample user (**Jane**) ships **hidden**; unhide her any time under
**Settings -> Users**. Switch the active user in the left sidebar; each has an
independent budget, decisions and retirement plan.

Every tab reads from the same live data, so a change in one place (income, an
account balance, an assumption) instantly flows into the others.

## Features

- **Budget** - a clean, readable view of where each paycheck goes (taxes, savings,
  take-home) and monthly cash flow (take-home minus spending equals what's left to
  save). Editable income, pre-tax contributions + employer match, expenses, and
  loan/debt payments.
- **Decisions** - verifiable calculators, each showing its full math and a
  plain-English explanation, using **2026** limits and brackets:
  - **Rate now vs. later** - for someone with a future pay jump, a side-by-side of
    today's marginal rate and Roth-IRA eligibility vs. the future stage, with a
    clear recommendation.
  - **Roth vs. Traditional 401(k)/403(b)** - which wins given your tax rate now vs.
    in retirement.
  - **Roth IRA** - whether you should contribute, your income phase-out limit, the
    tax-free advantage, and the backdoor Roth note if you're over the limit.
  - **Max the HSA?** - the upfront tax (and FICA) savings and the long-run
    triple-tax-free advantage.
- **Retirement** - your **FIRE number** (spending ÷ safe-withdrawal rate), your
  **Coast FIRE** target (what you'd need invested today to coast to FIRE without
  saving another dollar), time to financial independence, and a trajectory chart.
  It reads your savings capacity from the Budget and your balances from the
  Investments list, and models a future income ramp when a career stage is set.
- **AI Chat** - ask budgeting, decision, or retirement questions; a local Ollama
  model answers using a live snapshot of each user's numbers, quantifies with your
  figures, and shows the reasoning.
- **Settings & Data** - tax profile (brackets, filing status, state), currency,
  user management (including show/hide), a Roth vs. traditional primer, and JSON
  export/import.

Every calculation lives in a small, unit-tested engine (`src/engine/`) so the
numbers are transparent and reproducible.

## Tech stack

React + Vite + TypeScript, Tailwind CSS, React Router, Zustand (persisted to
`localStorage`), and Vitest. Charts are lightweight inline SVG. No backend, no
database, no server.

## Run locally

Requires Node 20+.

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check + production build into dist/
npm run preview  # serve the production build locally
npm test         # run the finance-engine unit tests
```

## Enable the AI chat (local Ollama)

The chat uses a local model so nothing leaves your machine.

1. Install Ollama from [ollama.com](https://ollama.com) and pull a model:

   ```bash
   ollama pull llama3.1
   ```

2. Start Ollama so the web page is allowed to call it. Browsers block cross-origin
   requests by default, so set `OLLAMA_ORIGINS`:

   ```bash
   OLLAMA_ORIGINS=* ollama serve
   ```

   (For a tighter policy, set it to the exact origin, e.g.
   `OLLAMA_ORIGINS=http://localhost:5173` locally or your GitHub Pages URL.)

3. Open the app, go to **AI Chat**, and it will connect to
   `http://localhost:11434` by default. Change the endpoint/model in **Settings**.

Notes:

- When the app is hosted over HTTPS (e.g. GitHub Pages), browsers still permit
  requests to `http://localhost`, so a locally running Ollama works from the hosted
  page too - as long as Ollama is running on the same machine as the browser.
- If the chat says "offline", it just means it can't reach Ollama; the rest of the
  app works fully without it.

## Deploy to GitHub Pages

A workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds
the app and publishes it to GitHub Pages on every push to `main`.

1. Push this repository to GitHub.
2. In the repo, go to **Settings -> Pages** and set **Source** to **GitHub Actions**.
3. Push to `main`. The action builds and deploys automatically.

The Vite `base` is set to `"./"` (relative), and routing uses `HashRouter`, so the
app works from any subpath (`https://<user>.github.io/<repo>/`) without extra config
or 404 redirects.

## Data & privacy

- All data lives in your browser's `localStorage` under the `household-finance-hub`
  key. Nothing is sent to any server.
- Use **Settings -> Export JSON** to back up or move your data to another device,
  and **Import JSON** to restore it.
- **Reset to sample data** restores the original placeholders.

## Project structure

```
src/
  engine/        # Pure financial math (tax, budget, decisions, retirement) + unit tests
  lib/           # Seed data, tax tables, utilities, Ollama client, AI context builder
  components/    # Layout, user switcher, charts, shared UI primitives
  pages/         # Budget, Decisions, Retirement, Chat, Settings
  store.ts       # Persisted state + migrations (Zustand)
  types.ts       # Domain model
Code/            # Legacy Python/Streamlit prototype kept only for reference
```

## Disclaimer

This is a planning tool. Tax calculations are simplified approximations (2026
federal brackets and standard deduction, flat state rate, FICA) and contribution
limits are for planning only - not tax or financial advice. Verify important
decisions with a qualified professional.
