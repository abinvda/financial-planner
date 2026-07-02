import { useRef, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Field,
  NumberInput,
  PageHeader,
  Select,
  TextInput,
} from "../components/ui";
import { useStore, exportState } from "../store";
import {
  FILING_STATUS_LABELS,
  LIMIT_401K_EMPLOYEE,
  LIMIT_HSA_FAMILY,
} from "../lib/taxTables";
import { formatUsd, uid } from "../lib/util";
import { DEFAULT_RETIREMENT, type HouseholdState } from "../types";

const MEMBER_COLORS = ["#818cf8", "#f472b6", "#34d399", "#f59e0b", "#22d3ee", "#a78bfa"];

export default function Settings() {
  const store = useStore((s) => s);
  const settings = useStore((s) => s.settings);
  const tax = useStore((s) => s.tax);
  const members = useStore((s) => s.members);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateLLM = useStore((s) => s.updateLLM);
  const updateTax = useStore((s) => s.updateTax);
  const updateMember = useStore((s) => s.updateMember);
  const resetToSeed = useStore((s) => s.resetToSeed);
  const replaceAll = useStore((s) => s.replaceAll);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const doExport = () => {
    const data = exportState(store);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finance-hub-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<HouseholdState>;
      if (!parsed.members || !parsed.tax || !parsed.settings) {
        throw new Error("File is missing members/tax/settings.");
      }
      replaceAll(parsed as HouseholdState);
      setImportMsg("Imported successfully.");
    } catch (e) {
      setImportMsg(`Import failed: ${e instanceof Error ? e.message : "invalid file"}`);
    }
  };

  const addMember = () => {
    const id = uid("member");
    replaceAll({
      ...exportState(store),
      members: [
        ...members,
        {
          id,
          name: "New user",
          color: MEMBER_COLORS[members.length % MEMBER_COLORS.length],
          notes: "",
          incomes: [],
          deductions: { retirementAnnual: 0, retirementType: "traditional", iraAnnual: 0, iraType: "roth", hsaAnnual: 0, employerMatchPct: 0 },
          expenses: [],
          accounts: [],
          loans: [],
          retirement: { ...DEFAULT_RETIREMENT },
        },
      ],
    });
  };

  const removeMember = (id: string) => {
    if (members.length <= 1) return;
    replaceAll({ ...exportState(store), members: members.filter((m) => m.id !== id) });
  };

  return (
    <div>
      <PageHeader
        title="Settings & data"
        description="Assumptions, the local AI connection, and full control over your data. Nothing is uploaded anywhere."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Currency" subtitle="Used to convert any INR income or loan payments into USD.">
          <Field label="INR per 1 USD">
            <NumberInput step={1} value={settings.usdInrFxRate} onChange={(e) => updateSettings({ usdInrFxRate: Math.max(1, +e.target.value) })} />
          </Field>
        </Card>

        <Card title="Local AI (Ollama)" subtitle="The chat talks to this endpoint from your browser.">
          <div className="grid grid-cols-1 gap-4">
            <Field label="Base URL">
              <TextInput value={settings.llm.baseUrl} onChange={(e) => updateLLM({ baseUrl: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Model" hint="e.g. llama3.1, llama3.2, mistral">
                <TextInput value={settings.llm.model} onChange={(e) => updateLLM({ model: e.target.value })} />
              </Field>
              <Field label="Temperature">
                <NumberInput step="0.1" value={settings.llm.temperature} onChange={(e) => updateLLM({ temperature: +e.target.value })} />
              </Field>
            </div>
            <p className="text-xs text-slate-500">
              Start Ollama with browser access: <code className="rounded bg-black/30 px-1">OLLAMA_ORIGINS=* ollama serve</code>
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4" title="Tax profile" subtitle="Approximate US federal + flat state model for planning (not filing).">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Field label="Tax year">
            <NumberInput step={1} value={tax.year} onChange={(e) => updateTax({ year: +e.target.value })} />
          </Field>
          <Field label="Filing status" hint="Each user is planned as an independent single filer.">
            <div className="flex h-[34px] items-center rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-canvas)]/40 px-3 text-sm text-slate-300">
              Single filer
            </div>
          </Field>
          <Field label="State">
            <TextInput value={tax.state} onChange={(e) => updateTax({ state: e.target.value })} />
          </Field>
          <Field label="State flat rate %">
            <NumberInput step={0.25} value={tax.stateFlatRatePct} onChange={(e) => updateTax({ stateFlatRatePct: +e.target.value })} />
          </Field>
          <Field label="Standard deduction">
            <NumberInput value={tax.standardDeduction} onChange={(e) => updateTax({ standardDeduction: +e.target.value })} />
          </Field>
          <Field label="SS wage base">
            <NumberInput value={tax.ssWageBase} onChange={(e) => updateTax({ ssWageBase: +e.target.value })} />
          </Field>
          <Field label="Social Security %">
            <NumberInput step={0.1} value={tax.ssRatePct} onChange={(e) => updateTax({ ssRatePct: +e.target.value })} />
          </Field>
          <Field label="Medicare %">
            <NumberInput step={0.1} value={tax.medicareRatePct} onChange={(e) => updateTax({ medicareRatePct: +e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge>Federal brackets: {tax.federalBrackets.length} tiers ({FILING_STATUS_LABELS[tax.filingStatus]})</Badge>
          <Badge>{tax.year} 401k limit: {formatUsd(LIMIT_401K_EMPLOYEE)}</Badge>
          <Badge>{tax.year} HSA family: {formatUsd(LIMIT_HSA_FAMILY)}</Badge>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Each user is treated as a single filer and taxed on their own income using the selected brackets. This is a planning approximation, not a filed return.
        </p>
      </Card>

      <Card className="mt-4" title="Users" subtitle="Rename people, edit their persona notes, hide a user, or add/remove users.">
        <div className="space-y-3">
          {members.map((m) => (
            <div key={m.id} className={`grid grid-cols-1 gap-3 rounded-lg border border-[var(--color-border-subtle)] p-3 lg:grid-cols-[auto_1fr_2fr_auto_auto] lg:items-end ${m.hidden ? "opacity-60" : ""}`}>
              <Field label="Color">
                <Select value={m.color} onChange={(e) => updateMember(m.id, { color: e.target.value })} className="w-24">
                  {MEMBER_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Name">
                <TextInput value={m.name} onChange={(e) => updateMember(m.id, { name: e.target.value })} />
              </Field>
              <Field label="Notes (persona given to the AI)">
                <TextInput value={m.notes} onChange={(e) => updateMember(m.id, { notes: e.target.value })} />
              </Field>
              <Button variant="ghost" onClick={() => updateMember(m.id, { hidden: !m.hidden })}>
                {m.hidden ? "Show" : "Hide"}
              </Button>
              <Button variant="danger" disabled={members.length <= 1} onClick={() => removeMember(m.id)}>Remove</Button>
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button variant="subtle" onClick={addMember}>+ Add user</Button>
        </div>
      </Card>

      <Card className="mt-4" title="Roth vs. traditional — quick primer">
        <div className="grid grid-cols-1 gap-4 text-sm text-slate-300 sm:grid-cols-2">
          <div>
            <p className="font-semibold text-slate-100">Traditional (pre-tax)</p>
            <p className="mt-1 text-slate-400">
              Contributions lower taxable income now, so you save tax at your current marginal rate. Withdrawals in retirement are taxed as income. Best when your tax rate today is higher than it will be later.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-100">Roth (post-tax)</p>
            <p className="mt-1 text-slate-400">
              You pay tax now; growth and qualified withdrawals are tax-free. Best when your tax rate is low today and likely higher later.
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Employer match is always pre-tax (traditional), regardless of whether your own contributions are Roth. So contributing enough to capture the full match comes first either way.
        </p>
      </Card>

      <Card className="mt-4 border-rose-500/20" title="Your data" subtitle="Stored only in this browser. Back it up or move it between devices with export/import.">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={doExport}>Export JSON</Button>
          <Button variant="ghost" onClick={() => fileRef.current?.click()}>Import JSON</Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void doImport(f);
              e.target.value = "";
            }}
          />
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("Reset everything back to the sample data? This clears your edits.")) {
                resetToSeed();
                setImportMsg("Reset to sample data.");
              }
            }}
          >
            Reset to sample data
          </Button>
          {importMsg && <span className="text-xs text-slate-400">{importMsg}</span>}
        </div>
      </Card>
    </div>
  );
}
