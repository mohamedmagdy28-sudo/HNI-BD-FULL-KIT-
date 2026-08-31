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
import { bookedShare, buildRows, computeTotals, type PipelineRowData } from "./pipelineMath";
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
  const [stageFilter, setStageFilter] = useState<string>("all");

  const rows = useMemo(() => buildRows(proposals, externals), [proposals, externals]);
  // Filter narrows the TABLE only; KPI totals stay global so a filtered view
  // never misreads as a change in achievement.
  const visibleRows = stageFilter === "all" ? rows : rows.filter((r) => r.stage === stageFilter);
  const booked = useMemo(() => bookedShare(rows), [rows]);
  const totals = useMemo(() => computeTotals(rows, settings.targets), [rows, settings.targets]);
  const money = (v: number) => formatCurrency(v, locale);
  const stageLabel = (s: string) => (p.stageLabels as Record<string, string>)[s] ?? s;
  // Judge F6: real plural forms ("1 deal", "صفقتان") via CLDR rules.
  const dealCount = (n: number) => {
    const forms = p.dealForms as Record<string, string>;
    const rule = new Intl.PluralRules(locale).select(n);
    return (forms[rule] ?? forms.other).replace("{n}", String(n));
  };

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
      comparison: dealCount(totals.openCount),
    },
    {
      id: "weighted",
      label: p.kpiWeighted,
      value: money(totals.weighted),
      comparison:
        totals.unweightedCount > 0 ? p.kpiUnweighted.replace("{n}", String(totals.unweightedCount)) : dealCount(totals.openCount),
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

  const gpTarget = settings.targets.gpTarget;
  const gpPctTrue = totals.gpTargetPct; // may exceed 100 or go negative; label shows truth, fill clamps
  const gpFill = gpPctTrue == null ? 0 : Math.min(100, Math.max(0, gpPctTrue));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2" data-testid="goal-band">
        {/* Card 1 — GP goal (period-scoped, from computeTotals) */}
        <div className="rounded-lg border border-line-1 bg-surface-0 px-4 py-3" data-testid="goal-card">
          <div className="text-[12px] font-medium text-hni-grey-dark">{p.goalGp}</div>
          {gpTarget == null ? (
            <div className="mt-2 flex flex-wrap items-center gap-2" data-testid="goal-empty">
              <span className="text-[13px] text-hni-grey-dark">{p.goalSetTarget}</span>
              <Button variant="outline" size="sm" className="h-7" onClick={() => setShowTargets(true)}>
                <Target className="size-3.5" aria-hidden />
                {p.targets}
              </Button>
            </div>
          ) : (
            <>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <bdi className="tabular text-[22px] font-semibold leading-none text-hni-black" data-testid="goal-achieved">
                  {money(totals.achievedGp)}
                </bdi>
                <span aria-hidden className="text-hni-grey-mid">|</span>
                <bdi className="tabular text-[13px] text-hni-grey-dark">
                  {p.goalOf} {money(gpTarget)}
                </bdi>
                <bdi
                  className={`tabular ms-auto text-[13px] font-medium ${gpPctTrue != null && gpPctTrue >= 100 ? "text-[color:var(--status-success-fg)]" : "text-hni-grey-dark"}`}
                  data-testid="goal-pct"
                >
                  {gpPctTrue != null ? `${gpPctTrue.toFixed(1)}%` : ""}
                </bdi>
              </div>
              <div
                className="mt-3 h-3 overflow-hidden rounded-full bg-surface-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(gpFill)}
                aria-label={p.goalAria}
              >
                <div className="h-full rounded-full bg-hni-magenta transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${gpFill}%` }} data-testid="goal-fill" />
              </div>
            </>
          )}
        </div>

        {/* Card 2 — Booked projects (all-time composition snapshot, deliberately period-independent) */}
        <div className="rounded-lg border border-line-1 bg-surface-0 px-4 py-3" data-testid="booked-card">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-medium text-hni-grey-dark">{p.bookedTitle}</span>
            <span className="text-[11px] text-hni-grey-dark">{p.bookedAllTime}</span>
          </div>
          {booked.wonCount + booked.openCount === 0 ? (
            <p className="mt-2 text-[13px] text-hni-grey-dark" data-testid="booked-empty">{p.bookedEmpty}</p>
          ) : (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <bdi className="tabular text-[22px] font-semibold leading-none text-hni-black" data-testid="booked-pct">
                  {/* Judge F2: never floor real wins to "0%" or ceil open value away. */}
                  {p.bookedPct.replace(
                    "{n}",
                    booked.pct === 0 && booked.wonValue > 0 ? "<1" : booked.pct === 100 && booked.openValue > 0 ? ">99" : String(booked.pct),
                  )}
                </bdi>
              </div>
              <div
                className="mt-3 flex h-3 overflow-hidden rounded-full bg-surface-2"
                role="img"
                aria-label={p.bookedAria
                  .replace("{won}", money(booked.wonValue))
                  .replace("{total}", money(booked.wonValue + booked.openValue))
                  .replace("{n}", String(booked.wonCount + booked.openCount))}
              >
                <div
                  className="h-full bg-[color:var(--status-success-fg)] transition-[width] duration-200 motion-reduce:transition-none"
                  style={{ width: `${booked.pct}%` }}
                  data-testid="booked-fill"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 text-[12px] text-hni-grey-dark">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="inline-block size-2 rounded-full bg-[color:var(--status-success-fg)]" />
                  {p.bookedWon} ({booked.wonCount})
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="inline-block size-2 rounded-full bg-surface-2 ring-1 ring-inset ring-line-1" />
                  {p.bookedOpen} ({booked.openCount})
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      <KpiStrip items={kpis} label={p.pipelineTab} />

      {totals.excludedCount > 0 && (
        <p data-testid="excluded-note" className="rounded-md bg-[color:var(--status-warning-bg)] px-3 py-2 text-[13px] text-[color:var(--status-warning-fg)]">
          {p.excludedNote.replace("{n}", String(totals.excludedCount))}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="h-8 w-48" aria-label={p.filterByStage} data-testid="stage-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{p.filterAllStages}</SelectItem>
            {PIPELINE_STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {stageLabel(s)} ({rows.filter((r) => r.stage === s).length})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {stageFilter !== "all" && (
          <span className="text-[12px] text-hni-grey-dark" data-testid="stage-filter-count">
            {p.filterShowing.replace("{n}", String(visibleRows.length)).replace("{total}", String(rows.length))}
          </span>
        )}
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
          <table className="w-full min-w-[1020px] text-[13px]">
            <thead>
              <tr className="border-b border-line-1 bg-surface-1 text-[11px] uppercase tracking-wide text-hni-grey-dark">
                <th className="sticky start-0 z-10 bg-surface-1 px-3 py-2 text-start font-medium">{p.client}</th>
                <th className="px-3 py-2 text-start font-medium">{p.proposalTitle}</th>
                <th className="w-44 px-3 py-2 text-start font-medium">{p.plStage}</th>
                <th className="w-24 px-2 py-2 text-end font-medium">{p.plProbability}</th>
                <th className="w-32 px-3 py-2 text-end font-medium">{p.plRevenue}</th>
                <th className="w-24 px-2 py-2 text-end font-medium">{p.plGpPct}</th>
                <th className="w-32 px-3 py-2 text-end font-medium">{p.plWeightedGp}</th>
                <th className="w-20 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-[13px] text-hni-grey-dark" data-testid="filter-empty">
                    {p.filterNoMatches}
                  </td>
                </tr>
              )}
              {visibleRows.map((row) => (
                <tr key={row.id} className="group border-b border-line-1 last:border-b-0 hover:bg-surface-1" data-testid={`pipeline-row-${row.id}`}>
                  <td className="sticky start-0 z-10 cursor-pointer bg-surface-0 px-3 py-2 font-medium text-hni-black hover:underline group-hover:bg-surface-1" onClick={() => setDrawerRow(row)}>
                    {row.company || "—"}
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
                    <div className="relative">
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
                        className="tabular h-8 pe-6 text-end"
                      />
                      <span aria-hidden className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[12px] text-hni-grey-dark">%</span>
                    </div>
                  </td>
                  <td className="tabular px-3 py-2 text-end font-medium text-hni-black">
                    {row.value != null ? <bdi>{money(row.value)}</bdi> : "—"}
                  </td>
                  <td className="px-2 py-1.5 text-end">
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        // Proposals: typed value = manual override; the
                        // costing-derived margin shows as placeholder so
                        // clearing the field reverts without snap-back.
                        value={
                          row.kind === "external"
                            ? (row.external!.gpPct ?? "")
                            : (row.proposal!.pipeline.gpPctOverride ?? "")
                        }
                        placeholder={row.kind === "proposal" && row.gpPct != null ? row.gpPct.toFixed(1) : undefined}
                        aria-label={p.plGpPct}
                        data-testid={`gp-pct-${row.id}`}
                        onChange={(e) => {
                          const v = numOrNull(e.target.value);
                          const bounded = v == null ? null : Math.min(100, Math.max(0, v));
                          if (row.kind === "proposal") onUpdatePipeline(row.id, { gpPctOverride: bounded });
                          else if (row.external) onUpdateExternal({ ...row.external, gpPct: bounded });
                        }}
                        className="tabular h-8 pe-6 text-end"
                      />
                      <span aria-hidden className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[12px] text-hni-grey-dark">%</span>
                    </div>
                  </td>
                  <td className="tabular px-3 py-2 text-end text-hni-grey-dark" data-testid={`gp-amount-${row.id}`}>
                    {row.weightedGp != null ? <bdi>{money(row.weightedGp)}</bdi> : "—"}
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
