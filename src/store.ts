import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Account,
  AppSettings,
  Expense,
  HouseholdState,
  IncomeStream,
  LLMSettings,
  Loan,
  Member,
  ScenarioEvent,
  TaxProfile,
} from "./types";
import { DEFAULT_RETIREMENT } from "./types";
import { makeSeedState, SCHEMA_VERSION } from "./lib/seed";
import {
  FEDERAL_BRACKETS,
  STANDARD_DEDUCTION,
  SS_WAGE_BASE,
  TAX_YEAR,
} from "./lib/taxTables";

type ListKey = "incomes" | "expenses" | "accounts" | "loans";
type ListItem = IncomeStream | Expense | Account | Loan;

interface Actions {
  resetToSeed: () => void;
  replaceAll: (state: HouseholdState) => void;

  updateMember: (memberId: string, patch: Partial<Member>) => void;

  addItem: <K extends ListKey>(
    memberId: string,
    key: K,
    item: NonNullable<Member[K]>[number],
  ) => void;
  updateItem: <K extends ListKey>(
    memberId: string,
    key: K,
    itemId: string,
    patch: Partial<NonNullable<Member[K]>[number]>,
  ) => void;
  removeItem: (memberId: string, key: ListKey, itemId: string) => void;

  updateTax: (patch: Partial<TaxProfile>) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  updateLLM: (patch: Partial<LLMSettings>) => void;

  addScenario: (event: ScenarioEvent) => void;
  updateScenario: (id: string, patch: Partial<ScenarioEvent>) => void;
  removeScenario: (id: string) => void;
}

export type Store = HouseholdState & Actions;

function mapMembers(
  members: Member[],
  memberId: string,
  fn: (m: Member) => Member,
): Member[] {
  return members.map((m) => (m.id === memberId ? fn(m) : m));
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      ...makeSeedState(),

      resetToSeed: () => set(() => ({ ...makeSeedState() })),

      replaceAll: (state) =>
        set(() => ({
          members: state.members,
          tax: state.tax,
          settings: state.settings,
          scenarios: state.scenarios ?? [],
        })),

      updateMember: (memberId, patch) =>
        set((s) => ({
          members: mapMembers(s.members, memberId, (m) => ({ ...m, ...patch })),
        })),

      addItem: (memberId, key, item) =>
        set((s) => ({
          members: mapMembers(s.members, memberId, (m) => ({
            ...m,
            [key]: [...(m[key] as ListItem[]), item],
          })),
        })),

      updateItem: (memberId, key, itemId, patch) =>
        set((s) => ({
          members: mapMembers(s.members, memberId, (m) => ({
            ...m,
            [key]: (m[key] as ListItem[]).map((it) =>
              it.id === itemId ? { ...it, ...patch } : it,
            ),
          })),
        })),

      removeItem: (memberId, key, itemId) =>
        set((s) => ({
          members: mapMembers(s.members, memberId, (m) => ({
            ...m,
            [key]: (m[key] as ListItem[]).filter((it) => it.id !== itemId),
          })),
        })),

      updateTax: (patch) => set((s) => ({ tax: { ...s.tax, ...patch } })),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      updateLLM: (patch) =>
        set((s) => ({
          settings: { ...s.settings, llm: { ...s.settings.llm, ...patch } },
        })),

      addScenario: (event) =>
        set((s) => ({ scenarios: [...s.scenarios, event] })),

      updateScenario: (id, patch) =>
        set((s) => ({
          scenarios: s.scenarios.map((e) =>
            e.id === id ? { ...e, ...patch } : e,
          ),
        })),

      removeScenario: (id) =>
        set((s) => ({ scenarios: s.scenarios.filter((e) => e.id !== id) })),
    }),
    {
      name: "household-finance-hub",
      version: SCHEMA_VERSION,
      migrate: (persisted, version) => migrateState(persisted, version),
    },
  ),
);

/** Guarantees a member has every field the app reads, so a partial/legacy
 * record from an older schema can't crash a render. */
function normalizeMember(raw: unknown, seedMember: Member): Member {
  const m = (raw && typeof raw === "object" ? raw : {}) as Partial<Member>;
  const asArray = <T>(v: unknown, fallback: T[]): T[] =>
    Array.isArray(v) ? (v as T[]) : fallback;
  return {
    ...seedMember,
    ...m,
    incomes: asArray(m.incomes, []),
    expenses: asArray(m.expenses, []),
    accounts: asArray(m.accounts, []),
    loans: asArray(m.loans, []),
    deductions: { ...seedMember.deductions, ...(m.deductions ?? {}) },
    retirement: { ...DEFAULT_RETIREMENT, ...(m.retirement ?? {}) },
  };
}

/**
 * Upgrades older persisted data in-place: single-filer 2026 tax model,
 * Kirti → Shweta, Karan hidden, and retirement defaults for everyone. Users'
 * incomes/expenses/accounts/loans are preserved. Any malformed data falls
 * back to the seed rather than crashing the app with a blank screen.
 */
function migrateState(persisted: unknown, version: number): HouseholdState {
  try {
    return migrateStateUnsafe(persisted, version);
  } catch (err) {
    console.error("Failed to migrate saved data; resetting to defaults.", err);
    return makeSeedState();
  }
}

function migrateStateUnsafe(persisted: unknown, _version: number): HouseholdState {
  if (!persisted || typeof persisted !== "object") return makeSeedState();
  const seed = makeSeedState();
  const state = persisted as Partial<HouseholdState>;
  const seedByIndex = (i: number) => seed.members[i] ?? seed.members[0];

  const filingStatus = "single" as const;
  const tax: TaxProfile = {
    ...seed.tax,
    ...(state.tax ?? {}),
    year: TAX_YEAR,
    filingStatus,
    standardDeduction: STANDARD_DEDUCTION[filingStatus],
    federalBrackets: FEDERAL_BRACKETS[filingStatus],
    ssWageBase: SS_WAGE_BASE,
  };

  const rawMembers = Array.isArray(state.members) && state.members.length
    ? state.members
    : seed.members;

  const members: Member[] = rawMembers.map((raw, i) => {
    const next = normalizeMember(raw, seedByIndex(i));
    if (next.id === "kirti" || next.id === "shweta" || next.name === "Kirti") {
      next.name = "Shweta";
      next.hidden = false;
      if (!next.futureStage) {
        next.futureStage = {
          label: "Attending physician",
          annualGrossUsd: 285000,
          startInYears: 3,
        };
      }
      if (next.cityTaxRatePct == null) {
        next.cityTaxRatePct = 1.2;
        next.cityTaxLabel = "Detroit city tax (non-resident 1.2%)";
      }
      if (next.deductions.iraAnnual == null) {
        next.deductions = { ...next.deductions, iraAnnual: 7000, iraType: "roth" };
      }
    }
    if (next.id === "karan" || next.name === "Karan") next.hidden = true;
    return next;
  });

  return {
    members: members.length ? members : seed.members,
    tax,
    settings: { ...seed.settings, ...(state.settings ?? {}) },
    scenarios: Array.isArray(state.scenarios) ? state.scenarios : [],
  };
}

/** Serialize just the data (no actions) for JSON export. */
export function exportState(s: Store): HouseholdState {
  return {
    members: s.members,
    tax: s.tax,
    settings: s.settings,
    scenarios: s.scenarios,
  };
}
