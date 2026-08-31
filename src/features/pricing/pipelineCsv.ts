// Import/export between the app and the team's Google Sheets pipeline tab
// (design: docs/designs/pipeline.md). The sheet stays a separate entity by
// user decision: import is a one-time backfill of history; export produces
// paste-ready rows. No network, no Google APIs.
//
// SHEET CELL FORMAT DEFAULTS (build gate waived by the user; tune these
// constants after the first real paste test):
// - percents written as "50%" (Google Sheets parses that correctly whether
//   the target cell is percent-formatted or plain; a bare 50 in a
//   percent-formatted cell becomes 5000%)
// - money as plain unseparated integers (locale-proof parsing)
// - dates as DD/MM/YYYY (declared Gulf convention, eng review 3A)

import type { CalcResult } from "./calc";
import {
  dealGpAmount,
  newId,
  OPEN_STAGES,
  PIPELINE_STAGES,
  type ExternalDeal,
  type PipelineStage,
  type Proposal,
  type Targets,
} from "./types";

/** The sheet's exact ordered header strings, verbatim including its typos. */
export const SHEET_HEADERS = [
  "Date",
  "Source",
  "Deal Type",
  "Sector",
  "Primary Service",
  "Company",
  "Project Name",
  "Stage",
  "Winning Probability",
  "Start Date of Delivery",
  "End Date if Delivery",
  "PO Number",
  "Currency",
  "Actual Deal Value (AED)",
  "GP%",
  "Actual Expected GP amt. (AED)",
  "Traget Achivement Contribution %",
  "Project Status",
  "Notes",
] as const;

// ---------------------------------------------------------------- parsing

/** RFC 4180 state machine: quoted fields, embedded commas/newlines, doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const src = text.replace(/^﻿/, ""); // strip BOM
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
    } else if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop fully-empty trailing rows (sheets export often ends with them).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Lenient number: strips currency labels, separators, %, whitespace. Null when nothing numeric remains. */
export function parseLenientNumber(cell: string): number | null {
  const cleaned = cell.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/**
 * Date policy (eng review 3A): ISO and unambiguous forms parse; ambiguous
 * d/m-vs-m/d reads as DD/MM/YYYY (declared Gulf convention); anything else
 * returns null (row flagged out of period math).
 */
export function parseSheetDate(cell: string): string | null {
  const s = cell.trim();
  if (s === "") return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return toIso(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]);
    if (a > 12 && b <= 12) return toIso(year, b, a); // unambiguous DD/MM
    if (b > 12 && a <= 12) return toIso(year, a, b); // unambiguous MM/DD
    return toIso(year, b, a); // ambiguous: declared DD/MM
  }
  return null;
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type ImportReport = {
  imported: number;
  excludedValue: number;
  excludedDate: number;
  nonSar: number;
  /** Sheet rows whose Company+Project Name matches an app proposal (trim, case-insensitive): reported, never merged (design T1). */
  possibleDuplicates: Array<{ company: string; projectName: string }>;
  unknownHeaders: string[];
};

export function parsePipelineCsv(
  text: string,
  proposals: Proposal[],
): { deals: ExternalDeal[]; report: ImportReport } {
  return parsePipelineRows(parseCsv(text), proposals);
}

/** Shared row-grid parser: the CSV path and the .xlsx path both land here. */
export function parsePipelineRows(
  rows: string[][],
  proposals: Proposal[],
): { deals: ExternalDeal[]; report: ImportReport } {
  if (rows.length === 0) return { deals: [], report: emptyReport() };
  const headers = rows[0].map((h) => h.trim());
  const col = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const idx = Object.fromEntries(SHEET_HEADERS.map((h) => [h, col(h)]));
  const unknownHeaders = headers.filter((h) => !(SHEET_HEADERS as readonly string[]).some((s) => s.toLowerCase() === h.toLowerCase()));
  const cell = (row: string[], header: (typeof SHEET_HEADERS)[number]) => {
    const i = idx[header] as number;
    return i >= 0 && i < row.length ? row[i].trim() : "";
  };
  const proposalKeys = new Set(
    proposals.map((p) => `${p.clientName.trim().toLowerCase()}|${p.title.trim().toLowerCase()}`),
  );

  const report = emptyReport();
  report.unknownHeaders = unknownHeaders;
  const deals: ExternalDeal[] = [];
  for (const row of rows.slice(1)) {
    const company = cell(row, "Company");
    const projectName = cell(row, "Project Name");
    if (company === "" && projectName === "") continue;

    const currency = cell(row, "Currency");
    const nonSar = currency !== "" && currency.trim().toUpperCase() !== "SAR";
    const dealValue = parseLenientNumber(cell(row, "Actual Deal Value (AED)"));
    const gpAmount = parseLenientNumber(cell(row, "Actual Expected GP amt. (AED)"));
    const gpPct = parseLenientNumber(cell(row, "GP%"));
    const badValue = dealValue === null;
    const isoDate = parseSheetDate(cell(row, "Date"));
    const rawStage = cell(row, "Stage");
    const stage = (PIPELINE_STAGES as readonly string[]).includes(rawStage) ? (rawStage as PipelineStage) : "";

    if (nonSar) report.nonSar++;
    else if (badValue) report.excludedValue++;
    if (isoDate === null && cell(row, "Date") !== "") report.excludedDate++;
    if (proposalKeys.has(`${company.trim().toLowerCase()}|${projectName.trim().toLowerCase()}`)) {
      report.possibleDuplicates.push({ company, projectName });
    }

    deals.push({
      id: newId(),
      importedAt: new Date().toISOString(),
      date: isoDate ?? cell(row, "Date"),
      source: cell(row, "Source"),
      dealType: cell(row, "Deal Type"),
      sector: cell(row, "Sector"),
      primaryService: cell(row, "Primary Service"),
      company,
      projectName,
      stage,
      winningProbability: parseLenientNumber(cell(row, "Winning Probability")),
      deliveryStart: cell(row, "Start Date of Delivery"),
      deliveryEnd: cell(row, "End Date if Delivery"),
      poNumber: cell(row, "PO Number"),
      currency: currency || "SAR",
      dealValue,
      gpPct,
      gpAmount,
      projectStatus: cell(row, "Project Status"),
      notes: cell(row, "Notes"),
      flags: {
        ...(badValue ? { badValue: true } : {}),
        ...(isoDate === null ? { badDate: true } : {}),
        ...(nonSar ? { nonSar: true } : {}),
      },
    });
    report.imported++;
  }
  return { deals, report };
}

function emptyReport(): ImportReport {
  return { imported: 0, excludedValue: 0, excludedDate: 0, nonSar: 0, possibleDuplicates: [], unknownHeaders: [] };
}

// ---------------------------------------------------------------- export

function ddmmyyyy(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function pct(value: number | null | undefined, decimals = 0): string {
  return value == null ? "" : `${value.toFixed(decimals)}%`;
}

/** The 19 cell values for an app proposal, in sheet order. */
export function proposalSheetRow(p: Proposal, result: CalcResult, targets: Targets): string[] {
  const pl = p.pipeline;
  return [
    ddmmyyyy(p.date),
    pl.source ?? "",
    pl.dealType ?? "",
    pl.sector ?? "",
    pl.primaryService ?? "",
    p.clientName,
    p.title,
    pl.stage ?? "",
    pl.winningProbability != null ? pct(pl.winningProbability) : "",
    pl.deliveryStart ? ddmmyyyy(pl.deliveryStart) : "",
    pl.deliveryEnd ? ddmmyyyy(pl.deliveryEnd) : "",
    pl.poNumber ?? "",
    "SAR",
    String(result.netPrice),
    pct(result.marginPct, 1),
    String(result.marginAmount),
    targets.revenueTarget ? pct((result.netPrice / targets.revenueTarget) * 100, 1) : "",
    pl.projectStatus ?? "",
    pl.notes ?? "",
  ];
}

export function externalSheetRow(d: ExternalDeal): string[] {
  return [
    /^\d{4}-/.test(d.date) ? ddmmyyyy(d.date) : d.date,
    d.source,
    d.dealType,
    d.sector,
    d.primaryService,
    d.company,
    d.projectName,
    d.stage,
    d.winningProbability != null ? pct(d.winningProbability) : "",
    d.deliveryStart,
    d.deliveryEnd,
    d.poNumber,
    d.currency,
    d.dealValue != null ? String(d.dealValue) : "",
    pct(d.gpPct, 1),
    (() => { const gp = dealGpAmount(d.dealValue, d.gpPct, d.gpAmount); return gp != null ? String(gp) : ""; })(),
    "",
    d.projectStatus,
    d.notes,
  ];
}

/** TSV for clipboard paste: tabs/newlines inside cells become spaces so the paste grid never shears. */
export function toTsv(rows: string[][]): string {
  return rows.map((r) => r.map((cell) => cell.replace(/[\t\r\n]+/g, " ")).join("\t")).join("\n");
}

/** CSV per RFC 4180, with the sheet's header row. */
export function toCsv(rows: string[][]): string {
  const esc = (cell: string) => (/[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);
  return [Array.from(SHEET_HEADERS), ...rows].map((r) => r.map(esc).join(",")).join("\r\n");
}

/** Rows changed since their last copy (new-since-last-copy default, eng review T2). */
export function isNewSinceLastCopy(p: Proposal): boolean {
  return !p.pipeline.copiedAt;
}

export { OPEN_STAGES };
