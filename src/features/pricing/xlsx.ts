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
export async function parseXlsxGrid(data: ArrayBuffer): Promise<string[][]> {
  const zip = await JSZip.loadAsync(data);
  const read = (path: string) => zip.file(path)?.async("string") ?? null;

  const workbook = await read("xl/workbook.xml");
  if (workbook === null) throw new Error("not an xlsx workbook");
  const firstSheetRid = /<sheet\s[^>]*r:id="([^"]+)"/.exec(workbook)?.[1];
  const rels = (await read("xl/_rels/workbook.xml.rels")) ?? "";
  let sheetPath = "xl/worksheets/sheet1.xml";
  if (firstSheetRid) {
    const rel = new RegExp(`<Relationship[^>]*Id="${firstSheetRid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1];
    if (rel) sheetPath = rel.startsWith("/") ? rel.slice(1) : `xl/${rel.replace(/^\.\//, "")}`;
  }
  const sheet = await read(sheetPath);
  if (sheet === null) throw new Error("worksheet missing");

  const shared: string[] = [];
  const sharedXml = await read("xl/sharedStrings.xml");
  if (sharedXml) {
    const siRe = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;
    let m: RegExpExecArray | null;
    while ((m = siRe.exec(sharedXml)) !== null) shared.push(textRuns(m[1]));
  }
  const styleKinds = buildStyleKinds(await read("xl/styles.xml"));

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
