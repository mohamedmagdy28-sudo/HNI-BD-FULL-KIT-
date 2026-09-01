import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/app/MoneyInput";
import { formatCurrency, useI18n } from "@/lib/i18n";
import { lineSubtotal, marginPctFromMarkup, markupFromMarginPct, markupFromPricePerDay, programCost, type CalcResult, type ProgramTotals } from "./calc";
import { newCostLine, newProgram, type CostLine, type Program } from "./types";

type Props = {
  programs: Program[];
  locked: boolean;
  /** Fixed cost items pre-created in every new program (from the proposal's project type). */
  seedLabels: readonly string[];
  /** What a group is called in this proposal: "Program" by default, "Phase", "Module", ... */
  groupLabel: string;
  /** Live calc result feeding each phase's pricing strip. */
  result: CalcResult | null;
  /** The proposal-level markup — the default an un-overridden phase inherits. */
  defaultMarkupPct: number;
  onChange: (programs: Program[]) => void;
};

/** Parses a numeric input; empty or invalid becomes 0, negatives clamp to 0. */
function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function CostTable({ programs, locked, seedLabels, groupLabel, result, defaultMarkupPct, onChange }: Props) {
  const { t, locale } = useI18n();
  const p = t.pricing;

  const updateProgram = (id: string, patch: Partial<Program>) =>
    onChange(programs.map((pr) => (pr.id === id ? { ...pr, ...patch } : pr)));

  const updateLine = (programId: string, lineId: string, patch: Partial<CostLine>) =>
    onChange(
      programs.map((pr) =>
        pr.id === programId
          ? { ...pr, costLines: pr.costLines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
          : pr,
      ),
    );

  return (
    <div className="space-y-4">
      {programs.map((program, index) => (
        <section
          key={program.id}
          aria-label={`${groupLabel} ${index + 1}`}
          className="overflow-hidden rounded-lg border border-line-1 bg-surface-0"
        >
          <div className="flex flex-wrap items-end gap-2 border-b border-line-1 bg-surface-1 px-3 py-2.5">
            <label className="min-w-0 flex-1 basis-48">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{groupLabel}</span>
              <Input
                value={program.name}
                disabled={locked}
                data-testid={`program-name-${index}`}
                onChange={(e) => updateProgram(program.id, { name: e.target.value })}
                className="mt-1 h-8 bg-surface-0"
              />
            </label>
            <label className="w-20">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.days}</span>
              <Input
                type="number"
                min={0}
                value={program.days}
                disabled={locked}
                data-testid={`program-days-${index}`}
                onChange={(e) => updateProgram(program.id, { days: num(e.target.value) })}
                className="tabular mt-1 h-8 bg-surface-0"
              />
            </label>
            <label className="w-28">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.participants}</span>
              <Input
                type="number"
                min={0}
                value={program.participants}
                disabled={locked}
                data-testid={`program-participants-${index}`}
                onChange={(e) => updateProgram(program.id, { participants: num(e.target.value) })}
                className="tabular mt-1 h-8 bg-surface-0"
              />
            </label>
            <label className="w-32">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.city}</span>
              <Input
                value={program.city}
                disabled={locked}
                onChange={(e) => updateProgram(program.id, { city: e.target.value })}
                className="mt-1 h-8 bg-surface-0"
              />
            </label>
            {!locked && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
                aria-label={p.removeProgram}
                onClick={() => onChange(programs.filter((pr) => pr.id !== program.id))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
            <label className="w-full">
              <span className="sr-only">{p.description}</span>
              <Input
                value={program.description}
                disabled={locked}
                placeholder={p.description}
                data-testid={`program-description-${index}`}
                onChange={(e) => updateProgram(program.id, { description: e.target.value })}
                className="mt-1 h-8 bg-surface-0 text-[12.5px]"
              />
            </label>
          </div>

          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-1 text-[11px] uppercase tracking-wide text-hni-grey-dark">
                <th className="px-3 py-2 text-start font-medium">{p.lineLabel}</th>
                <th className="w-24 px-2 py-2 text-end font-medium">{p.qty}</th>
                <th className="w-32 px-2 py-2 text-end font-medium">{p.unitRate}</th>
                <th className="w-32 px-3 py-2 text-end font-medium">{p.subtotal}</th>
                <th className="w-10 px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {program.costLines.map((line, lineIndex) => (
                <tr key={line.id} className="border-b border-line-1 last:border-b-0">
                  <td className="px-3 py-1.5">
                    <Input
                      value={line.label}
                      disabled={locked}
                      data-testid={`line-label-${index}-${lineIndex}`}
                      onChange={(e) => updateLine(program.id, line.id, { label: e.target.value })}
                      className="h-8 border-transparent bg-transparent px-1 shadow-none focus-visible:border-input"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={line.qty}
                      disabled={locked}
                      data-testid={`line-qty-${index}-${lineIndex}`}
                      onChange={(e) => updateLine(program.id, line.id, { qty: num(e.target.value) })}
                      className="tabular h-8 border-transparent bg-transparent px-1 text-end shadow-none focus-visible:border-input"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <MoneyInput
                      value={line.unitRate || null}
                      disabled={locked}
                      data-testid={`line-rate-${index}-${lineIndex}`}
                      onValue={(n) => updateLine(program.id, line.id, { unitRate: n ?? 0 })}
                      className="tabular h-8 border-transparent bg-transparent px-1 text-end shadow-none focus-visible:border-input"
                    />
                  </td>
                  <td className="tabular px-3 py-1.5 text-end font-medium text-hni-black">
                    <bdi>{formatCurrency(lineSubtotal(line.qty, line.unitRate), locale)}</bdi>
                  </td>
                  <td className="px-1 py-1.5">
                    {!locked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
                        aria-label={p.removeLine}
                        onClick={() =>
                          updateProgram(program.id, { costLines: program.costLines.filter((l) => l.id !== line.id) })
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface-1/60">
                <td className="px-3 py-1.5">
                  {!locked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`add-line-${index}`}
                      className="h-7 px-2 text-[12.5px] text-hni-magenta hover:text-hni-magenta"
                      onClick={() => updateProgram(program.id, { costLines: [...program.costLines, newCostLine()] })}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      {p.addLine}
                    </Button>
                  )}
                </td>
                <td colSpan={2} className="px-2 py-1.5 text-end text-[12px] text-hni-grey-dark" />
                <td className="tabular px-3 py-1.5 text-end font-semibold text-hni-black" data-testid={`program-cost-${index}`}>
                  <bdi>{formatCurrency(programCost(program), locale)}</bdi>
                </td>
                <td className="px-1 py-1.5" />
              </tr>
            </tbody>
          </table>
          <PhasePricingStrip
            program={program}
            index={index}
            totals={result?.programs.find((x) => x.programId === program.id) ?? null}
            defaultMarkupPct={defaultMarkupPct}
            locked={locked}
            onChange={(patch) => updateProgram(program.id, patch)}
          />
        </section>
      ))}

      {!locked && (
        <Button
          variant="outline"
          size="sm"
          data-testid="add-program"
          onClick={() => onChange([...programs, newProgram(`${groupLabel} ${programs.length + 1}`, seedLabels)])}
        >
          <Plus className="size-4" aria-hidden />
          {p.addProgram}
        </Button>
      )}
    </div>
  );
}

/**
 * Per-phase pricing strip (design: docs/designs/per-phase-pricing.md).
 * Inherit state: inputs empty with the inherited value as placeholder; typing
 * creates the override (badge + reset appear). Margin and Price/Day are
 * converters writing back to this phase's markup, with the draft-while-focused
 * pattern so typing is never hijacked by the derived recompute.
 */
function PhasePricingStrip({
  program,
  index,
  totals,
  defaultMarkupPct,
  locked,
  onChange,
}: {
  program: Program;
  index: number;
  totals: ProgramTotals | null;
  defaultMarkupPct: number;
  locked: boolean;
  onChange: (patch: Partial<Program>) => void;
}) {
  const { t, locale } = useI18n();
  const p = t.pricing;
  const [draft, setDraft] = useState<{ field: "markup" | "margin" | "ppd"; value: string | number | null } | null>(null);

  const cost = programCost(program);
  const overridden = program.markupPct != null && Number.isFinite(program.markupPct);
  const disabled = locked || cost === 0;
  const eff = totals?.effMarkupPct ?? (overridden ? (program.markupPct as number) : defaultMarkupPct);
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const setOverride = (markup: number) => onChange({ markupPct: Math.max(0, round1(markup)) });
  // Price/Day is the number BD quotes: store its implied markup at FULL
  // precision so the typed day rate reproduces exactly (round1 would drift
  // 40,000 to 39,987). The markup field displays it rounded to one decimal.
  const setOverridePrecise = (markup: number) => onChange({ markupPct: Math.max(0, markup) });

  return (
    <div className="flex flex-wrap items-end gap-2 border-t border-line-1 bg-surface-1 px-3 py-2">
      <span className="me-1 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.phasePricing}</span>
      <label className="w-24">
        <span className="block text-[11px] text-hni-grey-dark">{p.markup}</span>
        <Input
          type="number"
          min={0}
          value={draft?.field === "markup" ? (draft.value as string) : overridden ? round1(program.markupPct as number) : ""}
          placeholder={String(round1(defaultMarkupPct))}
          disabled={disabled}
          data-testid={`phase-markup-${index}`}
          onFocus={() => setDraft({ field: "markup", value: overridden ? String(round1(program.markupPct as number)) : "" })}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            const v = e.target.value;
            setDraft({ field: "markup", value: v });
            if (v === "") onChange({ markupPct: null });
            else setOverride(Number(v) || 0);
          }}
          className="tabular mt-0.5 h-7"
        />
      </label>
      <label className="w-24">
        <span className="block text-[11px] text-hni-grey-dark">{p.targetMargin}</span>
        <Input
          type="number"
          min={0}
          max={99}
          value={draft?.field === "margin" ? (draft.value as string) : overridden ? round1(marginPctFromMarkup(eff)) : ""}
          placeholder={String(round1(marginPctFromMarkup(defaultMarkupPct)))}
          disabled={disabled}
          data-testid={`phase-margin-${index}`}
          onFocus={() => setDraft({ field: "margin", value: overridden ? String(round1(marginPctFromMarkup(eff))) : "" })}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            setDraft({ field: "margin", value: e.target.value });
            if (e.target.value === "") onChange({ markupPct: null });
            else setOverride(markupFromMarginPct(Number(e.target.value) || 0));
          }}
          className="tabular mt-0.5 h-7"
        />
      </label>
      <label className="w-28">
        <span className="block text-[11px] text-hni-grey-dark">{p.pricePerDay}</span>
        <MoneyInput
          value={draft?.field === "ppd" ? (draft.value as number | null) : overridden ? (totals?.listPerDay ?? null) : null}
          placeholder={totals?.listPerDay != null ? totals.listPerDay.toLocaleString("en-US") : undefined}
          disabled={disabled || !program.days}
          data-testid={`phase-ppd-${index}`}
          onFocus={() => setDraft({ field: "ppd", value: overridden ? (totals?.listPerDay ?? null) : null })}
          onBlur={() => setDraft(null)}
          onValue={(n) => {
            setDraft({ field: "ppd", value: n });
            if (n == null) onChange({ markupPct: null });
            else setOverridePrecise(markupFromPricePerDay(n, cost, Math.max(0, program.days || 0)));
          }}
          className="tabular mt-0.5 h-7"
        />
      </label>
      {totals && cost > 0 && (
        <bdi className="tabular pb-1.5 text-[12.5px] font-medium text-hni-black" data-testid={`phase-chip-${index}`}>
          {formatCurrency(totals.listShare, locale)} · {p.margin} {round1(totals.phaseMarginPct)}%
        </bdi>
      )}
      {overridden && !locked && (
        <span className="flex items-center gap-1 pb-1">
          <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-hni-grey-dark">{p.phaseOverride}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
            aria-label={p.phaseReset}
            data-testid={`phase-reset-${index}`}
            onClick={() => onChange({ markupPct: null })}
          >
            <X className="size-3" aria-hidden />
          </Button>
        </span>
      )}
    </div>
  );
}
