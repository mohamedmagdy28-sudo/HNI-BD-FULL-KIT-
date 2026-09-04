import { describe, expect, it } from "vitest";
import {
  CHARS_PER_LINE,
  LINES_PER_PAGE,
  customTermsPageCount,
  hasCustomTerms,
  isRtlText,
  paginateTerms,
  parseCustomTerms,
  serializeStandardTerms,
} from "./customTerms";
import { TERMS_PAGE_1, TERMS_PAGE_1_AR, TERMS_PAGE_2, TERMS_PAGE_2_AR } from "./template";

describe("hasCustomTerms (the single active-predicate)", () => {
  it("null, absent, and whitespace-only are all inactive", () => {
    expect(hasCustomTerms({ customTerms: null })).toBe(false);
    expect(hasCustomTerms({})).toBe(false);
    expect(hasCustomTerms({ customTerms: "   \n\n  " })).toBe(false);
    expect(hasCustomTerms({ customTerms: "Payment due in 30 days." })).toBe(true);
  });
});

describe("parseCustomTerms line rules", () => {
  it("item rule runs BEFORE the heading rule: a bullet ending with ':' stays a bullet", () => {
    const blocks = parseCustomTerms("- Standard payment terms:");
    expect(blocks).toEqual([{ kind: "item", text: "Standard payment terms:" }]);
  });

  it("classifies headings, items, and paragraphs; blank lines are separators only", () => {
    const blocks = parseCustomTerms("Payment Terms:\n\n- 30 days from invoice.\nAll fees are in SAR.\n");
    expect(blocks).toEqual([
      { kind: "heading", text: "Payment Terms:" },
      { kind: "item", text: "30 days from invoice." },
      { kind: "para", text: "All fees are in SAR." },
    ]);
  });

  it("a long line ending with ':' is a paragraph, not a heading", () => {
    const long = `${"x".repeat(81)}:`;
    expect(parseCustomTerms(long)[0].kind).toBe("para");
  });

  it("normalizes CRLF", () => {
    expect(parseCustomTerms("A:\r\n- b\r\n")).toEqual([
      { kind: "heading", text: "A:" },
      { kind: "item", text: "b" },
    ]);
  });
});

describe("serializeStandardTerms round-trip (colon-normalized)", () => {
  it("reproduces every heading and item of the standard terms, in order", () => {
    const sections = [...TERMS_PAGE_1, ...TERMS_PAGE_2];
    const blocks = parseCustomTerms(serializeStandardTerms(sections));
    const expected = sections.flatMap((s) => [
      { kind: "heading" as const, text: s.heading.endsWith(":") ? s.heading : `${s.heading}:` },
      ...s.items.map((item) => ({ kind: "item" as const, text: item })),
    ]);
    expect(blocks).toEqual(expected);
  });

  it("does not double the colon on headings that already carry one", () => {
    const text = serializeStandardTerms([{ heading: "Already has one:", items: ["a"] }]);
    expect(text.startsWith("Already has one:\n")).toBe(true);
    expect(text.includes("::")).toBe(false);
  });

  it("round-trips the Arabic standard terms (prefill for the Arabic UI)", () => {
    const sections = [...TERMS_PAGE_1_AR, ...TERMS_PAGE_2_AR];
    const blocks = parseCustomTerms(serializeStandardTerms(sections));
    const expected = sections.flatMap((s) => [
      { kind: "heading" as const, text: s.heading.endsWith(":") ? s.heading : `${s.heading}:` },
      ...s.items.map((item) => ({ kind: "item" as const, text: item })),
    ]);
    expect(blocks).toEqual(expected);
  });

  it("arabic standard terms paginate to 2 pages, like the English ones", () => {
    const blocks = parseCustomTerms(serializeStandardTerms([...TERMS_PAGE_1_AR, ...TERMS_PAGE_2_AR]));
    expect(paginateTerms(blocks).length).toBe(2);
  });
});

describe("paginateTerms", () => {
  const para = (n: number) => ({ kind: "para" as const, text: "x".repeat(n) });

  it("standard terms paginate to exactly 2 pages (parity with today's document)", () => {
    const blocks = parseCustomTerms(serializeStandardTerms([...TERMS_PAGE_1, ...TERMS_PAGE_2]));
    expect(paginateTerms(blocks).length).toBe(2);
  });

  it("splits when the line budget is exceeded and every block survives", () => {
    const blocks = Array.from({ length: LINES_PER_PAGE + 5 }, () => para(10));
    const pages = paginateTerms(blocks);
    expect(pages.length).toBe(2);
    expect(pages.flat().length).toBe(blocks.length);
  });

  it("a long block costs multiple lines", () => {
    // Each block spans 3 lines; only floor(LINES_PER_PAGE / 3) fit per page.
    const blocks = Array.from({ length: 10 }, () => para(CHARS_PER_LINE * 2 + 1));
    const pages = paginateTerms(blocks);
    const perPage = Math.floor(LINES_PER_PAGE / 3);
    expect(pages[0].length).toBe(perPage);
  });

  it("a heading never orphans at a page bottom", () => {
    // Fill the page so the heading alone would fit but heading + first item
    // would not: the heading must move to page 2 WITH its item.
    const filler = Array.from({ length: LINES_PER_PAGE - 2 }, () => para(10));
    const pages = paginateTerms([...filler, { kind: "heading", text: "H:" }, { kind: "item", text: "clause" }]);
    expect(pages.length).toBe(2);
    expect(pages[1][0]).toEqual({ kind: "heading", text: "H:" });
    expect(pages[1][1]).toEqual({ kind: "item", text: "clause" });
  });

  it("empty input yields one empty page (renderer never divides by zero)", () => {
    expect(paginateTerms([])).toEqual([[]]);
    expect(customTermsPageCount("")).toBe(0);
    expect(customTermsPageCount("one clause")).toBe(1);
  });
});

describe("isRtlText", () => {
  it("detects the first strong character", () => {
    expect(isRtlText("الشروط والأحكام")).toBe(true);
    expect(isRtlText("Payment terms")).toBe(false);
    expect(isRtlText("30 يوم من تاريخ الفاتورة")).toBe(true); // digits are weak
    expect(isRtlText("- 123 …")).toBe(false); // no strong char at all
  });
});
