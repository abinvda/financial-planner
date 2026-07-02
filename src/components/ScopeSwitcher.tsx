import { useUsers, useActiveUser } from "../hooks";
import { useUI } from "../ui";
import { cn } from "./ui";

export function ScopeSwitcher() {
  const users = useUsers();
  const active = useActiveUser();
  const setActiveUser = useUI((s) => s.setActiveUser);

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-canvas)]/50 p-1">
      <div className="flex flex-col gap-1">
        {users.map((u) => {
          const isActive = u.id === active?.id;
          return (
            <button
              key={u.id}
              onClick={() => setActiveUser(u.id)}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition",
                isActive
                  ? "bg-white/10 font-semibold text-slate-50"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
              )}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: u.color }}
              />
              {u.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
