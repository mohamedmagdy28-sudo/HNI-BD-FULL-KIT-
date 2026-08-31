import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parsePipelineRows, SHEET_HEADERS } from "./pipelineCsv";
import { parseXlsxGrid, serialToIso } from "./xlsx";

/**
 * Builds a real one-sheet .xlsx in memory, the way Google Sheets exports one:
 * shared strings for text, serials with a date style, fractions with a percent
 * style, plain numbers, and omitted empty cells (alignment via r= refs).
 */
type Cell =
  | { t: "s"; v: string }
  | { t: "n"; v: number }
  | { t: "date"; v: number }
  | { t: "pct"; v: number }
  | null;

async function buildXlsx(rows: Cell[][]): Promise<ArrayBuffer> {
  const shared: string[] = [];
  const sharedIndex = (s: string) => {
    const i = shared.indexOf(s);
    if (i >= 0) return i;
    shared.push(s);
    return shared.length - 1;
  };
  const colRef = (i: number) => {
    let n = i + 1;
    let out = "";
    while (n > 0) {
      out = String.fromCharCode(64 + ((n - 1) % 26) + 1) + out;
      n = Math.floor((n - 1) / 26);
    }
    return out;
  };
  // styles: xf 0 = general, xf 1 = date (numFmtId 14), xf 2 = percent (custom 164 "0.0%")
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0%"/></numFmts>
<cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs>
</styleSheet>`;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const rowsXml = rows
    .map((cells, r) => {
      const cellsXml = cells
        .map((cell, c) => {
          if (cell === null) return "";
          const ref = `${colRef(c)}${r + 1}`;
          if (cell.t === "s") return `<c r="${ref}" t="s"><v>${sharedIndex(cell.v)}</v></c>`;
          if (cell.t === "date") return `<c r="${ref}" s="1"><v>${cell.v}</v></c>`;
          if (cell.t === "pct") return `<c r="${ref}" s="2"><v>${cell.v}</v></c>`;
          return `<c r="${ref}"><v>${cell.v}</v></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${cellsXml}</row>`;
    })
    .join("");
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pipeline" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  );
  zip.file(
    "xl/sharedStrings.xml",
    `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared.map((s) => `<si><t>${esc(s)}</t></si>`).join("")}</sst>`,
  );
  zip.file("xl/styles.xml", styles);
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowsXml}</sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}

const S = (v: string): Cell => ({ t: "s", v });
const N = (v: number): Cell => ({ t: "n", v });
const D = (v: number): Cell => ({ t: "date", v });
const P = (v: number): Cell => ({ t: "pct", v });

describe("serialToIso", () => {
  it("converts 1900-system serials", () => {
    expect(serialToIso(46249)).toBe("2026-08-15");
    expect(serialToIso(25569)).toBe("1970-01-01");
  });
});

describe("parseXlsxGrid", () => {
  it("reads shared strings, typed numbers, date serials, and percent fractions", async () => {
    const buf = await buildXlsx([
      [S("Name"), S("When"), S("Value"), S("GP%")],
      [S("Aramco"), D(46249), N(120000), P(0.355)],
    ]);
    const grid = await parseXlsxGrid(buf);
    expect(grid).toEqual([
      ["Name", "When", "Value", "GP%"],
      ["Aramco", "2026-08-15", "120000", "35.5%"],
    ]);
  });

  it("keeps columns aligned when empty cells are omitted from the XML", async () => {
    const buf = await buildXlsx([
      [S("A"), S("B"), S("C")],
      [S("first"), null, S("third")],
    ]);
    const grid = await parseXlsxGrid(buf);
    expect(grid[1]).toEqual(["first", "", "third"]);
  });

  it("rejects a non-workbook zip", async () => {
    const zip = new JSZip();
    zip.file("hello.txt", "not a spreadsheet");
    const buf = await zip.generateAsync({ type: "arraybuffer" });
    await expect(parseXlsxGrid(buf)).rejects.toThrow();
  });

  it("feeds the pipeline parser end to end: typed cells need no format guessing", async () => {
    const header = SHEET_HEADERS.map(S);
    // Sheet-order row: Date, Source, ..., Stage(7), Prob(8), ..., Currency(12), Value(13), GP%(14), GP amt(15)
    const row: Cell[] = [
      D(46249), S("Referral"), S("New"), S("Government"), S("Training"), S("Aramco"), S("AC Wave 2"),
      S("Won"), P(1), null, null, S("PO-9"), S("SAR"), N(120000), P(0.355), N(42600), null, S("On track"), null,
    ];
    const grid = await parseXlsxGrid(await buildXlsx([header, row]));
    const { deals, report } = parsePipelineRows(grid, []);
    expect(report.imported).toBe(1);
    expect(deals[0].date).toBe("2026-08-15");
    expect(deals[0].stage).toBe("Won");
    expect(deals[0].winningProbability).toBe(100);
    expect(deals[0].dealValue).toBe(120000);
    expect(deals[0].gpPct).toBe(35.5);
    expect(deals[0].flags).toEqual({});
  });
});
