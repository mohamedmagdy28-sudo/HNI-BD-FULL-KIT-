import { useMemo, useRef, useState } from "react";
import { ClipboardCopy, Download, Target, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailSheet } from "@/components/app/DetailSheet";
import { KpiStrip, type Kpi } from "@/components/app/KpiStrip";
import { EmptyState } from "@/components/app/States";
import { StatusBadge, type Tone } from "@/components/app/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, useI18n } from "@/lib/i18n";
import {
  externalSheetRow,
  isNewSinceLastCopy,
  parsePipelineCsv,
  parsePipelineRows,
  SHEET_HEADERS,
  proposalSheetRow,
  toCsv,
  toTsv,
} from "./pipelineCsv";
import { buildRows, computeTotals, type PipelineRowData } from "./pipelineMath";
import { calc } from "./calc";
import {
  inPipeline,
  PIPELINE_STAGES,
  type ExternalDeal,
  type PipelineInfo,
  type PipelineStage,
  type Proposal,
  type Settings,
  type Targets,
} from "./types";

type Props = {
  proposals: Proposal[];
  externals: ExternalDeal[];
  settings: Settings;
  onUpdatePipeline: (proposalId: string, patch: Partial<PipelineInfo>) => void;
  onStampCopied: (proposalIds: string[]) => void;
  onReplaceExternals: (deals: ExternalDeal[]) => void;
  onDeleteExternal: (id: string) => void;
  onUpdateExternal: (deal: ExternalDeal) => void;
  onUpdateTargets: (targets: Targets) => void;
  onOpenProposal: (id: string) => void;
};

const STAGE_TONE: Record<string, Tone> = {
  Proposal: "info",
  "Initial Negotiation": "neutral",
  "Final Negotiation": "warning",
  "Verbal Awarding": "warning",
  Won: "success",
  Lost: "danger",
};

function numOrNull(v: string): number | null {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
}

export function PipelineTab({
  proposals,
  externals,
  settings,
  onUpdatePipeline,
  onStampCopied,
  onReplaceExternals,
  onDeleteExternal,
  onUpdateExternal,
  onUpdateTargets,
  onOpenProposal,
}: Props) {
  const { t, locale } = useI18n();
  const p = t.pricing;
  const { toast } = useToast();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [drawerRow, setDrawerRow] = useState<PipelineRowData | null>(null);
  const [showTargets, setShowTargets] = useState(false);

  const rows = useMemo(() => buildRows(proposals, externals), [proposals, externals]);
  const totals = useMemo(() => computeTotals(rows, settings.targets), [rows, settings.targets]);
  const money = (v: number) => formatCurrency(v, locale);
  const stageLabel = (s: string) => (p.stageLabels as Record<string, string>)[s] ?? s;

  // Rebind the drawer to fresh data after edits.
  const liveDrawerRow = drawerRow ? (rows.find((r) => r.id === drawerRow.id) ?? null) : null;

  const kpis: Kpi[] = [
    {
      id: "achieved-rev",
      label: p.kpiAchievedRev,
      value: money(totals.achievedRevenue),
      delta: totals.revenueTargetPct != null ? `${totals.revenueTargetPct.toFixed(1)}%` : undefined,
      deltaSign: totals.revenueTargetPct != null ? (totals.revenueTargetPct >= 100 ? 1 : 0) : 0,
      comparison: totals.revenueTargetPct != null ? p.kpiOfTarget : p.kpiSetTargets,
    },
    {
      id: "achieved-gp",
      label: p.kpiAchievedGp,
      value: money(totals.achievedGp),
      delta: totals.gpTargetPct != null ? `${totals.gpTargetPct.toFixed(1)}%` : undefined,
      deltaSign: totals.gpTargetPct != null ? (totals.gpTargetPct >= 100 ? 1 : 0) : 0,
      comparison: totals.gpTargetPct != null ? p.kpiOfTarget : p.kpiSetTargets,
    },
    {
      id: "open",
      label: p.kpiOpen,
      value: money(totals.openRevenue),
      comparison: `${totals.openCount} ${p.kpiDeals}`,
    },
    {
      id: "weighted",
      label: p.kpiWeighted,
      value: money(totals.weighted),
      comparison:
        totals.unweightedCount > 0 ? p.kpiUnweighted.replace("{n}", String(totals.unweightedCount)) : `${totals.openCount} ${p.kpiDeals}`,
    },
  ];

  const copyRows = async (mode: "new" | "allApp" | "allIncl") => {
    const appRows = proposals.filter((x) => inPipeline(x)).filter((x) => (mode === "new" ? isNewSinceLastCopy(x) : true));
    const lines: string[][] = appRows.map((x) => proposalSheetRow(x, calc(x), settings.targets));
    if (mode === "allIncl") for (const d of externals) lines.push(externalSheetRow(d));
    if (lines.length === 0) {
      toast({ title: p.nothingToCopy });
      return;
    }
    try {
      await navigator.clipboard.writeText(toTsv(lines));
      onStampCopied(appRows.map((x) => x.id));
      toast({ title: p.copiedRows.replace("{n}", String(lines.length)) });
    } catch {
      toast({ title: p.exportError, variant: "destructive" });
    }
  };

  const downloadCsv = () => {
    const lines = proposals.filter(inPipeline).map((x) => proposalSheetRow(x, calc(x), settings.targets));
    const blob = new Blob([toCsv(lines)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hni-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    try {
      // Branch on the ZIP magic bytes (PK), not the extension: a renamed
      // Google Sheets download still imports. Anything else parses as CSV.
      const head = new Uint8Array((await file.slice(0, 2).arrayBuffer()) ?? new ArrayBuffer(0));
      let parsed;
      if (head[0] === 0x50 && head[1] === 0x4b) {
        const { parseXlsxGrid } = await import("./xlsx");
        // Header hints steer multi-sheet workbooks to the pipeline tab, not
        // whichever sheet happens to be first (hidden archives included).
        parsed = parsePipelineRows(await parseXlsxGrid(await file.arrayBuffer(), SHEET_HEADERS), proposals);
      } else {
        parsed = parsePipelineCsv(await file.text(), proposals);
      }
      const { deals, report } = parsed;
      if (report.imported === 0) {
        toast({ title: p.importFailed, variant: "destructive" });
        return;
      }
      if (externals.length > 0 && !window.confirm(p.importReplaceWarn)) return;
      onReplaceExternals(deals);
      toast({ title: p.importDone.replace("{n}", String(report.imported)) });
      if (report.possibleDuplicates.length > 0) {
        toast({ title: p.importDuplicates.replace("{n}", String(report.possibleDuplicates.length)) });
      }
    } catch {
      toast({ title: p.importFailed, variant: "destructive" });
    }
  };

  const updateDrawerField = (patch: Partial<PipelineInfo>) => {
    if (!liveDrawerRow) return;
    if (liveDrawerRow.kind === "proposal") onUpdatePipeline(liveDrawerRow.id, patch);
    else if (liveDrawerRow.external) {
      const d = liveDrawerRow.external;
      onUpdateExternal({
        ...d,
        source: patch.source ?? d.source,
        dealType: patch.dealType ?? d.dealType,
        sector: patch.sector ?? d.sector,
        primaryService: patch.primaryService ?? d.primaryService,
        stage: (patch.stage ?? d.stage) as ExternalDeal["stage"],
        winningProbability: patch.winningProbability !== undefined ? patch.winningProbability : d.winningProbability,
        deliveryStart: patch.deliveryStart ?? d.deliveryStart,
        deliveryEnd: patch.deliveryEnd ?? d.deliveryEnd,
        poNumber: patch.poNumber ?? d.poNumber,
        projectStatus: patch.projectStatus ?? d.projectStatus,
        notes: patch.notes ?? d.notes,
      });
    }
  };

  const drawerValue = (field: keyof PipelineInfo): string => {
    if (!liveDrawerRow) return "";
    if (liveDrawerRow.kind === "proposal") {
      const v = liveDrawerRow.proposal!.pipeline[field];
      return v == null ? "" : String(v);
    }
    const d = liveDrawerRow.external!;
    const map: Record<string, string> = {
      source: d.source,
      dealType: d.dealType,
      sector: d.sector,
      primaryService: d.primaryService,
      deliveryStart: d.deliveryStart,
      deliveryEnd: d.deliveryEnd,
      poNumber: d.poNumber,
      projectStatus: d.projectStatus,
      notes: d.notes,
      winningProbability: d.winningProbability == null ? "" : String(d.winningProbability),
      decidedAt: "",
      stage: d.stage,
    };
    return map[field] ?? "";
  };

  const suggestions = (field: "source" | "dealType" | "sector" | "primaryService"): string[] => {
    const values = new Set<string>();
    for (const r of rows) {
      const v = r.kind === "proposal" ? r.proposal!.pipeline[field] : (r.external![field] as string);
      if (v) values.add(v);
    }
    return [...values].slice(0, 20);
  };

  const setStage = (row: PipelineRowData, stage: PipelineStage) => {
    if (row.kind === "proposal") {
      const pl = row.proposal!.pipeline;
      const decided = stage === "Won" || stage === "Lost";
      onUpdatePipeline(row.id, {
        stage,
        // Auto-stamp on decide; clear on revert; never overwrite a manual date (T3.3).
        decidedAt: decided ? (pl.decidedAt ?? new Date().toISOString().slice(0, 10)) : null,
      });
    } else if (row.external) {
      onUpdateExternal({ ...row.external, stage });
    }
  };

  const targetField = (labelKey: string, field: keyof Targets, type: "date" | "number") => (
    <label className="w-40">
      <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{labelKey}</span>
      <Input
        type={type}
        value={settings.targets[field] ?? ""}
        data-testid={`target-${field}`}
        onChange={(e) =>
          onUpdateTargets({
            ...settings.targets,
            [field]: type === "number" ? numOrNull(e.target.value) : e.target.value || null,
          })
        }
        className="tabular mt-1 h-8"
      />
    </label>
  );

  return (
    <div className="space-y-4">
      <KpiStrip items={kpis} label={p.pipelineTab} />

      {totals.excludedCount > 0 && (
        <p data-testid="excluded-note" className="rounded-md bg-[color:var(--status-warning-bg)] px-3 py-2 text-[13px] text-[color:var(--status-warning-fg)]">
          {p.excludedNote.replace("{n}", String(totals.excludedCount))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" data-testid="targets-toggle" aria-pressed={showTargets} onClick={() => setShowTargets((v) => !v)}>
          <Target className="size-4" aria-hidden />
          {p.targets}
        </Button>
        <div className="ms-auto flex flex-wrap items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" data-testid="copy-rows">
                <ClipboardCopy className="size-4" aria-hidden />
                {p.copyRows}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem data-testid="copy-new" onSelect={() => void copyRows("new")}>{p.copyNew}</DropdownMenuItem>
              <DropdownMenuItem data-testid="copy-all-app" onSelect={() => void copyRows("allApp")}>{p.copyAllApp}</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyRows("allIncl")}>{p.copyAllIncl}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download className="size-4" aria-hidden />
            {p.downloadCsv}
          </Button>
          <Button variant="outline" size="sm" data-testid="import-csv" onClick={() => importInputRef.current?.click()}>
            <Upload className="size-4" aria-hidden />
            {p.importCsv}
          </Button>
        </div>
      </div>
      <input
        ref={importInputRef}
        type="file"
        accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        aria-hidden
        tabIndex={-1}
        data-testid="import-csv-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void importCsv(file);
        }}
      />

      {showTargets && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line-1 bg-surface-0 p-3">
          {targetField(p.periodStartLabel, "periodStart", "date")}
          {targetField(p.periodEndLabel, "periodEnd", "date")}
          {targetField(p.revenueTargetLabel, "revenueTarget", "number")}
          {targetField(p.gpTargetLabel, "gpTarget", "number")}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title={p.pipelineEmptyTitle} body={p.pipelineEmptyBody} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line-1 bg-surface-0">
          <table className="w-full min-w-[900px] text-[13px]">
            <thead>
              <tr className="border-b border-line-1 bg-surface-1 text-[11px] uppercase tracking-wide text-hni-grey-dark">
                <th className="px-3 py-2 text-start font-medium">{p.client}</th>
                <th className="px-3 py-2 text-start font-medium">{p.proposalTitle}</th>
                <th className="w-44 px-3 py-2 text-start font-medium">{p.plStage}</th>
                <th className="w-24 px-2 py-2 text-end font-medium">{p.plProbability}</th>
                <th className="w-32 px-3 py-2 text-end font-medium">{p.netPrice}</th>
                <th className="w-32 px-3 py-2 text-end font-medium">{p.margin}</th>
                <th className="w-20 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line-1 last:border-b-0 hover:bg-surface-1" data-testid={`pipeline-row-${row.id}`}>
                  <td className="cursor-pointer px-3 py-2 font-medium text-hni-black" onClick={() => setDrawerRow(row)}>
                    {row.company || "—"}
                    {row.kind === "external" && (
                      <span className="ms-2"><StatusBadge tone="neutral">{p.externalTag}</StatusBadge></span>
                    )}
                  </td>
                  <td className="cursor-pointer px-3 py-2 text-hni-grey-dark" onClick={() => setDrawerRow(row)}>
                    {row.projectName || "—"}
                    {row.dateDefaulted && row.stage === "Won" && (
                      <span className="ms-2 text-[11px] text-[color:var(--status-warning-fg)]">{p.dateEstimated}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5">
                    <Select value={row.stage || undefined} onValueChange={(v) => setStage(row, v as PipelineStage)}>
                      <SelectTrigger className="h-8" aria-label={p.plStage} data-testid={`stage-${row.id}`}>
                        <SelectValue placeholder={p.plNoStage}>
                          {row.stage ? <StatusBadge tone={STAGE_TONE[row.stage] ?? "neutral"}>{stageLabel(row.stage)}</StatusBadge> : p.plNoStage}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STAGES.map((s) => (
                          <SelectItem key={s} value={s}>{stageLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={row.winningProbability ?? ""}
                      aria-label={p.plProbability}
                      data-testid={`prob-${row.id}`}
                      onChange={(e) => {
                        const v = numOrNull(e.target.value);
                        const bounded = v == null ? undefined : Math.min(100, Math.max(0, Math.trunc(v)));
                        if (row.kind === "proposal") onUpdatePipeline(row.id, { winningProbability: bounded });
                        else if (row.external) onUpdateExternal({ ...row.external, winningProbability: bounded ?? null });
                      }}
                      className="tabular h-8 text-end"
                    />
                  </td>
                  <td className="tabular px-3 py-2 text-end font-medium text-hni-black">
                    {row.value != null ? <bdi>{money(row.value)}</bdi> : "—"}
                  </td>
                  <td className="tabular px-3 py-2 text-end text-hni-grey-dark">
                    {row.gpAmount != null ? <bdi>{money(row.gpAmount)}</bdi> : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-end">
                    {row.kind === "external" ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
                        aria-label={p.deleteDeal}
                        onClick={() => onDeleteExternal(row.id)}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[12px] text-hni-magenta hover:text-hni-magenta" onClick={() => onOpenProposal(row.id)}>
                        {p.docsViewCosting}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DetailSheet
        open={liveDrawerRow !== null}
        onOpenChange={(open) => !open && setDrawerRow(null)}
        title={liveDrawerRow ? `${liveDrawerRow.company || "—"} · ${liveDrawerRow.projectName || "—"}` : ""}
        description={p.dealDetails}
      >
        {liveDrawerRow && (
          <div className="space-y-3" data-testid="deal-drawer">
            {(
              [
                ["source", p.plSource],
                ["dealType", p.plDealType],
                ["sector", p.plSector],
                ["primaryService", p.plPrimaryService],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{label}</span>
                <Input
                  value={drawerValue(field)}
                  list={`sugg-${field}`}
                  data-testid={`drawer-${field}`}
                  onChange={(e) => updateDrawerField({ [field]: e.target.value })}
                  className="mt-1 h-8"
                />
                <datalist id={`sugg-${field}`}>
                  {suggestions(field).map((v) => (
                    <option key={v} value={v} />
                  ))}
                </datalist>
              </label>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.plDeliveryStart}</span>
                <Input type={liveDrawerRow.kind === "proposal" ? "date" : "text"} value={drawerValue("deliveryStart")} onChange={(e) => updateDrawerField({ deliveryStart: e.target.value })} className="tabular mt-1 h-8" />
              </label>
              <label className="block">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.plDeliveryEnd}</span>
                <Input type={liveDrawerRow.kind === "proposal" ? "date" : "text"} value={drawerValue("deliveryEnd")} onChange={(e) => updateDrawerField({ deliveryEnd: e.target.value })} className="tabular mt-1 h-8" />
              </label>
            </div>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.plPoNumber}</span>
              <Input value={drawerValue("poNumber")} onChange={(e) => updateDrawerField({ poNumber: e.target.value })} className="mt-1 h-8" />
            </label>
            {liveDrawerRow.kind === "proposal" && (
              <label className="block">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.plDecidedOn}</span>
                <Input type="date" value={drawerValue("decidedAt")} data-testid="drawer-decidedAt" onChange={(e) => updateDrawerField({ decidedAt: e.target.value || null })} className="tabular mt-1 h-8" />
              </label>
            )}
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.plProjectStatus}</span>
              <Input value={drawerValue("projectStatus")} onChange={(e) => updateDrawerField({ projectStatus: e.target.value })} className="mt-1 h-8" />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.plNotes}</span>
              <Input value={drawerValue("notes")} data-testid="drawer-notes" onChange={(e) => updateDrawerField({ notes: e.target.value })} className="mt-1 h-8" />
            </label>
          </div>
        )}
      </DetailSheet>
    </div>
  );
}
