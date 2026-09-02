// Internal costing workbook (design: docs/designs/cost-excel-and-custom-terms.md).
// Full internal economics of a proposal — cost lines, per-phase markup, price
// and margin, consolidated summary — regenerated from data on every download,
// never stored. INTERNAL ONLY: this file never appears among the client-view
// exports, and the sheet itself says so in its subtitle row.
//
// Sheet content is English-only on purpose (internal record, matching the
// deck's English-only export decision); only the UI buttons localize.
// All money cells are VALUES, never formulas: rounded-canonical means the
// stored number IS the truth, and formulas would reintroduce recompute drift.

import type { CalcResult } from "./calc";
import type { Proposal } from "./types";
import type { XlsxCell } from "./xlsx";

const money = (v: number): XlsxCell => ({ t: "money", v });
const pct = (v: number): XlsxCell => ({ t: "pct", v: v / 100 });

/**
 * Readable, Arabic-preserving filename for the internal record. Deliberately
 * DIVERGES from the PPT export's ASCII slug (proposalFileName): this file is
 * for HNI eyes and the recognizable client name is the point.
 */
export function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[/\\:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  return cleaned;
}

export function costingFileName(clientName: string, title: string, isoDate: string, untitled: string): string {
  const client = sanitizeFileName(clientName) || untitled;
  const t = sanitizeFileName(title) || untitled;
  return `Costing - ${client} - ${t} - ${isoDate || "undated"}.xlsx`;
}

/**
 * The costing sheet as typed rows plus the row indices to render bold.
 * boldRows may contain ONLY all-text rows (one bold cellXf with numFmtId 0
 * would strip the money format from typed cells); this builder guarantees it —
 * header, phase-name, and section-label rows carry no typed cells.
 */
export function buildCostingRows(proposal: Proposal, result: CalcResult): { rows: XlsxCell[][]; boldRows: number[] } {
  const rows: XlsxCell[][] = [];
  const boldRows: number[] = [];
  const bold = (row: XlsxCell[]) => {
    boldRows.push(rows.length);
    rows.push(row);
  };

  // Date stays an ISO STRING here: the title row is bold, and boldRows must
  // hold only text cells (the bold xf carries numFmtId 0).
  bold([proposal.title || "Untitled", proposal.clientName, proposal.date, proposal.currency]);
  rows.push(["Internal costing — not for client distribution", null, null, null]);
  rows.push([null, null, null, null]);
  bold(["Item", "Qty", "Unit rate", "Subtotal"]);

  proposal.programs.forEach((program, i) => {
    const totals = result.programs[i];
    bold([`${program.name || `Program ${i + 1}`}${program.city ? ` · ${program.city}` : ""}`, null, null, null]);
    for (const line of program.costLines) {
      const qty = Number.isFinite(line.qty) ? Math.max(0, line.qty) : 0;
      const rate = Number.isFinite(line.unitRate) ? Math.max(0, line.unitRate) : 0;
      rows.push([line.label || "—", qty, money(rate), money(Math.round(qty * rate))]);
    }
    rows.push(["Phase total cost", null, null, money(totals.cost)]);
    rows.push([`Markup %${totals.overridden ? " (own)" : " (default)"}`, null, null, pct(totals.effMarkupPct)]);
    rows.push(["Phase price", null, null, money(totals.listShare)]);
    rows.push(["Phase margin %", null, null, pct(totals.phaseMarginPct)]);
    if (program.days > 0) {
      rows.push(["Days", null, null, program.days]);
      if (totals.listPerDay != null) rows.push(["Price / day", null, null, money(totals.listPerDay)]);
    }
    rows.push([null, null, null, null]);
  });

  bold(["SUMMARY", null, null, null]);
  rows.push(["Total cost", null, null, money(result.totalCost)]);
  rows.push(["Markup % (default)", null, null, pct(Number.isFinite(proposal.markupPct) ? Math.max(0, proposal.markupPct) : 0)]);
  rows.push(["List price", null, null, money(result.listPrice)]);
  if (result.discountAmount > 0 || proposal.discount.value > 0) {
    const label =
      proposal.discount.type === "percent"
        ? `Discount (${proposal.discount.value}%)`
        : `Discount (amount)${result.discountClamped ? " — clamped to list price" : ""}`;
    rows.push([label, null, null, money(result.discountAmount)]);
  }
  rows.push(["Net price", null, null, money(result.netPrice)]);
  rows.push(["Margin amount", null, null, money(result.marginAmount)]);
  rows.push(["Margin %", null, null, pct(result.marginPct)]);
  rows.push([`VAT ${proposal.vatPct}%`, null, null, money(result.vatAmount)]);
  rows.push(["Total incl. VAT", null, null, money(result.totalIncVat)]);

  if (result.scheduleValid && proposal.schedule.length > 0) {
    rows.push([null, null, null, null]);
    bold(["PAYMENT SCHEDULE", null, null, null]);
    proposal.schedule.forEach((item) => {
      const inst = result.installments.find((x) => x.itemId === item.id);
      rows.push([item.label || "—", null, pct(item.percent), inst ? money(inst.amount) : null]);
    });
  }

  return { rows, boldRows };
}

/** Column widths (Excel character units) for the costing sheet. */
export const COSTING_COLS = [40, 8, 12, 14];
