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
  /**
   * Probability-weighted GP (user rule 2026-08-31): probability x value x GP%.
   * Won is always 100%, Lost 0%, open stages use the typed probability with
   * empty meaning 0%. Null only when the row has no GP basis (excluded rows).
   * Dashboard-only: the sheet export keeps plain GP for sheet compatibility.
   */
  weightedGp: number | null;
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

function weightedGpOf(stage: string, winningProbability: number | null, gpAmount: number | null): number | null {
  if (gpAmount == null) return null;
  const prob = stage === "Won" ? 100 : stage === "Lost" ? 0 : (winningProbability ?? 0);
  return Math.round((gpAmount * prob) / 100);
}

export function buildRows(proposals: Proposal[], externals: ExternalDeal[]): PipelineRowData[] {
  const rows: PipelineRowData[] = [];
  for (const p of proposals) {
    if (!inPipeline(p)) continue;
    const result = calc(p);
    // Reported GP is BD's call: a manual override beats the costing-derived
    // margin; without one, the derived margin IS the actual.
    const override = p.pipeline.gpPctOverride;
    const gpPct = override ?? result.marginPct;
    const gpAmount = override != null ? Math.round((result.netPrice * override) / 100) : result.marginAmount;
    rows.push({
      kind: "proposal",
      id: p.id,
      company: p.clientName,
      projectName: p.title,
      stage: p.pipeline.stage!,
      winningProbability: p.pipeline.winningProbability ?? null,
      value: result.netPrice,
      gpAmount,
      gpPct,
      weightedGp: weightedGpOf(p.pipeline.stage!, p.pipeline.winningProbability ?? null, gpAmount),
      effectiveDate: p.pipeline.decidedAt ?? p.date ?? null,
      dateDefaulted: !p.pipeline.decidedAt && (p.pipeline.stage === "Won" || p.pipeline.stage === "Lost"),
      excluded: false,
      proposal: p,
    });
  }
  for (const d of externals) {
    const excluded = Boolean(d.flags.badValue || d.flags.nonSar);
    const extGpAmount = excluded ? null : dealGpAmount(d.dealValue, d.gpPct, d.gpAmount);
    rows.push({
      kind: "external",
      id: d.id,
      company: d.company,
      projectName: d.projectName,
      stage: d.stage,
      winningProbability: d.winningProbability,
      value: excluded ? null : d.dealValue,
      gpAmount: extGpAmount,
      gpPct: d.gpPct,
      weightedGp: weightedGpOf(d.stage, d.winningProbability, extGpAmount),
      effectiveDate: d.flags.badDate ? null : d.date || null,
      dateDefaulted: !d.flags.badDate && d.stage === "Won",
      excluded,
      external: d,
    });
  }
  return rows;
}

export type BookedShare = {
  wonValue: number;
  openValue: number;
  wonCount: number;
  openCount: number;
  /** Integer percent of pipeline value already Won; 0 when the pipeline is empty, never NaN. */
  pct: number;
};

/**
 * Composition snapshot for the Booked-projects bar: Won value as a share of
 * (Won + open) pipeline value. Deliberately period-INDEPENDENT (design:
 * docs/designs/pipeline-goal-visuals.md premise 3): computeTotals
 * period-filters achieved but not open, so a period-scoped share would mix
 * scopes. Excluded rows (bad value / non-SAR) and Lost stay out.
 */
export function bookedShare(rows: PipelineRowData[]): BookedShare {
  let wonValue = 0;
  let openValue = 0;
  let wonCount = 0;
  let openCount = 0;
  for (const row of rows) {
    if (row.excluded || row.value === null) continue;
    if (row.stage === "Won") {
      wonValue += row.value;
      wonCount++;
    } else if ((OPEN_STAGES as readonly string[]).includes(row.stage)) {
      openValue += row.value;
      openCount++;
    }
  }
  const total = wonValue + openValue;
  return { wonValue, openValue, wonCount, openCount, pct: total > 0 ? Math.round((wonValue / total) * 100) : 0 };
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
