import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, PageHeader, Select, TextInput } from "../components/ui";
import { useStore } from "../store";
import { exportState } from "../store";
import { buildFinancialContext, SYSTEM_PROMPT } from "../lib/context";
import { listModels, streamChat, type ChatMessage } from "../lib/ollama";

type Status = "unknown" | "checking" | "online" | "offline";

const SUGGESTIONS = [
  "How much can I comfortably save every month?",
  "Should I do Roth or traditional while my income is still low?",
  "Will I still qualify for a direct Roth IRA after my income jumps?",
  "Is maxing the HSA worth it, and how much tax does it save?",
  "When can I reach Coast FIRE, and what changes if I save more?",
];

interface UIMessage {
  role: "user" | "assistant";
  content: string;
}

export default function Chat() {
  const state = useStore((s) => s);
  const llm = useStore((s) => s.settings.llm);
  const updateLLM = useStore((s) => s.updateLLM);

  const [status, setStatus] = useState<Status>("unknown");
  const [models, setModels] = useState<string[]>([]);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkConnection = async () => {
    setStatus("checking");
    setError(null);
    try {
      const list = await listModels(llm.baseUrl);
      setModels(list);
      setStatus("online");
      if (list.length && !list.includes(llm.model)) updateLLM({ model: list[0] });
    } catch {
      setStatus("offline");
    }
  };

  useEffect(() => {
    void checkConnection();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [llm.baseUrl]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setInput("");
    setError(null);

    const history: UIMessage[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    const context = buildFinancialContext(exportState(state));
    const payload: ChatMessage[] = [
      { role: "system", content: `${SYSTEM_PROMPT}\n\n---\n${context}` },
      ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    ];

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await streamChat(
        llm,
        payload,
        (chunk) => {
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: "assistant",
              content: next[next.length - 1].content + chunk,
            };
            return next;
          });
        },
        ctrl.signal,
      );
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setError(e instanceof Error ? e.message : "Chat request failed");
        setStatus("offline");
        setMessages((prev) => prev.slice(0, -1));
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  return (
    <div>
      <PageHeader
        title="Ask the AI"
        description="A local model answers questions grounded in each user's live numbers. Everything runs on your machine via Ollama."
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={status} />
            <Button variant="ghost" onClick={checkConnection}>Reconnect</Button>
          </div>
        }
      />

      {status === "offline" && (
        <Card className="mb-4 border-amber-500/30">
          <p className="text-sm font-medium text-amber-300">Can't reach Ollama at {llm.baseUrl}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-300">
            <li>Install Ollama from ollama.com, then run <code className="rounded bg-black/30 px-1">ollama pull {llm.model || "llama3.1"}</code>.</li>
            <li>Allow this page to reach it by starting Ollama with browser access, e.g. <code className="rounded bg-black/30 px-1">OLLAMA_ORIGINS=* ollama serve</code>.</li>
            <li>Confirm the endpoint in <Link to="/settings" className="text-indigo-300 underline">Settings</Link>, then hit Reconnect.</li>
          </ol>
        </Card>
      )}

      <Card className="flex h-[62vh] flex-col">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Model</span>
            {models.length > 0 ? (
              <Select value={llm.model} onChange={(e) => updateLLM({ model: e.target.value })} className="w-48">
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </Select>
            ) : (
              <Badge>{llm.model}</Badge>
            )}
          </div>
          {messages.length > 0 && (
            <Button variant="subtle" onClick={() => setMessages([])}>Clear chat</Button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="max-w-md text-sm text-slate-400">
                Ask anything about your users' budgets, tax-advantaged savings decisions, or retirement plan. The model sees a live snapshot of incomes, taxes, contributions, accounts and loans.
              </p>
              <div className="flex max-w-xl flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    disabled={status !== "online"}
                    className="rounded-full border border-[var(--color-border-subtle)] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/5 disabled:opacity-40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => <Bubble key={i} message={m} busy={busy && i === messages.length - 1} />)
          )}
        </div>

        {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}

        <form
          className="mt-3 flex items-center gap-2 border-t border-[var(--color-border-subtle)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <TextInput
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={status === "online" ? "Ask about savings, loans, taxes, scenarios..." : "Connect Ollama to start chatting"}
            disabled={status !== "online" || busy}
          />
          {busy ? (
            <Button variant="danger" onClick={stop}>Stop</Button>
          ) : (
            <Button type="submit" disabled={status !== "online" || !input.trim()}>Send</Button>
          )}
        </form>
      </Card>

      <p className="mt-3 text-xs text-slate-500">
        Conversations are not saved and never leave your machine. Answers are planning estimates, not financial or tax advice.
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { color: string; label: string }> = {
    unknown: { color: "#94a3b8", label: "Unknown" },
    checking: { color: "#f59e0b", label: "Checking..." },
    online: { color: "#34d399", label: "Ollama online" },
    offline: { color: "#f43f5e", label: "Offline" },
  };
  const { color, label } = map[status];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] px-2.5 py-1 text-xs text-slate-300">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Bubble({ message, busy }: { message: UIMessage; busy: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? "bg-indigo-500 text-white"
            : "border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] text-slate-200"
        }`}
      >
        {message.content || (busy ? "…" : "")}
        {busy && message.content && <span className="ml-0.5 inline-block animate-pulse">▊</span>}
      </div>
    </div>
  );
}
