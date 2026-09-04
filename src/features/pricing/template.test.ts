import { describe, expect, it } from "vitest";
import { TERMS_PAGE_1, TERMS_PAGE_1_AR, TERMS_PAGE_2, TERMS_PAGE_2_AR } from "./template";

// The Arabic terms are a translation of the counsel-approved English text.
// If someone edits one side, this pins the drift: same sections, same number
// of clauses, page by page.
describe("standard terms EN/AR parity", () => {
  const pages = [
    { en: TERMS_PAGE_1, ar: TERMS_PAGE_1_AR },
    { en: TERMS_PAGE_2, ar: TERMS_PAGE_2_AR },
  ];

  it("same section and clause counts per page", () => {
    for (const { en, ar } of pages) {
      expect(ar.length).toBe(en.length);
      en.forEach((section, i) => {
        expect(ar[i].items.length).toBe(section.items.length);
      });
    }
  });

  it("arabic pages actually contain Arabic text", () => {
    for (const { ar } of pages) {
      for (const section of ar) {
        expect(section.heading).toMatch(/[؀-ۿ]/);
        for (const item of section.items) {
          expect(item).toMatch(/[؀-ۿ]/);
        }
      }
    }
  });
});
