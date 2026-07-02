import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UIState {
  /** Currently selected user id; resolves to the first user if unset/invalid. */
  activeUserId: string;
  setActiveUser: (id: string) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set) => ({
      activeUserId: "",
      setActiveUser: (id) => set({ activeUserId: id }),
    }),
    { name: "hfh-ui" },
  ),
);
