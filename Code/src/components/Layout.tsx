import { NavLink, Outlet } from "react-router-dom";
import type { ReactNode } from "react";
import { ScopeSwitcher } from "./ScopeSwitcher";
import { cn } from "./ui";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
}

const icon = (path: string) => (
  <svg
    viewBox="0 0 24 24"
    className="h-4.5 w-4.5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    width="18"
    height="18"
  >
    <path d={path} />
  </svg>
);

const NAV: NavItem[] = [
  { to: "/", label: "Overview", icon: icon("M3 12l9-9 9 9M5 10v10h5v-6h4v6h5V10") },
  { to: "/budget", label: "Budget", icon: icon("M4 5h16M4 12h16M4 19h10") },
  { to: "/decisions", label: "Decisions", icon: icon("M9 3v4M9 3H5v4h4M9 3h6v4M15 3v18M9 7v14m0 0H5v-4h4m0 4h6v-4M19 7h-4v4h4V7z") },
  { to: "/roth-vs-traditional", label: "Roth vs Trad", icon: icon("M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6") },
  { to: "/retirement", label: "Retirement", icon: icon("M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6") },
  { to: "/student-loan", label: "Student Loan", icon: icon("M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1 3 3 6 3s6-2 6-3v-5M22 10v6") },
  { to: "/chat", label: "AI Chat", icon: icon("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z") },
  { to: "/settings", label: "Settings", icon: icon("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a7.9 7.9 0 0 0 .1-3l2-1.5-2-3.5-2.4 1a8 8 0 0 0-2.6-1.5L14 0h-4l-.5 2.5A8 8 0 0 0 7 4l-2.4-1-2 3.5L4.5 8a7.9 7.9 0 0 0 0 3l-2 1.5 2 3.5 2.5-1A8 8 0 0 0 9.5 22L10 24h4l.5-2a8 8 0 0 0 2.6-1.5l2.4 1 2-3.5z") },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col gap-5 border-r border-[var(--color-border-subtle)] bg-[var(--color-surface)]/60 p-4 backdrop-blur">
        <div className="px-2 pt-2">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 text-base font-bold text-white">
              ₴
            </div>
            <div>
              <p className="text-sm font-bold leading-tight text-slate-50">
                Finance Hub
              </p>
              <p className="text-[11px] text-slate-400">Personal planning</p>
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1.5 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            User
          </p>
          <ScopeSwitcher />
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-indigo-500/15 text-indigo-200"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200",
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        <p className="px-2 text-[10px] leading-relaxed text-slate-600">
          Runs entirely in your browser. Data stays local. Planning estimates only,
          not financial or tax advice.
        </p>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-8 md:px-10">
        <div className="mx-auto max-w-6xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
