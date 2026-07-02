import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors anywhere in the tree so the app shows a
 * recovery screen instead of a blank white page. The most common cause is
 * corrupted or incompatible saved data, so we offer a one-click reset.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App crashed:", error, info);
  }

  handleReset = () => {
    try {
      localStorage.removeItem("household-finance-hub");
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  handleReload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-8 shadow-xl">
          <h1 className="text-xl font-semibold text-rose-300">Something went wrong</h1>
          <p className="mt-2 text-sm text-slate-300">
            The app hit an unexpected error while loading. This is usually caused by saved
            data from an older version. You can try reloading, or reset your saved data to
            start fresh.
          </p>
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-black/40 p-3 text-xs text-rose-200">
            {this.state.error.message}
          </pre>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={this.handleReload}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-slate-100 hover:bg-white/5"
            >
              Reload
            </button>
            <button
              onClick={this.handleReset}
              className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400"
            >
              Reset saved data
            </button>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Reset clears only this app's locally stored data in your browser.
          </p>
        </div>
      </div>
    );
  }
}
