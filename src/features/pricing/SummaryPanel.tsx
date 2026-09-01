import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrency, useI18n } from "@/lib/i18n";
import { marginPctFromMarkup, markupFromMarginPct, markupFromPricePerDay, type CalcResult } from "./calc";
import { newId, VAT_MAX, VAT_MIN, type Proposal } from "./types";

type Props = {
  proposal: Proposal;
  result: CalcResult;
  marginFloorPct: number;
  locked: boolean;
  onChange: (patch: Partial<Proposal>) => void;
};

function numInput(value: string, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * The price chain, top to bottom:
 *   total cost -> markup/target margin -> list -> discount -> net
 *   -> margin block (the visual anchor) -> VAT -> total -> schedule
 * Markup % is the stored field; the target-margin input converts on edit.
 */
export function SummaryPanel({ proposal, result, marginFloorPct, locked, onChange }: Props) {
  const { t, locale } = useI18n();
  const p = t.pricing;
  const disabled = locked || result.pricingDisabled;

  // Target margin and Price/Day are DERIVED from the stored markup. Binding
  // their inputs directly to the derived value hijacks manual typing (each
  // keystroke's recompute overwrites the field mid-entry — the "2" of 20000
  // snaps to cost/days). While focused, the field shows the user's draft;
  // every keystroke still updates markup so all other figures move live;
  // blur re-syncs the display to the derived value.
  const [marginDraft, setMarginDraft] = useState<string | null>(null);
  const [ppdDraft, setPpdDraft] = useState<string | null>(null);

  const marginTone = result.pricingDisabled
    ? "neutral"
    : result.marginAmount < 0
      ? "danger"
      : result.marginPct < marginFloorPct
        ? "warning"
        : "success";
  const toneVars = {
    success: { fg: "var(--status-success-fg)", bg: "var(--status-success-bg)" },
    warning: { fg: "var(--status-warning-fg)", bg: "var(--status-warning-bg)" },
    danger: { fg: "var(--status-danger-fg)", bg: "var(--status-danger-bg)" },
    neutral: { fg: "var(--status-neutral-fg)", bg: "var(--status-neutral-bg)" },
  }[marginTone];

  const row = (label: string, value: number, testId: string, emphasis = false) => (
    <div className="flex items-baseline justify-between gap-2 py-1">
      <span className={cn("text-[13px]", emphasis ? "font-semibold text-hni-black" : "text-hni-grey-dark")}>{label}</span>
      <bdi className={cn("tabular text-[13px]", emphasis ? "font-semibold text-hni-black" : "font-medium text-hni-black")} data-testid={testId}>
        {formatCurrency(value, locale)}
      </bdi>
    </div>
  );

  return (
    <div className="rounded-lg border border-line-1 bg-surface-0 p-4">
      {row(p.totalCost, result.totalCost, "total-cost")}

      <div className="my-2 grid grid-cols-3 gap-2">
        <label>
          <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.markup}</span>
          <Input
            type="number"
            min={0}
            value={proposal.markupPct}
            disabled={disabled}
            data-testid="markup-input"
            onChange={(e) => onChange({ markupPct: Math.max(0, numInput(e.target.value)) })}
            className="tabular mt-1 h-8"
          />
        </label>
        <label>
          <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.targetMargin}</span>
          <Input
            type="number"
            min={0}
            max={99}
            value={marginDraft ?? Math.round(marginPctFromMarkup(proposal.markupPct) * 10) / 10}
            disabled={disabled}
            data-testid="target-margin-input"
            onFocus={() => setMarginDraft(String(Math.round(marginPctFromMarkup(proposal.markupPct) * 10) / 10))}
            onBlur={() => setMarginDraft(null)}
            onChange={(e) => {
              setMarginDraft(e.target.value);
              onChange({ markupPct: Math.round(markupFromMarginPct(numInput(e.target.value)) * 10) / 10 });
            }}
            className="tabular mt-1 h-8"
          />
        </label>
        <label>
          <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.pricePerDay}</span>
          <Input
            type="number"
            min={0}
            value={ppdDraft ?? (result.pricePerDay ?? "")}
            disabled={disabled || result.totalDays === 0}
            data-testid="price-per-day-input"
            onFocus={() => setPpdDraft(String(result.pricePerDay ?? ""))}
            onBlur={() => setPpdDraft(null)}
            onChange={(e) => {
              setPpdDraft(e.target.value);
              onChange({
                markupPct:
                  Math.round(markupFromPricePerDay(numInput(e.target.value), result.totalCost, result.totalDays) * 10) / 10,
              });
            }}
            className="tabular mt-1 h-8"
          />
        </label>
      </div>
      {result.pricingDisabled && <p className="mb-2 text-[12px] text-hni-grey-mid">{p.pricingDisabledHint}</p>}

      {row(p.listPrice, result.listPrice, "list-price")}

      <div className="flex items-center justify-between gap-2 py-1">
        <span className="text-[13px] text-hni-grey-dark">{p.discount}</span>
        <div className="flex items-center gap-1">
          <div className="flex overflow-hidden rounded-md border border-input" role="group" aria-label={p.discount}>
            {(["percent", "amount"] as const).map((type) => (
              <button
                key={type}
                type="button"
                disabled={disabled}
                aria-pressed={proposal.discount.type === type}
                data-testid={`discount-type-${type}`}
                onClick={() => onChange({ discount: { ...proposal.discount, type } })}
                className={cn(
                  "px-2 py-1 text-[11.5px] font-medium",
                  proposal.discount.type === type ? "bg-hni-magenta text-white" : "bg-surface-0 text-hni-grey-dark",
                  disabled && "opacity-50",
                )}
              >
                {type === "percent" ? p.discountPercent : p.discountAmount}
              </button>
            ))}
          </div>
          <Input
            type="number"
            min={0}
            value={proposal.discount.value}
            disabled={disabled}
            data-testid="discount-value"
            onChange={(e) => onChange({ discount: { ...proposal.discount, value: Math.max(0, numInput(e.target.value)) } })}
            className="tabular h-8 w-24 text-end"
          />
        </div>
      </div>
      {result.discountAmount > 0 && row(p.discount, -result.discountAmount, "discount-amount")}

      {row(p.netPrice, result.netPrice, "net-price", true)}

      <div
        className="my-2 rounded-lg border px-3 py-2.5 text-center"
        style={{ borderColor: toneVars.fg, backgroundColor: toneVars.bg }}
        data-testid="margin-block"
        data-tone={marginTone}
      >
        <div className="tabular text-[26px] font-bold leading-none" style={{ color: toneVars.fg }} data-testid="margin-pct">
          <bdi>{result.marginPct.toFixed(1)}%</bdi>
        </div>
        <div className="tabular mt-1 text-[12.5px] font-medium" style={{ color: toneVars.fg }}>
          <bdi>
            {p.margin}: {formatCurrency(result.marginAmount, locale)}
          </bdi>
        </div>
        {marginTone === "warning" && (
          <div className="mt-0.5 text-[11.5px]" style={{ color: toneVars.fg }} data-testid="margin-floor-warning">
            {p.belowFloor.replace("{floor}", String(marginFloorPct))}
          </div>
        )}
        {marginTone === "danger" && (
          <div className="mt-0.5 text-[11.5px]" style={{ color: toneVars.fg }} data-testid="margin-negative-warning">
            {p.negativeMargin}
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 py-1">
        <span className="flex items-center gap-1.5 text-[13px] text-hni-grey-dark">
          {p.vat}
          <Input
            type="number"
            min={VAT_MIN}
            max={VAT_MAX}
            value={proposal.vatPct}
            disabled={locked}
            data-testid="vat-input"
            aria-label={p.vat}
            onChange={(e) => onChange({ vatPct: Math.min(VAT_MAX, Math.max(VAT_MIN, numInput(e.target.value))) })}
            className="tabular h-7 w-14 px-1 text-end"
          />
          %
        </span>
        <bdi className="tabular text-[13px] font-medium text-hni-black" data-testid="vat-amount">
          {formatCurrency(result.vatAmount, locale)}
        </bdi>
      </div>

      {row(p.totalIncVat, result.totalIncVat, "total-inc-vat", true)}

      <div className="mt-3 border-t border-line-1 pt-3">
        <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.schedule}</div>
        <div className="space-y-1.5">
          {proposal.schedule.map((item, i) => {
            const installment = result.installments.find((x) => x.itemId === item.id);
            return (
              <div key={item.id} className="flex items-center gap-1.5">
                <Input
                  value={item.label}
                  disabled={locked}
                  aria-label={p.scheduleLabel}
                  data-testid={`schedule-label-${i}`}
                  onChange={(e) =>
                    onChange({ schedule: proposal.schedule.map((s) => (s.id === item.id ? { ...s, label: e.target.value } : s)) })
                  }
                  className="h-8 min-w-0 flex-1"
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={item.percent}
                  disabled={locked}
                  aria-label={p.schedulePercent}
                  data-testid={`schedule-percent-${i}`}
                  onChange={(e) =>
                    onChange({
                      schedule: proposal.schedule.map((s) =>
                        s.id === item.id ? { ...s, percent: Math.max(0, Math.trunc(numInput(e.target.value))) } : s,
                      ),
                    })
                  }
                  className="tabular h-8 w-16 text-end"
                />
                <bdi className="tabular w-24 text-end text-[12.5px] text-hni-grey-dark">
                  {installment ? formatCurrency(installment.amount, locale) : "—"}
                </bdi>
                {!locked && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
                    aria-label={`${p.removeLine} ${item.label}`}
                    onClick={() => onChange({ schedule: proposal.schedule.filter((s) => s.id !== item.id) })}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {!result.scheduleValid && (
          <p role="alert" data-testid="schedule-error" className="mt-1.5 rounded bg-[color:var(--status-danger-bg)] px-2 py-1 text-[12px] text-[color:var(--status-danger-fg)]">
            {p.scheduleError}
          </p>
        )}
        {!locked && (
          <Button
            variant="ghost"
            size="sm"
            data-testid="add-installment"
            className="mt-1.5 h-7 px-2 text-[12.5px] text-hni-magenta hover:text-hni-magenta"
            onClick={() => onChange({ schedule: [...proposal.schedule, { id: newId(), label: "", percent: 0 }] })}
          >
            <Plus className="size-3.5" aria-hidden />
            {p.addInstallment}
          </Button>
        )}
      </div>
    </div>
  );
}
