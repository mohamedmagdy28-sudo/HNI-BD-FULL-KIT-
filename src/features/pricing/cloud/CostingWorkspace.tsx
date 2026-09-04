// Costing workspace (design: docs/designs/boq-costing-relay.md).
// The ENTIRE app for proposals_team / project_manager accounts: assigned
// BOQs and a cost-lines editor. No pipeline, no documents, no pricing UI
// exists in this tree — and none of that data ever reaches this session
// (the API refuses those rows), so there is nothing to hide.

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCheck, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/app/MoneyInput";
import { EmptyState } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, useI18n } from "@/lib/i18n";
import { debounce } from "../store";
import { boqTotals, canEditLines, lineAdderName, newBoqLine, type BoqLine, type BoqRecord } from "./boq";
import type { SupabaseStore } from "./supabaseStore";

export function CostingWorkspace({ store }: { store: SupabaseStore }) {
  const { t, locale } = useI18n();
  const p = t.pricing;
  const { toast } = useToast();
  const [boqs, setBoqs] = useState<BoqRecord[]>(store.boqs);
  const [currentId, setCurrentId] = useState<string | null>(store.boqs[0]?.proposalId ?? null);
  const myId = store.sessionUserId;
  const myOrigin = store.role === "project_manager" ? ("pm" as const) : ("pt" as const);

  useEffect(() => {
    store.onRemoteRefresh = () => setBoqs(store.boqs);
    store.onBoqConflict = (proposalId) => {
      setBoqs(store.boqs);
      const fresh = store.boqs.find((b) => b.proposalId === proposalId);
      toast({
        title: p.boqPenMoved.replace("{status}", fresh ? (p.boqStatusLabels as Record<string, string>)[fresh.status] : ""),
        variant: "destructive",
      });
    };
    return () => {
      store.onRemoteRefresh = null;
      store.onBoqConflict = null;
    };
  }, [store, toast, p]);

  const current = boqs.find((b) => b.proposalId === currentId) ?? null;
  // Amended (user direction): both assignees edit during draft AND pm_review;
  // the stage gates only the HANDOFF buttons, not the lines.
  const canEdit = current != null && canEditLines(current, myId);

  const save = useMemo(
    () =>
      debounce((proposalId: string, lines: BoqLine[]) => {
        store.saveBoqLines(proposalId, lines);
      }, 400),
    [store],
  );

  const updateLines = (lines: BoqLine[]) => {
    if (!current || !canEdit) return;
    setBoqs(boqs.map((b) => (b.proposalId === current.proposalId ? { ...b, lines } : b)));
    save(current.proposalId, lines);
  };

  const handoff = async (status: "pm_review" | "ready" | "draft") => {
    if (!current) return;
    save.flush();
    try {
      await store.setBoqStatus(current.proposalId, status);
      setBoqs(store.boqs);
      toast({ title: (p.boqStatusLabels as Record<string, string>)[status] });
    } catch {
      /* conflict toast already shown by onBoqConflict */
    }
  };

  const money = (v: number) => formatCurrency(v, locale);

  if (boqs.length === 0) {
    return <EmptyState title={p.boqEmptyTitle} body={p.boqEmptyBody} />;
  }

  if (!current) {
    setCurrentId(boqs[0].proposalId);
    return null;
  }

  const totals = boqTotals(current.lines);
  const statusLabel = (s: string) => (p.boqStatusLabels as Record<string, string>)[s] ?? s;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {boqs.length > 1 && (
          <select
            className="h-8 rounded-md border border-line-1 bg-surface-0 px-2 text-[13px]"
            value={current.proposalId}
            data-testid="boq-switcher"
            onChange={(e) => setCurrentId(e.target.value)}
          >
            {boqs.map((b) => (
              <option key={b.proposalId} value={b.proposalId}>
                {b.context.title || p.untitled} · {statusLabel(b.status)}
              </option>
            ))}
          </select>
        )}
        <h2 className="text-[16px] font-semibold text-hni-black">{current.context.title || p.untitled}</h2>
        {current.context.clientName && <span className="text-[13px] text-hni-grey-dark">· {current.context.clientName}</span>}
        <span data-testid="boq-status">
          <StatusBadge tone={current.status === "ready" ? "success" : current.status === "imported" ? "neutral" : "info"}>
            {statusLabel(current.status)}
          </StatusBadge>
        </span>
        <div className="ms-auto flex gap-2">
          {canEdit && current.status === "draft" && myOrigin === "pt" && (
            <Button size="sm" data-testid="boq-to-pm" onClick={() => void handoff("pm_review")}>
              <CheckCheck className="size-4" aria-hidden />
              {p.boqSendToPm}
            </Button>
          )}
          {canEdit && current.status === "pm_review" && myOrigin === "pm" && (
            <>
              <Button variant="outline" size="sm" data-testid="boq-return" onClick={() => void handoff("draft")}>
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
                {p.boqReturnToDraft}
              </Button>
              <Button size="sm" data-testid="boq-approve" onClick={() => void handoff("ready")}>
                <CheckCheck className="size-4" aria-hidden />
                {p.boqApprove}
              </Button>
            </>
          )}
        </div>
      </div>

      {!canEdit && (
        <p className="mb-3 rounded-md bg-surface-1 px-3 py-2 text-[12.5px] text-hni-grey-dark" data-testid="boq-waiting">
          {current.status === "imported"
            ? p.boqImportedNote
            : p.boqWaiting.replace("{status}", statusLabel(current.status))}
        </p>
      )}

      {current.context.programs.map((program) => {
        const lines = current.lines.filter((l) => l.programId === program.id);
        return (
          <section key={program.id} className="mb-4 overflow-hidden rounded-lg border border-line-1 bg-surface-0">
            <div className="flex flex-wrap items-center gap-3 border-b border-line-1 bg-surface-1 px-3 py-2">
              <span className="text-[13.5px] font-semibold text-hni-black">{program.name}</span>
              <span className="text-[12px] text-hni-grey-dark">
                {program.days > 0 && `${program.days} ${p.days}`}
                {program.participants > 0 && ` · ${program.participants} ${p.participants}`}
                {program.city && ` · ${program.city}`}
              </span>
              <bdi className="tabular ms-auto text-[13px] font-semibold text-hni-black">
                {money(totals.byProgram.get(program.id) ?? 0)}
              </bdi>
            </div>
            {/* min-w + scroll: same phone fix as CostTable — fixed numeric
                columns must never squeeze the inputs into clipping digits. */}
            <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-[13px]">
              <thead>
                <tr className="border-b border-line-1 text-[11px] uppercase tracking-wide text-hni-grey-dark">
                  <th className="px-3 py-1.5 text-start font-medium">{p.lineLabel}</th>
                  <th className="w-16 px-2 py-1.5 text-end font-medium sm:w-20">{p.qty}</th>
                  <th className="w-24 px-2 py-1.5 text-end font-medium sm:w-32">{p.unitRate}</th>
                  <th className="w-28 px-2 py-1.5 text-end font-medium sm:w-32">{p.subtotal}</th>
                  <th className="w-16 px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b border-line-1 last:border-b-0">
                    <td className="px-2 py-1">
                      <span className="flex items-center gap-1.5">
                        <Input
                          value={line.label}
                          disabled={!canEdit}
                          data-testid={`boq-label-${line.id}`}
                          onChange={(e) =>
                            updateLines(current.lines.map((l) => (l.id === line.id ? { ...l, label: e.target.value } : l)))
                          }
                          className="h-8 border-transparent bg-transparent"
                        />
                        <StatusBadge tone={line.origin === "pm" ? "info" : "neutral"}>
                          {lineAdderName(line.origin, current, (id) => store.profiles.find((x) => x.id === id)?.displayName ?? "—")}
                        </StatusBadge>
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      <Input
                        type="number"
                        min={0}
                        value={line.qty}
                        disabled={!canEdit}
                        onChange={(e) =>
                          updateLines(
                            current.lines.map((l) => (l.id === line.id ? { ...l, qty: Number(e.target.value) || 0 } : l)),
                          )
                        }
                        className="tabular h-8 border-transparent bg-transparent text-end"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <MoneyInput
                        value={line.unitRate || null}
                        disabled={!canEdit}
                        onValue={(n) =>
                          updateLines(current.lines.map((l) => (l.id === line.id ? { ...l, unitRate: n ?? 0 } : l)))
                        }
                        className="tabular h-8 border-transparent bg-transparent text-end"
                      />
                    </td>
                    <td className="tabular px-3 py-1 text-end text-hni-grey-dark">
                      <bdi>{money(Math.round(Math.max(0, line.qty) * Math.max(0, line.unitRate)))}</bdi>
                    </td>
                    <td className="px-2 py-1 text-end">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
                          aria-label={p.removeLine}
                          onClick={() => updateLines(current.lines.filter((l) => l.id !== line.id))}
                        >
                          <Trash2 className="size-3.5" aria-hidden />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {canEdit && (
              <button
                type="button"
                className="flex w-full items-center gap-1 px-3 py-2 text-[12.5px] font-medium text-hni-magenta hover:bg-surface-1"
                data-testid={`boq-add-line-${program.id}`}
                onClick={() => updateLines([...current.lines, newBoqLine(program.id, myOrigin)])}
              >
                <Plus className="size-3.5" aria-hidden />
                {p.addLine}
              </button>
            )}
          </section>
        );
      })}

      <div className="flex items-center justify-between rounded-lg border border-line-1 bg-surface-0 px-4 py-3">
        <span className="text-[13.5px] font-semibold text-hni-black">{p.boqTotalCost}</span>
        <bdi className="tabular text-[16px] font-bold text-hni-black" data-testid="boq-total">
          {money(totals.total)}
        </bdi>
      </div>
      {current.status === "pm_review" && myOrigin === "pm" && (
        <p className="mt-2 flex items-center gap-1 text-[12px] text-hni-grey-dark">
          <RotateCcw className="size-3.5" aria-hidden />
          {p.boqPmHint}
        </p>
      )}
    </div>
  );
}
