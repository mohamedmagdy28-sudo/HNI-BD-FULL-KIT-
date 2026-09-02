// Minimal .xlsx reader for the pipeline import (design: docs/designs/pipeline.md).
// An .xlsx is a ZIP of XML; JSZip (already a dependency) unpacks it and this
// module converts the FIRST worksheet into the same string grid the CSV path
// produces, so both formats flow through one parser. No spreadsheet library.
//
// Typed cells beat CSV text: numbers arrive as numbers, dates as serials, and
// percents as fractions with a percent style, so the grid strings are exact:
//   date style    -> ISO "2026-08-15" (parseSheetDate passes it through)
//   percent style -> "50%"            (parseLenientNumber strips the %)
//   plain number  -> "120000"
//   text          -> verbatim

import JSZip from "jszip";

/** Built-in numFmtIds: 14-22 date, 45-47 time-ish, 9-10 percent. */
const BUILTIN_DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);
const BUILTIN_PERCENT_IDS = new Set([9, 10]);

type CellKind = "date" | "percent" | "other";

function xmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");
}

/** Concatenated text of all <t> runs inside one <si> or <is> block. */
function textRuns(block: string): string {
  let out = "";
  const re = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) out += xmlEntities(m[1] ?? "");
  return out;
}

/** Excel serial date (1900 system, Google Sheets exports use it) to ISO. */
export function serialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400000); // 25569 = days 1899-12-30 -> 1970-01-01
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  if (y < 1901 || y > 9999) return String(serial);
  return `${y}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Trims a trailing float artifact: 35.499999999999996 -> "35.5". */
function cleanNumber(n: number): string {
  const rounded = Number(n.toFixed(10));
  return String(rounded);
}

function colIndex(ref: string): number {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? "A";
  let idx = 0;
  for (const ch of letters) idx = idx * 26 + (ch.charCodeAt(0) - 64);
  return idx - 1;
}

/** Maps style index (cell s=) to a kind via styles.xml. Missing parts degrade to "other". */
function buildStyleKinds(stylesXml: string | null): CellKind[] {
  if (!stylesXml) return [];
  const custom = new Map<number, CellKind>();
  const numFmtRe = /<numFmt\s[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = numFmtRe.exec(stylesXml)) !== null) {
    const code = xmlEntities(m[2]).replace(/"[^"]*"/g, "").replace(/\[[^\]]*\]/g, "");
    if (code.includes("%")) custom.set(Number(m[1]), "percent");
    else if (/[dmyhs]/i.test(code) && !/general/i.test(code)) custom.set(Number(m[1]), "date");
  }
  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? "";
  const kinds: CellKind[] = [];
  const xfRe = /<xf\b[^>]*>/g;
  while ((m = xfRe.exec(cellXfs)) !== null) {
    const id = Number(/numFmtId="(\d+)"/.exec(m[0])?.[1] ?? "0");
    kinds.push(
      BUILTIN_DATE_IDS.has(id) ? "date" : BUILTIN_PERCENT_IDS.has(id) ? "percent" : (custom.get(id) ?? "other"),
    );
  }
  return kinds;
}

/**
 * First worksheet of an .xlsx as a string grid, aligned by column reference so
 * omitted (empty) cells keep the columns lined up with the header row.
 */
export async function parseXlsxGrid(data: ArrayBuffer, headerHints: readonly string[] = []): Promise<string[][]> {
  const zip = await JSZip.loadAsync(data);
  const read = (path: string) => zip.file(path)?.async("string") ?? null;

  const workbook = await read("xl/workbook.xml");
  if (workbook === null) throw new Error("not an xlsx workbook");
  const rels = (await read("xl/_rels/workbook.xml.rels")) ?? "";

  // All sheets, in workbook order, skipping hidden ones: a Google Sheets
  // workbook often carries a hidden or archival sheet FIRST, and blindly
  // reading it imports data the user cannot even see (found the hard way:
  // a 2025 history sheet inflated achieved revenue to 14.5M).
  type SheetRef = { name: string; path: string };
  const sheets: SheetRef[] = [];
  const sheetRe = /<sheet\s[^>]*>/g;
  let sm: RegExpExecArray | null;
  while ((sm = sheetRe.exec(workbook)) !== null) {
    const tag = sm[0];
    if (/state="(hidden|veryHidden)"/.test(tag)) continue;
    const rid = /r:id="([^"]+)"/.exec(tag)?.[1];
    const name = xmlEntities(/name="([^"]*)"/.exec(tag)?.[1] ?? "");
    if (!rid) continue;
    const rel = new RegExp(`<Relationship[^>]*Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1];
    const path = rel ? (rel.startsWith("/") ? rel.slice(1) : `xl/${rel.replace(/^\.\//, "")}`) : "xl/worksheets/sheet1.xml";
    sheets.push({ name, path });
  }
  if (sheets.length === 0) throw new Error("worksheet missing");

  const shared: string[] = [];
  const sharedXml = await read("xl/sharedStrings.xml");
  if (sharedXml) {
    const siRe = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = siRe.exec(sharedXml)) !== null) shared.push(textRuns(m[1]));
  }
  const styleKinds = buildStyleKinds(await read("xl/styles.xml"));

  // Among visible sheets, pick the one whose first row matches the most
  // expected headers; ties and no-hint calls fall back to workbook order.
  const hints = headerHints.map((h) => h.trim().toLowerCase());
  let best: { grid: string[][]; score: number } | null = null;
  for (const ref of sheets) {
    const xml = await read(ref.path);
    if (xml === null) continue;
    const grid = parseSheetGrid(xml, shared, styleKinds);
    const header = (grid[0] ?? []).map((c) => c.trim().toLowerCase());
    const score = hints.length === 0 ? 0 : hints.filter((h) => header.includes(h)).length;
    if (best === null || score > best.score) best = { grid, score };
    if (hints.length === 0) break; // no hints: first visible sheet wins
  }
  if (best === null) throw new Error("worksheet missing");
  return best.grid;
}

function parseSheetGrid(sheet: string, shared: string[], styleKinds: CellKind[]): string[][] {
  const grid: string[][] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(sheet)) !== null) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cellMatch: RegExpExecArray | null;
    let nextCol = 0;
    while ((cellMatch = cellRe.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1];
      const body = cellMatch[2] ?? "";
      const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const col = ref ? colIndex(ref) : nextCol;
      nextCol = col + 1;
      while (cells.length < col) cells.push("");

      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "n";
      const styleIdx = Number(/s="(\d+)"/.exec(attrs)?.[1] ?? "-1");
      const kind: CellKind = styleKinds[styleIdx] ?? "other";
      let value = "";
      if (type === "inlineStr") {
        value = textRuns(body);
      } else {
        const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(body)?.[1];
        if (raw !== undefined) {
          const text = xmlEntities(raw);
          if (type === "s") value = shared[Number(text)] ?? "";
          else if (type === "str") value = text;
          else if (type === "b") value = text === "1" ? "TRUE" : "FALSE";
          else if (type === "e") value = "";
          else {
            const n = Number(text);
            if (!Number.isFinite(n)) value = text;
            else if (kind === "date") value = serialToIso(n);
            else if (kind === "percent") value = `${cleanNumber(n * 100)}%`;
            else value = cleanNumber(n);
          }
        }
      }
      cells[col] = value;
    }
    grid.push(cells);
  }
  return grid.filter((r) => r.some((cell) => cell.trim() !== ""));
}

// ---------------------------------------------------------------- writer

/** Typed cell for the pipeline Excel export. */
export type XlsxCell = string | number | { t: "money" | "pct" | "date"; v: number } | null;

/** Inverse of serialToIso for the 1900 date system. */
export function isoToSerial(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000) + 25569;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function colRef(i: number): string {
  let n = i + 1;
  let out = "";
  while (n > 0) {
    out = String.fromCharCode(64 + ((n - 1) % 26) + 1) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Optional presentation extras for the costing sheet; omitted = today's exact output. */
export type WorkbookOptions = {
  /** Row indices (0-based) rendered bold. TEXT cells only: the bold xf carries numFmtId 0, so a typed cell in a bold row would lose its number format. */
  boldRows?: number[];
  /** Column widths in Excel character units, emitted as a <cols> block. */
  cols?: number[];
  /** Freeze this many top rows. */
  freezeRows?: number;
};

/**
 * Minimal single-sheet .xlsx with native cell types: money as numbers with a
 * #,##0 format (Excel shows 8,000,000 itself), percents as fractions with a
 * percent format, dates as date-formatted serials, text as inline strings.
 * Built on the JSZip already in the tree — no spreadsheet library.
 */
export async function buildWorkbook(sheetName: string, rows: XlsxCell[][], options: WorkbookOptions = {}): Promise<ArrayBuffer> {
  const { default: JSZipCtor } = await import("jszip");
  const boldSet = new Set(options.boldRows ?? []);
  const cellXml = (cell: XlsxCell, r: number, c: number): string => {
    if (cell === null || cell === "") return "";
    const ref = `${colRef(c)}${r + 1}`;
    if (typeof cell === "string") {
      const style = boldSet.has(r) ? ` s="4"` : "";
      return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(cell)}</t></is></c>`;
    }
    if (typeof cell === "number") return `<c r="${ref}"><v>${cell}</v></c>`;
    const style = { date: 1, pct: 2, money: 3 }[cell.t];
    return `<c r="${ref}" s="${style}"><v>${cell.v}</v></c>`;
  };
  const sheetData = rows
    .map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => cellXml(cell, r, c)).join("")}</row>`)
    .join("");
  const zip = new JSZipCtor();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
  );
  // The bold xf (s=4) is APPENDED after the existing indices so the typed
  // styles 1/2/3 keep their positions and the pipeline export stays untouched.
  zip.file(
    "xl/styles.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="3"><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/><numFmt numFmtId="166" formatCode="0.0%"/><numFmt numFmtId="167" formatCode="#,##0"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0"/><xf numFmtId="165" applyNumberFormat="1"/><xf numFmtId="166" applyNumberFormat="1"/><xf numFmtId="167" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" applyFont="1"/></cellXfs></styleSheet>`,
  );
  const sheetViews =
    options.freezeRows && options.freezeRows > 0
      ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${options.freezeRows}" topLeftCell="A${options.freezeRows + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>`
      : "";
  const colsXml =
    options.cols && options.cols.length > 0
      ? `<cols>${options.cols.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
      : "";
  zip.file(
    "xl/worksheets/sheet1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sheetViews}${colsXml}<sheetData>${sheetData}</sheetData></worksheet>`,
  );
  return zip.generateAsync({ type: "arraybuffer" });
}
