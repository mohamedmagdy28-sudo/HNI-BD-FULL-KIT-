import { describe, expect, it } from "vitest";
import { calc } from "./calc";
import { buildCostingRows, costingFileName, sanitizeFileName, COSTING_COLS } from "./costingXlsx";
import type { XlsxCell } from "./xlsx";
import { newId, type Program, type Proposal } from "./types";

function program(partial: Partial<Program>): Program {
  return {
    id: newId(),
    name: "Phase",
    description: "",
    days: 1,
    participants: 0,
    city: "",
    costLines: [],
    ...partial,
  };
}

/** Two unequal phases, phase 2 overriding markup, plus a discount: the reproducibility tripwire fixture. */
function fixture(): Proposal {
  return {
    id: "p1",
    clientName: "Maaden",
    title: "Leadership Track",
    date: "2026-09-02",
    currency: "SAR",
    projectType: "custom",
    sectionLabel: "phase",
    clientLogo: null,
    markupPct: 35,
    discount: { type: "percent", value: 10 },
    vatPct: 15,
    schedule: [
      { id: "s1", label: "On signature", percent: 40 },
      { id: "s2", label: "On delivery", percent: 60 },
    ],
    programs: [
      program({ name: "Discovery", days: 2, costLines: [{ id: newId(), label: "Trainer days", qty: 3, unitRate: 9000 }] }),
      program({ name: "Delivery", days: 3, markupPct: 60, costLines: [{ id: newId(), label: "Assessment", qty: 1, unitRate: 10000 }] }),
    ],
    customTerms: null,
    sentAt: null,
    pipeline: {},
  };
}

const moneyOf = (cell: XlsxCell): number => {
  if (cell && typeof cell === "object" && cell.t === "money") return cell.v;
  throw new Error(`not a money cell: ${JSON.stringify(cell)}`);
};

describe("buildCostingRows", () => {
  const proposal = fixture();
  const result = calc(proposal);
  const { rows, boldRows } = buildCostingRows(proposal, result);
  const label = (row: XlsxCell[]) => (typeof row[0] === "string" ? row[0] : "");
  const findRow = (prefix: string) => {
    const row = rows.find((r) => label(r).startsWith(prefix));
    if (!row) throw new Error(`row not found: ${prefix}`);
    return row;
  };

  it("title block, internal subtitle, and the frozen header layout", () => {
    expect(rows[0]).toEqual(["Leadership Track", "Maaden", "2026-09-02", "SAR"]);
    expect(rows[1][0]).toBe("Internal costing — not for client distribution");
    expect(rows[3]).toEqual(["Item", "Qty", "Unit rate", "Subtotal"]);
    expect(boldRows).toContain(0);
    expect(boldRows).toContain(3);
    expect(COSTING_COLS).toHaveLength(4);
  });

  it("bold rows carry ONLY text cells (the bold xf would strip number formats)", () => {
    for (const r of boldRows) {
      for (const cell of rows[r]) {
        expect(cell === null || typeof cell === "string").toBe(true);
      }
    }
  });

  it("per-phase economics match calc exactly, including the override", () => {
    expect(moneyOf(findRow("Phase total cost")[3])).toBe(27000);
    const phase2Price = findRow("Delivery");
    expect(boldRows).toContain(rows.indexOf(phase2Price));
    // Phase price rows appear once per phase, in order.
    const priceRows = rows.filter((r) => label(r) === "Phase price");
    expect(priceRows.map((r) => moneyOf(r[3]))).toEqual([result.programs[0].listShare, result.programs[1].listShare]);
    expect(result.programs[1].listShare).toBe(16000); // 10,000 x 1.6 (own markup)
    const markupRows = rows.filter((r) => label(r).startsWith("Markup %"));
    expect(label(markupRows[0])).toContain("(default)");
    expect(label(markupRows[1])).toContain("(own)");
  });

  it("summary block mirrors the calc result values, never formulas", () => {
    expect(moneyOf(findRow("Total cost")[3])).toBe(result.totalCost);
    expect(moneyOf(findRow("List price")[3])).toBe(result.listPrice);
    expect(moneyOf(findRow("Discount (10%)")[3])).toBe(result.discountAmount);
    expect(moneyOf(findRow("Net price")[3])).toBe(result.netPrice);
    expect(moneyOf(findRow("Total incl. VAT")[3])).toBe(result.totalIncVat);
    const marginPctRow = findRow("Margin %");
    expect(marginPctRow[3]).toEqual({ t: "pct", v: result.marginPct / 100 });
  });

  it("payment schedule rows render when the schedule is valid", () => {
    const sig = findRow("On signature");
    expect(sig[2]).toEqual({ t: "pct", v: 0.4 });
    expect(moneyOf(sig[3])).toBe(result.installments[0].amount);
  });

  it("clamped amount discount is flagged in the label", () => {
    const clamped = { ...fixture(), discount: { type: "amount" as const, value: 99999999 } };
    const r = buildCostingRows(clamped, calc(clamped));
    expect(r.rows.some((row) => label(row).includes("clamped to list price"))).toBe(true);
  });
});

describe("costing filename", () => {
  it("preserves Arabic and case, strips hostile characters", () => {
    expect(sanitizeFileName('شركة معادن / "الرياض"')).toBe("شركة معادن الرياض");
    expect(costingFileName("Maaden", "Leadership Track", "2026-09-02", "Untitled")).toBe(
      "Costing - Maaden - Leadership Track - 2026-09-02.xlsx",
    );
  });

  it("falls back to the localized untitled string", () => {
    expect(costingFileName("", "", "", "Untitled")).toBe("Costing - Untitled - Untitled - undated.xlsx");
  });
});
