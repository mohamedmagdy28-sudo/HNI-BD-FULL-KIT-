// Read-only BOQ panel for the BD side (owner + manager oversight): the same
// lines the delivery team sees, with per-line attribution badges naming who
// added what (user direction 2026-09-03).

import { StatusBadge } from "@/components/app/StatusBadge";
import { formatCurrency, useI18n } from "@/lib/i18n";
import { boqTotals, lineAdderName, type BoqRecord } from "./boq";
import type { ProfileEntry } from "./supabaseStore";

export function BoqView({ boq, profiles }: { boq: BoqRecord; profiles: ProfileEntry[] }) {
  const { t, locale } = useI18n();
  const p = t.pricing;
  const money = (v: number) => formatCurrency(v, locale);
  const nameOf = (id: string | null) => profiles.find((x) => x.id === id)?.displayName ?? "—";
  const totals = boqTotals(boq.lines);

  return (
    <div className="mt-3 rounded-md border border-line-1 bg-surface-1 p-3" data-testid="boq-view">
      <div className="mb-2 flex items-center gap-2 text-[12.5px] text-hni-grey-dark">
        <span className="font-medium text-hni-black">{p.boqViewTitle}</span>
        <span>
          {p.boqAssignPt}: {nameOf(boq.ptAssignee)} · {p.boqAssignPm}: {nameOf(boq.pmAssignee)}
        </span>
        <StatusBadge tone={boq.status === "ready" ? "success" : "info"}>
          {(p.boqStatusLabels as Record<string, string>)[boq.status]}
        </StatusBadge>
      </div>
      {boq.context.programs.map((program) => {
        const lines = boq.lines.filter((l) => l.programId === program.id);
        if (lines.length === 0) return null;
        return (
          <div key={program.id} className="mb-2">
            <div className="flex items-center justify-between py-1 text-[12.5px] font-semibold text-hni-black">
              <span>{program.name}</span>
              <bdi className="tabular">{money(totals.byProgram.get(program.id) ?? 0)}</bdi>
            </div>
            {lines.map((line) => (
              <div key={line.id} className="flex items-center gap-2 border-t border-line-1 py-1 text-[12.5px]">
                <span className="min-w-0 flex-1 truncate">{line.label || "—"}</span>
                <StatusBadge tone={line.origin === "pm" ? "info" : "neutral"}>
                  {lineAdderName(line.origin, boq, nameOf)}
                </StatusBadge>
                <span className="tabular w-14 text-end text-hni-grey-dark">{line.qty}</span>
                <bdi className="tabular w-24 text-end text-hni-grey-dark">{money(line.unitRate)}</bdi>
                <bdi className="tabular w-24 text-end font-medium">
                  {money(Math.round(Math.max(0, line.qty) * Math.max(0, line.unitRate)))}
                </bdi>
              </div>
            ))}
          </div>
        );
      })}
      <div className="flex items-center justify-between border-t border-line-1 pt-2 text-[13px] font-semibold text-hni-black">
        <span>{p.boqTotalCost}</span>
        <bdi className="tabular" data-testid="boq-view-total">{money(totals.total)}</bdi>
      </div>
    </div>
  );
}
