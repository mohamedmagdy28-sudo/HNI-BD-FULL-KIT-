// Pure dashboard aggregation (design: docs/designs/pipeline.md).
//
//   achieved  = Won deals, decided (or dated) inside the target period
//   open      = Proposal / Initial Negotiation / Final Negotiation / Verbal Awarding
//   weighted  = sum(value x winningProbability/100) over open deals
//
// Rows excluded from sums (bad value, non-SAR, bad date when a period is set)
// are COUNTED and surfaced, never silently dropped (eng review T3.1/T3.8).

import { calc } from "./calc";
import { dealGpAmount, inPipeline, OPEN_STAGES, type ExternalDeal, type Proposal, type Targets } from "./types";

export type PipelineRowData = {
  kind: "proposal" | "external";
  id: string;
  company: string;
  projectName: string;
  stage: string;
  winningProbability: number | null;
  /** Net value in SAR; null when excluded from sums. */
  value: number | null;
  gpAmount: number | null;
  gpPct: number | null;
  /** ISO date driving period attribution; null = excluded from period math. */
  effectiveDate: string | null;
  /** Achieved date was defaulted (imports without a parseable decided date), flagged on the dashboard (T3.2). */
  dateDefaulted: boolean;
  excluded: boolean;
  proposal?: Proposal;
  external?: ExternalDeal;
};

export type PipelineTotals = {
  achievedRevenue: number;
  achievedGp: number;
  achievedCount: number;
  openRevenue: number;
  openGp: number;
  openCount: number;
  weighted: number;
  /** Open deals without a probability: visible companion count, not silently zero (T3.8). */
  unweightedCount: number;
  /** Rows excluded from sums (bad value / non-SAR / out-of-period-unknown date on Won). */
  excludedCount: number;
  revenueTargetPct: number | null;
  gpTargetPct: number | null;
};

export function buildRows(proposals: Proposal[], externals: ExternalDeal[]): PipelineRowData[] {
  const rows: PipelineRowData[] = [];
  for (const p of proposals) {
    if (!inPipeline(p)) continue;
    const result = calc(p);
    rows.push({
      kind: "proposal",
      id: p.id,
      company: p.clientName,
      projectName: p.title,
      stage: p.pipeline.stage!,
      winningProbability: p.pipeline.winningProbability ?? null,
      value: result.netPrice,
      gpAmount: result.marginAmount,
      gpPct: result.marginPct,
      effectiveDate: p.pipeline.decidedAt ?? p.date ?? null,
      dateDefaulted: !p.pipeline.decidedAt && (p.pipeline.stage === "Won" || p.pipeline.stage === "Lost"),
      excluded: false,
      proposal: p,
    });
  }
  for (const d of externals) {
    const excluded = Boolean(d.flags.badValue || d.flags.nonSar);
    rows.push({
      kind: "external",
      id: d.id,
      company: d.company,
      projectName: d.projectName,
      stage: d.stage,
      winningProbability: d.winningProbability,
      value: excluded ? null : d.dealValue,
      gpAmount: excluded ? null : dealGpAmount(d.dealValue, d.gpPct, d.gpAmount),
      gpPct: d.gpPct,
      effectiveDate: d.flags.badDate ? null : d.date || null,
      dateDefaulted: !d.flags.badDate && d.stage === "Won",
      excluded,
      external: d,
    });
  }
  return rows;
}

function inPeriod(dateIso: string | null, targets: Targets): boolean {
  if (!targets.periodStart && !targets.periodEnd) return true;
  if (dateIso === null) return false;
  // Inclusive on both boundary days.
  if (targets.periodStart && dateIso < targets.periodStart) return false;
  if (targets.periodEnd && dateIso > targets.periodEnd) return false;
  return true;
}

export function computeTotals(rows: PipelineRowData[], targets: Targets): PipelineTotals {
  let achievedRevenue = 0;
  let achievedGp = 0;
  let achievedCount = 0;
  let openRevenue = 0;
  let openGp = 0;
  let openCount = 0;
  let weighted = 0;
  let unweightedCount = 0;
  let excludedCount = 0;

  for (const row of rows) {
    if (row.excluded || row.value === null) {
      if (row.stage !== "" && row.stage !== "Lost") excludedCount++;
      continue;
    }
    if (row.stage === "Won") {
      if (!inPeriod(row.effectiveDate, targets)) {
        if (row.effectiveDate === null) excludedCount++;
        continue;
      }
      achievedRevenue += row.value;
      achievedGp += row.gpAmount ?? 0;
      achievedCount++;
    } else if ((OPEN_STAGES as readonly string[]).includes(row.stage)) {
      openRevenue += row.value;
      openGp += row.gpAmount ?? 0;
      openCount++;
      if (row.winningProbability != null) weighted += Math.round((row.value * row.winningProbability) / 100);
      else unweightedCount++;
    }
  }

  return {
    achievedRevenue,
    achievedGp,
    achievedCount,
    openRevenue,
    openGp,
    openCount,
    weighted,
    unweightedCount,
    excludedCount,
    revenueTargetPct: targets.revenueTarget ? (achievedRevenue / targets.revenueTarget) * 100 : null,
    gpTargetPct: targets.gpTarget ? (achievedGp / targets.gpTarget) * 100 : null,
  };
}
