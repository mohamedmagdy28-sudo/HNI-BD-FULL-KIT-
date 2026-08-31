import { describe, expect, it } from "vitest";
import { calc } from "./calc";
import {
  externalSheetRow,
  isNewSinceLastCopy,
  parseCsv,
  parseLenientNumber,
  parsePipelineCsv,
  parseSheetDate,
  proposalSheetRow,
  SHEET_HEADERS,
  toCsv,
  toTsv,
} from "./pipelineCsv";
import { newId, DEFAULT_TARGETS, type ExternalDeal, type Program, type Proposal } from "./types";

function makeProgram(): Program {
  return {
    id: newId(),
    name: "Phase 1",
    description: "",
    days: 3,
    participants: 0,
    city: "Riyadh",
    costLines: [{ id: newId(), label: "Trainer", qty: 3, unitRate: 10000 }],
  };
}

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: newId(),
    clientName: "NEOM",
    title: "Leadership Track",
    date: "2026-08-15",
    currency: "SAR",
    projectType: "custom",
    sectionLabel: "phase",
    clientLogo: null,
    markupPct: 40,
    discount: { type: "percent", value: 0 },
    vatPct: 15,
    schedule: [{ id: "s1", label: "On signature", percent: 100 }],
    programs: [makeProgram()],
    sentAt: null,
    pipeline: {},
    ...overrides,
  };
}

function makeExternal(overrides: Partial<ExternalDeal> = {}): ExternalDeal {
  return {
    id: newId(),
    importedAt: "2026-08-30T00:00:00.000Z",
    date: "2026-07-01",
    source: "Referral",
    dealType: "New",
    sector: "Government",
    primaryService: "Training",
    company: "Aramco",
    projectName: "AC Wave 2",
    stage: "Won",
    winningProbability: null,
    deliveryStart: "",
    deliveryEnd: "",
    poNumber: "PO-9",
    currency: "SAR",
    dealValue: 120000,
    gpPct: 35.5,
    gpAmount: 42600,
    projectStatus: "On track",
    notes: "",
    flags: {},
    ...overrides,
  };
}

const HEADER_LINE = SHEET_HEADERS.join(",");

describe("parseCsv", () => {
  it("handles quoted fields with embedded commas, quotes, and newlines", () => {
    const rows = parseCsv('a,"b,c","say ""hi""","line1\nline2"\r\nd,e,f,g');
    expect(rows).toEqual([
      ["a", "b,c", 'say "hi"', "line1\nline2"],
      ["d", "e", "f", "g"],
    ]);
  });

  it("strips the BOM and drops fully-empty trailing rows", () => {
    const rows = parseCsv("﻿x,y\r\n1,2\r\n,\r\n");
    expect(rows).toEqual([
      ["x", "y"],
      ["1", "2"],
    ]);
  });
});

describe("parseLenientNumber", () => {
  it("strips currency labels, separators, and percent signs", () => {
    expect(parseLenientNumber("SAR 15,000")).toBe(15000);
    expect(parseLenientNumber("50%")).toBe(50);
    expect(parseLenientNumber(" 42600 ")).toBe(42600);
    expect(parseLenientNumber("-3,500")).toBe(-3500);
  });
  it("returns null when nothing numeric remains", () => {
    expect(parseLenientNumber("")).toBeNull();
    expect(parseLenientNumber("TBD")).toBeNull();
    expect(parseLenientNumber("-")).toBeNull();
  });
});

describe("parseSheetDate", () => {
  it("passes ISO through", () => {
    expect(parseSheetDate("2026-08-15")).toBe("2026-08-15");
    expect(parseSheetDate("2026-8-5")).toBe("2026-08-05");
  });
  it("resolves unambiguous day/month either way round", () => {
    expect(parseSheetDate("25/03/2026")).toBe("2026-03-25"); // day > 12: DD/MM
    expect(parseSheetDate("03/25/2026")).toBe("2026-03-25"); // month slot > 12: MM/DD
  });
  it("reads ambiguous dates as DD/MM (declared Gulf convention)", () => {
    expect(parseSheetDate("05/03/2026")).toBe("2026-03-05");
  });
  it("returns null for garbage, empty, and impossible dates", () => {
    expect(parseSheetDate("")).toBeNull();
    expect(parseSheetDate("Q3")).toBeNull();
    expect(parseSheetDate("40/40/2026")).toBeNull();
  });
});

describe("parsePipelineCsv", () => {
  const row = (cells: Record<string, string>) =>
    SHEET_HEADERS.map((h) => {
      const v = cells[h] ?? "";
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",");

  it("imports well-formed rows with parsed numbers, dates, and stages", () => {
    const csv = [
      HEADER_LINE,
      row({
        Date: "15/08/2026",
        Company: "Aramco",
        "Project Name": "AC Wave 2",
        Stage: "Won",
        "Winning Probability": "100%",
        Currency: "SAR",
        "Actual Deal Value (AED)": "120,000",
        "GP%": "35.5%",
        "Actual Expected GP amt. (AED)": "42,600",
      }),
    ].join("\r\n");
    const { deals, report } = parsePipelineCsv(csv, []);
    expect(report.imported).toBe(1);
    expect(deals[0].date).toBe("2026-08-15");
    expect(deals[0].stage).toBe("Won");
    expect(deals[0].dealValue).toBe(120000);
    expect(deals[0].gpPct).toBe(35.5);
    expect(deals[0].winningProbability).toBe(100);
    expect(deals[0].flags).toEqual({});
  });

  it("flags bad value, bad date, and non-SAR rows but still imports them", () => {
    const csv = [
      HEADER_LINE,
      row({ Company: "A", "Project Name": "P1", Stage: "Proposal", Currency: "SAR", "Actual Deal Value (AED)": "TBD", Date: "soon" }),
      row({ Company: "B", "Project Name": "P2", Stage: "Proposal", Currency: "AED", "Actual Deal Value (AED)": "5000", Date: "01/02/2026" }),
    ].join("\n");
    const { deals, report } = parsePipelineCsv(csv, []);
    expect(report.imported).toBe(2);
    expect(deals[0].flags.badValue).toBe(true);
    expect(deals[0].flags.badDate).toBe(true);
    expect(deals[1].flags.nonSar).toBe(true);
    expect(report.excludedValue).toBe(1);
    expect(report.excludedDate).toBe(1);
    expect(report.nonSar).toBe(1);
  });

  it("reports (never merges) rows matching an app proposal by company+title, trim and case insensitive", () => {
    const csv = [HEADER_LINE, row({ Company: " neom ", "Project Name": "LEADERSHIP TRACK", Stage: "Won", Currency: "SAR", "Actual Deal Value (AED)": "1" })].join("\n");
    const { deals, report } = parsePipelineCsv(csv, [makeProposal()]);
    expect(deals).toHaveLength(1); // still imported
    expect(report.possibleDuplicates).toEqual([{ company: "neom", projectName: "LEADERSHIP TRACK" }]);
  });

  it("skips rows with neither company nor project name, tolerates unknown stages and headers", () => {
    const csv = [HEADER_LINE + ",Extra Col", row({ Stage: "Won" }), row({ Company: "X", "Project Name": "Y", Stage: "Negotiating" })].join("\n");
    const { deals, report } = parsePipelineCsv(csv, []);
    expect(deals).toHaveLength(1);
    expect(deals[0].stage).toBe(""); // unknown stage stored as empty, not invented
    expect(report.unknownHeaders).toEqual(["Extra Col"]);
  });
});

describe("sheet row export", () => {
  it("proposalSheetRow emits 19 cells in sheet order: DD/MM dates, percent strings, plain integer money, SAR", () => {
    const p = makeProposal({
      pipeline: { stage: "Proposal", winningProbability: 50, source: "Referral", poNumber: "PO-1", deliveryStart: "2026-09-01" },
    });
    const r = calc(p);
    const cells = proposalSheetRow(p, r, { ...DEFAULT_TARGETS, revenueTarget: 1000000 });
    expect(cells).toHaveLength(SHEET_HEADERS.length);
    expect(cells[0]).toBe("15/08/2026"); // Date
    expect(cells[5]).toBe("NEOM"); // Company
    expect(cells[7]).toBe("Proposal"); // Stage
    expect(cells[8]).toBe("50%"); // Winning Probability
    expect(cells[9]).toBe("01/09/2026"); // Start Date of Delivery
    expect(cells[12]).toBe("SAR");
    expect(cells[13]).toBe(String(r.netPrice)); // plain integer, no separators
    expect(cells[14]).toMatch(/^\d+(\.\d)?%$/); // GP%
    expect(cells[15]).toBe(String(r.marginAmount));
    expect(cells[16]).toBe(`${((r.netPrice / 1000000) * 100).toFixed(1)}%`); // contribution
  });

  it("contribution cell is empty without a revenue target", () => {
    const p = makeProposal({ pipeline: { stage: "Won" } });
    const cells = proposalSheetRow(p, calc(p), DEFAULT_TARGETS);
    expect(cells[16]).toBe("");
  });

  it("externalSheetRow round-trips imported cells and converts ISO dates back to DD/MM", () => {
    const cells = externalSheetRow(makeExternal());
    expect(cells[0]).toBe("01/07/2026");
    expect(cells[13]).toBe("120000");
    expect(cells[14]).toBe("35.5%");
  });
});

describe("toTsv and toCsv", () => {
  it("TSV flattens tabs and newlines inside cells so the paste grid never shears", () => {
    expect(toTsv([["a\tb", "line1\nline2"], ["c", "d"]])).toBe("a b\tline1 line2\nc\td");
  });
  it("CSV quotes per RFC 4180 and includes the verbatim header row", () => {
    const out = toCsv([['He said "go"', "a,b"]]);
    expect(out.startsWith(HEADER_LINE + "\r\n")).toBe(true);
    expect(out).toContain('"He said ""go""","a,b"');
  });
});

describe("isNewSinceLastCopy", () => {
  it("true until copiedAt is stamped", () => {
    expect(isNewSinceLastCopy(makeProposal({ pipeline: { stage: "Won" } }))).toBe(true);
    expect(isNewSinceLastCopy(makeProposal({ pipeline: { stage: "Won", copiedAt: "2026-08-30T00:00:00Z" } }))).toBe(false);
  });
});
