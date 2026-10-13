import { useMemo } from "react";
import { useStore } from "./store";
import { useUI } from "./ui";
import type { Member } from "./types";
import { computeMemberSummary, type MemberSummary } from "./engine";

/** All visible users in the app (hidden users are excluded). */
export function useUsers(): Member[] {
  const members = useStore((s) => s.members);
  return useMemo(() => members.filter((m) => !m.hidden), [members]);
}

/** Map legacy sample-user ids saved in the UI store before the John/Jane rename. */
const LEGACY_USER_IDS: Record<string, string> = {
  kirti: "john",
  shweta: "john",
  karan: "jane",
};

/** The currently selected user (falls back to the first visible user). */
export function useActiveUser(): Member {
  const members = useStore((s) => s.members);
  const activeUserId = useUI((s) => s.activeUserId);
  return useMemo(() => {
    const visible = members.filter((m) => !m.hidden);
    const pool = visible.length ? visible : members;
    const resolvedId = LEGACY_USER_IDS[activeUserId] ?? activeUserId;
    return pool.find((m) => m.id === resolvedId) ?? pool[0];
  }, [members, activeUserId]);
}

/** Computed budget/tax summary for the active user. */
export function useActiveSummary(): MemberSummary {
  const user = useActiveUser();
  const tax = useStore((s) => s.tax);
  const fx = useStore((s) => s.settings.usdInrFxRate);
  return useMemo(
    () => computeMemberSummary(user, tax, fx),
    [user, tax, fx],
  );
}

/**
 * Summary for the active user's future career stage (e.g. attending salary),
 * or null if none is set. Same expenses/deductions, higher income — used to
 * show how a future pay jump changes tax rate and saving capacity.
 */
export function useFutureSummary(): MemberSummary | null {
  const user = useActiveUser();
  const tax = useStore((s) => s.tax);
  const fx = useStore((s) => s.settings.usdInrFxRate);
  return useMemo(() => {
    if (!user.futureStage) return null;
    const future: Member = {
      ...user,
      incomes: [
        {
          id: "future-stage",
          name: user.futureStage.label,
          annualGross: user.futureStage.annualGrossUsd,
          currency: "USD",
          taxable: true,
          payout: "monthly",
        },
      ],
    };
    return computeMemberSummary(future, tax, fx);
  }, [user, tax, fx]);
}
