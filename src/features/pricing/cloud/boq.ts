// BOQ domain model + pure mapping helpers (design: docs/designs/boq-costing-relay.md).
// The BOQ is its OWN record: delivery roles read/write only this shape and
// never receive pricing data — confidentiality by data absence, not UI hiding.

import { newId, type Program, type Proposal } from "../types";

export type BoqStatus = "draft" | "pm_review" | "ready" | "imported";
export type DeliveryRole = "proposals_team" | "project_manager";
export type AppRole = "member" | "manager" | DeliveryRole;

export type BoqLine = {
  id: string;
  /** Program (phase) this line belongs to; matches a context program id. */
  programId: string;
  label: string;
  qty: number;
  unitRate: number;
  /** Who added the line: proposals team (build) or project manager (ops). */
  origin: "pt" | "pm";
  note?: string;
};

/** Program info the BOQ carries — NO pricing fields, ever. */
export type BoqContextProgram = {
  id: string;
  name: string;
  days: number;
  participants: number;
  city: string;
};

export type BoqContext = {
  title: string;
  /** Client name only when the owner chose to include it in the send drawer. */
  clientName?: string;
  programs: BoqContextProgram[];
};

export type BoqRecord = {
  proposalId: string;
  owner: string;
  ptAssignee: string | null;
  pmAssignee: string | null;
  status: BoqStatus;
  context: BoqContext;
  lines: BoqLine[];
  rev: number;
};

export function isDeliveryRole(role: string | null | undefined): role is DeliveryRole {
  return role === "proposals_team" || role === "project_manager";
}

/**
 * Context seeded by the owner at send-time: program identity only.
 * Pricing fields (markup overrides, discount, schedule…) are stripped by
 * construction — this function only ever copies the five identity fields.
 */
export function seedContext(proposal: Proposal, includeClientName: boolean): BoqContext {
  return {
    title: proposal.title,
    ...(includeClientName && proposal.clientName ? { clientName: proposal.clientName } : {}),
    programs: proposal.programs.map((p) => ({
      id: p.id,
      name: p.name,
      days: p.days,
      participants: p.participants,
      city: p.city,
    })),
  };
}

/** Existing cost lines offered as the BOQ starting point (all tagged 'pt'). */
export function seedLines(proposal: Proposal): BoqLine[] {
  return proposal.programs.flatMap((p) =>
    p.costLines
      .filter((l) => l.label.trim() !== "" || l.unitRate > 0)
      .map((l) => ({
        id: l.id,
        programId: p.id,
        label: l.label,
        qty: Number.isFinite(l.qty) ? Math.max(0, l.qty) : 0,
        unitRate: Number.isFinite(l.unitRate) ? Math.max(0, l.unitRate) : 0,
        origin: "pt" as const,
      })),
  );
}

/**
 * Import at status `ready`: REPLACES each matched program's costLines
 * wholesale (replace, not merge — coherent under the pen model); lines whose
 * programId matches no program land in ONE new section at the end. Origin
 * tags are dropped (CostLine stays untouched); the audit trail lives in the
 * BOQ record. Pricing fields of the proposal are never touched.
 */
export function importBoqLines(proposal: Proposal, boq: BoqRecord, unmatchedSectionName: string): Proposal {
  const byProgram = new Map<string, BoqLine[]>();
  for (const line of boq.lines) {
    const bucket = byProgram.get(line.programId) ?? [];
    bucket.push(line);
    byProgram.set(line.programId, bucket);
  }
  const knownIds = new Set(proposal.programs.map((p) => p.id));
  const programs: Program[] = proposal.programs.map((p) => {
    const lines = byProgram.get(p.id);
    if (!lines) return p;
    return {
      ...p,
      costLines: lines.map((l) => ({ id: l.id, label: l.label, qty: l.qty, unitRate: l.unitRate })),
    };
  });
  const unmatched = boq.lines.filter((l) => !knownIds.has(l.programId));
  if (unmatched.length > 0) {
    programs.push({
      id: newId(),
      name: unmatchedSectionName,
      description: "",
      days: 0,
      participants: 0,
      city: "",
      costLines: unmatched.map((l) => ({ id: l.id, label: l.label, qty: l.qty, unitRate: l.unitRate })),
      markupPct: null,
    });
  }
  return { ...proposal, programs };
}

/** Cost totals for the BOQ editor (pure cost — no pricing derivation exists here). */
export function boqTotals(lines: BoqLine[]): { byProgram: Map<string, number>; total: number } {
  const byProgram = new Map<string, number>();
  let total = 0;
  for (const l of lines) {
    const amount = Math.round(Math.max(0, l.qty) * Math.max(0, l.unitRate));
    byProgram.set(l.programId, (byProgram.get(l.programId) ?? 0) + amount);
    total += amount;
  }
  return { byProgram, total };
}

export function newBoqLine(programId: string, origin: "pt" | "pm"): BoqLine {
  return { id: newId(), programId, label: "", qty: 1, unitRate: 0, origin };
}

/** Whose turn is it: the account allowed to edit lines at this status. */
export function penHolder(boq: BoqRecord): string | null {
  if (boq.status === "draft") return boq.ptAssignee;
  if (boq.status === "pm_review") return boq.pmAssignee;
  return boq.owner;
}

/**
 * Line editing (amended 2026-09-03, user direction): BOTH assignees edit
 * during draft and pm_review; the owner edits at any status. Attribution
 * (origin + names) shows who added what. Status transitions keep their
 * per-role gates — this opens the lines, not the handoffs.
 */
export function canEditLines(boq: BoqRecord, userId: string): boolean {
  if (userId === boq.owner) return true;
  return (
    (boq.status === "draft" || boq.status === "pm_review") &&
    (userId === boq.ptAssignee || userId === boq.pmAssignee)
  );
}

/** Display name of the person a line's origin maps to. */
export function lineAdderName(
  origin: "pt" | "pm",
  boq: BoqRecord,
  nameOf: (id: string | null) => string,
): string {
  return origin === "pt" ? nameOf(boq.ptAssignee) : nameOf(boq.pmAssignee);
}
