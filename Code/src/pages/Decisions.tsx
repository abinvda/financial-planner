import { useMemo, useState } from "react";
import { Badge, Card, Field, NumberInput, PageHeader } from "../components/ui";
import { MathSteps } from "../components/MathSteps";
import { useActiveUser, useActiveSummary, useFutureSummary } from "../hooks";
import { useStore } from "../store";
import {
  hsaDecision,
  rothIraDecision,
  rothVsTraditional,
} from "../engine";
import {
  FILING_STATUS_LABELS,
  LIMIT_401K_EMPLOYEE,
  LIMIT_HSA_FAMILY,
  LIMIT_ROTH_IRA,
  ROTH_IRA_PHASEOUT,
} from "../lib/taxTables";
import { formatPct, formatUsd } from "../lib/util";

interface Assumptions {
  years: number;
  returnPct: number;
  retirementRatePct: number;
  ltcgRatePct: number;
}

export default function Decisions() {
  const user = useActiveUser();
  const summary = useActiveSummary();
  const futureSummary = useFutureSummary();
  const tax = useStore((s) => s.tax);

  const defaultYears = user.retirement
    ? Math.max(1, user.retirement.retireAge - user.retirement.currentAge)
    : 30;

  const [a, setA] = useState<Assumptions>({
    years: defaultYears,
    returnPct: 7,
    retirementRatePct: 22,
    ltcgRatePct: 15,
  });
  const set = (patch: Partial<Assumptions>) => setA((prev) => ({ ...prev, ...patch }));

  const marginal = summary.tax.marginalRate;

  return (
    <div>
      <PageHeader
        title={`Decisions for ${user.name}`}
        description="Verifiable, numbers-first answers to the big tax-advantaged-savings questions. Every result shows its math."
      />

      {futureSummary && user.futureStage && (
        <CareerStageCard
          nowIncome={summary.grossAnnualUsd}
          nowRate={marginal}
          later={user.futureStage}
          laterIncome={futureSummary.grossAnnualUsd}
          laterRate={futureSummary.tax.marginalRate}
          filingStatus={tax.filingStatus}
        />
      )}

      <Card className={futureSummary ? "mt-4" : ""} title="Shared assumptions" subtitle="These feed the calculators below. Tweak and everything updates.">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Field label="Years until retirement">
            <NumberInput step={1} value={a.years} onChange={(e) => set({ years: Math.max(1, +e.target.value) })} />
          </Field>
          <Field label="Expected return %/yr" hint="After inflation, long-run">
            <NumberInput step={1} value={a.returnPct} onChange={(e) => set({ returnPct: +e.target.value })} />
          </Field>
          <Field label="Tax rate in retirement %">
            <NumberInput step={1} value={a.retirementRatePct} onChange={(e) => set({ retirementRatePct: +e.target.value })} />
          </Field>
          <Field label="Capital-gains rate %">
            <NumberInput step={1} value={a.ltcgRatePct} onChange={(e) => set({ ltcgRatePct: +e.target.value })} />
          </Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Badge>Your marginal rate today: {formatPct(marginal)}</Badge>
          <Badge>{FILING_STATUS_LABELS[tax.filingStatus]}</Badge>
          <Badge>Gross income: {formatUsd(summary.grossAnnualUsd, { compact: true })}</Badge>
          <Badge>{tax.year} limits</Badge>
        </div>
      </Card>

      <RothVsTradCard user={user} marginal={marginal} a={a} futureRate={futureSummary?.tax.marginalRate} futureLabel={user.futureStage?.label} defaultContribution={Math.min(user.deductions.retirementAnnual || LIMIT_401K_EMPLOYEE, LIMIT_401K_EMPLOYEE)} />
      <RothIraCard a={a} magi={summary.grossAnnualUsd} filingStatus={tax.filingStatus} />
      <HsaCard a={a} marginal={marginal} defaultContribution={user.deductions.hsaAnnual || LIMIT_HSA_FAMILY} />
    </div>
  );
}

// ---------- career stage: resident now vs attending later ----------

function CareerStageCard({
  nowIncome,
  nowRate,
  later,
  laterIncome,
  laterRate,
  filingStatus,
}: {
  nowIncome: number;
  nowRate: number;
  later: { label: string; startInYears: number };
  laterIncome: number;
  laterRate: number;
  filingStatus: Parameters<typeof rothIraDecision>[0]["filingStatus"];
}) {
  const phaseEnd = ROTH_IRA_PHASEOUT[filingStatus][1];
  const eligibleNow = nowIncome < phaseEnd;
  const eligibleLater = laterIncome < phaseEnd;
  const rateJumps = laterRate > nowRate + 0.001;

  return (
    <Card title="Your tax rate now vs. later" subtitle={`You're early-career today, but ${later.label.toLowerCase()} income arrives in about ${later.startInYears} year${later.startInYears === 1 ? "" : "s"}. That changes the answers below.`}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">Now</p>
          <p className="mt-1 text-sm text-slate-300">Income {formatUsd(nowIncome, { compact: true })}/yr</p>
          <p className="text-2xl font-bold tabular-nums text-slate-100">{formatPct(nowRate)}</p>
          <p className="mt-1 text-xs text-slate-400">marginal rate · direct Roth IRA {eligibleNow ? "available" : "phased out"}</p>
        </div>
        <div className="rounded-xl border border-indigo-400/30 bg-indigo-500/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-300">{later.label} (in ~{later.startInYears} yr)</p>
          <p className="mt-1 text-sm text-slate-300">Income {formatUsd(laterIncome, { compact: true })}/yr</p>
          <p className="text-2xl font-bold tabular-nums text-slate-100">{formatPct(laterRate)}</p>
          <p className="mt-1 text-xs text-slate-400">marginal rate · direct Roth IRA {eligibleLater ? "available" : "phased out → backdoor"}</p>
        </div>
      </div>
      <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        {rateJumps ? (
          <>
            <span className="font-semibold">Do the Roth things now.</span> Your rate is only {formatPct(nowRate)} today and jumps to about {formatPct(laterRate)} once you're {later.label.toLowerCase()}. So lock in tax-free growth while it's cheap: choose <span className="font-semibold">Roth</span> for your 401(k)/403(b) contributions, and max a <span className="font-semibold">direct Roth IRA</span> {eligibleNow ? "now while you still qualify" : "if you qualify"}{!eligibleLater ? " — because at the higher income you'll be over the limit and stuck with the backdoor route" : ""}. Once your rate is high, traditional (pre-tax) contributions usually win.
          </>
        ) : (
          <>Your marginal rate isn't much higher later, so the Roth-vs-traditional call is close — see the breakdown below.</>
        )}
      </div>
    </Card>
  );
}

// ---------- shared presentation ----------

function Verdict({ tone, children }: { tone: "roth" | "trad" | "yes" | "no" | "maybe"; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    roth: "border-pink-400/40 bg-pink-500/10 text-pink-200",
    trad: "border-indigo-400/40 bg-indigo-500/10 text-indigo-200",
    yes: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    no: "border-rose-400/40 bg-rose-500/10 text-rose-200",
    maybe: "border-amber-400/40 bg-amber-500/10 text-amber-200",
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${styles[tone]}`}>{children}</div>;
}

// ---------- Roth vs Traditional ----------

function RothVsTradCard({ user, marginal, a, futureRate, futureLabel, defaultContribution }: { user: ReturnType<typeof useActiveUser>; marginal: number; a: Assumptions; futureRate?: number; futureLabel?: string; defaultContribution: number }) {
  const [contribution, setContribution] = useState(defaultContribution);
  const res = useMemo(
    () =>
      rothVsTraditional({
        annualContribution: contribution,
        currentRate: marginal,
        retirementRate: a.retirementRatePct / 100,
        returnPct: a.returnPct,
        years: a.years,
      }),
    [contribution, marginal, a],
  );

  return (
    <Card className="mt-4" title="Roth vs. Traditional 401(k)/403(b)" subtitle="Pay tax now (Roth) or later (Traditional)?">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <div>
          <Field label="Contribution / yr">
            <NumberInput value={contribution} onChange={(e) => setContribution(+e.target.value)} />
          </Field>
          <p className="mt-2 text-xs text-slate-500">Employee limit: {formatUsd(LIMIT_401K_EMPLOYEE)}.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Outcome label="Traditional (after-tax)" value={res.tradAfterTax} highlight={res.winner === "traditional"} />
            <Outcome label="Roth (tax-free)" value={res.rothFvAfterTax} highlight={res.winner === "roth"} />
          </div>
        </div>
        <div>
          <Verdict tone={res.winner === "roth" ? "roth" : res.winner === "traditional" ? "trad" : "maybe"}>
            {res.winner === "tie" ? (
              <>Both come out the same because your tax rate today ({formatPct(marginal)}) equals your assumed retirement rate ({a.retirementRatePct}%).</>
            ) : (
              <>
                <span className="font-semibold">{res.winner === "roth" ? "Roth wins" : "Traditional wins"}</span> by{" "}
                <span className="font-semibold">{formatUsd(res.difference)}</span> after tax in {a.years} years — because your rate today is{" "}
                {res.winner === "roth" ? "lower" : "higher"} than the {a.retirementRatePct}% you expect in retirement.
                {res.winner === "traditional" && <> Traditional also frees up {formatUsd(res.taxSavedNowPerYear)}/yr in taxes now.</>}
              </>
            )}
          </Verdict>
          <p className="mt-3 text-sm text-slate-400">
            The rule: contribute the same pre-tax dollars either way. Traditional grows untaxed then is taxed on withdrawal; Roth is taxed up front then never again. So the winner is simply whether your tax rate is higher <em>now</em> or <em>later</em>. For {user.name}, today's marginal rate is {formatPct(marginal)}.
          </p>
          {futureRate !== undefined && futureRate > marginal + 0.001 && (
            <p className="mt-2 text-xs text-amber-200/90">
              Heads up: as {futureLabel?.toLowerCase()} your marginal rate is roughly {formatPct(futureRate)}. The math above uses your current {formatPct(marginal)} rate — while it's this low, Roth is unusually attractive.
            </p>
          )}
          <p className="mt-2 text-xs text-slate-500">Note: employer match is always pre-tax regardless — always contribute enough to capture it first.</p>
        </div>
      </div>
      <MathSteps steps={res.steps} />
    </Card>
  );
}

// ---------- Roth IRA ----------

function RothIraCard({ a, magi, filingStatus }: { a: Assumptions; magi: number; filingStatus: Parameters<typeof rothIraDecision>[0]["filingStatus"] }) {
  const [contribution, setContribution] = useState(LIMIT_ROTH_IRA);
  const res = useMemo(
    () =>
      rothIraDecision({
        annualContribution: contribution,
        returnPct: a.returnPct,
        years: a.years,
        ltcgRate: a.ltcgRatePct / 100,
        magi,
        filingStatus,
        limit: LIMIT_ROTH_IRA,
      }),
    [contribution, a, magi, filingStatus],
  );

  return (
    <Card className="mt-4" title="Roth IRA — should you contribute?" subtitle="Tax-free growth on top of your 401(k)/403(b).">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <div>
          <Field label="Contribution / yr">
            <NumberInput value={contribution} onChange={(e) => setContribution(+e.target.value)} />
          </Field>
          <p className="mt-2 text-xs text-slate-500">Limit: {formatUsd(LIMIT_ROTH_IRA)} (under 50).</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Outcome label="Roth IRA (tax-free)" value={res.rothFv} highlight />
            <Outcome label="Taxable alt." value={res.taxableAfterTax} />
          </div>
        </div>
        <div>
          <Verdict tone={res.eligible ? (res.maxAllowed < LIMIT_ROTH_IRA ? "maybe" : "yes") : "no"}>
            {res.eligible ? (
              <>
                <span className="font-semibold">Yes{res.maxAllowed < LIMIT_ROTH_IRA ? " (reduced limit)" : ""}.</span> You can put in up to{" "}
                <span className="font-semibold">{formatUsd(res.maxAllowed)}</span>/yr. Over {a.years} years that saves about{" "}
                <span className="font-semibold">{formatUsd(res.advantage)}</span> in taxes vs. a regular brokerage.
              </>
            ) : (
              <>
                <span className="font-semibold">Not directly.</span> Your income is above the range for a direct Roth IRA.
              </>
            )}
          </Verdict>
          <p className="mt-3 text-sm text-slate-400">{res.note}</p>
          <p className="mt-2 text-xs text-slate-500">
            Phase-out for {FILING_STATUS_LABELS[filingStatus]}: {formatUsd(res.phaseoutStart)}–{formatUsd(res.phaseoutEnd)} MAGI (approximated by gross income here).
          </p>
        </div>
      </div>
      <MathSteps steps={res.steps} />
    </Card>
  );
}

// ---------- HSA ----------

function HsaCard({ a, marginal, defaultContribution }: { a: Assumptions; marginal: number; defaultContribution: number }) {
  const [contribution, setContribution] = useState(defaultContribution);
  const [includeFica, setIncludeFica] = useState(true);
  const res = useMemo(
    () =>
      hsaDecision({
        annualContribution: contribution,
        marginalRate: marginal,
        includeFica,
        returnPct: a.returnPct,
        years: a.years,
        ltcgRate: a.ltcgRatePct / 100,
      }),
    [contribution, marginal, includeFica, a],
  );

  return (
    <Card className="mt-4" title="Should you max the HSA?" subtitle="The only triple-tax-advantaged account (requires an HDHP).">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_2fr]">
        <div>
          <Field label="Contribution / yr">
            <NumberInput value={contribution} onChange={(e) => setContribution(+e.target.value)} />
          </Field>
          <p className="mt-2 text-xs text-slate-500">Family limit: {formatUsd(LIMIT_HSA_FAMILY)}.</p>
          <label className="mt-3 flex items-center gap-2 text-xs text-slate-400">
            <input type="checkbox" checked={includeFica} onChange={(e) => setIncludeFica(e.target.checked)} className="h-4 w-4 accent-indigo-500" />
            Contributed via employer payroll (also saves 7.65% FICA)
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Outcome label="Tax saved now / yr" value={res.totalUpfrontPerYear} highlight />
            <Outcome label="Extra vs. taxable" value={res.advantage} />
          </div>
        </div>
        <div>
          <Verdict tone="yes">
            <span className="font-semibold">Almost always yes if you have the cash.</span> You save{" "}
            <span className="font-semibold">{formatUsd(res.totalUpfrontPerYear)}</span> in taxes this year, and investing it grows to{" "}
            <span className="font-semibold">{formatUsd(res.fvTaxFree)}</span> tax-free — about{" "}
            <span className="font-semibold">{formatUsd(res.advantage)}</span> more than the same money in a taxable account.
          </Verdict>
          <p className="mt-3 text-sm text-slate-400">
            HSA money is deducted before tax, grows tax-free, and comes out tax-free for medical costs — three tax breaks in one. The catch: you need a high-deductible health plan, and it's best to pay current medical bills out of pocket so the balance can compound.
          </p>
        </div>
      </div>
      <MathSteps steps={res.steps} />
    </Card>
  );
}

function Outcome({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? "border-emerald-400/40 bg-emerald-500/5" : "border-[var(--color-border-subtle)]"}`}>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-slate-100">{formatUsd(value, { compact: true })}</p>
    </div>
  );
}
