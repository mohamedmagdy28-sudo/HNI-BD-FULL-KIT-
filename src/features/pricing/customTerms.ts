// Custom Terms & Conditions: one free-text box per proposal, rendered on the
// branded terms pages and PPT slides (design: docs/designs/cost-excel-and-custom-terms.md).
//
// The block model is LINE-based so parse and serialize are exact inverses:
// each non-blank line is one block. This module is the SINGLE source of truth
// for both renderers — the HTML pages and the PPT slides consume the same
// paginated output, so the two surfaces can never disagree on page breaks.

import type { Proposal } from "./types";
import type { TermsSection } from "./template";

export type TermsBlock = { kind: "heading" | "item" | "para"; text: string };

/**
 * The ONLY definition of "custom terms active". Both renderers, the badge,
 * and the legal-note suppression consume this: a cleared box renders standard
 * terms, shows no badge, and suppresses nothing.
 */
export function hasCustomTerms(p: Pick<Proposal, "customTerms">): boolean {
  return p.customTerms != null && p.customTerms.trim() !== "";
}

const RTL_RE = /[؀-ۿݐ-ݿࢠ-ࣿ֐-׿]/;
const LTR_RE = /[A-Za-z]/;

/** True when the first strong character is right-to-left (Arabic/Hebrew). */
export function isRtlText(text: string): boolean {
  for (const ch of text) {
    if (RTL_RE.test(ch)) return true;
    if (LTR_RE.test(ch)) return false;
  }
  return false;
}

/**
 * Line rules, checked in THIS order (the item rule runs first so a bullet
 * ending with ":" stays a bullet):
 *   1. "- text"            -> item (marker stripped, renders as a disc bullet)
 *   2. <=80 chars ending ":" -> heading (displayed as-is, colon retained)
 *   3. anything else       -> para
 * Blank lines are separators only.
 */
export function parseCustomTerms(text: string): TermsBlock[] {
  const blocks: TermsBlock[] = [];
  for (const rawLine of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();
    if (line === "") continue;
    if (line.startsWith("- ")) blocks.push({ kind: "item", text: line.slice(2).trim() });
    else if (line.length <= 80 && line.endsWith(":")) blocks.push({ kind: "heading", text: line });
    else blocks.push({ kind: "para", text: line });
  }
  return blocks;
}

/**
 * Standard terms in the box's own format, for the switch-to-custom prefill:
 * the user edits deltas of the counsel-approved text instead of retyping it.
 * A ":" heading marker is appended only when the heading lacks one, so the
 * round-trip (colon-normalized) reproduces every heading and item in order.
 */
export function serializeStandardTerms(sections: TermsSection[]): string {
  return sections
    .map((s) => {
      const heading = s.heading.endsWith(":") ? s.heading : `${s.heading}:`;
      return [heading, ...s.items.map((item) => `- ${item}`)].join("\n");
    })
    .join("\n\n");
}

// Pagination line budget, tuned to the BINDING constraint: the PPT terms text
// box (12.6in x 4.9in at 10pt), which is smaller than the HTML page's content
// area. Constants are deliberately conservative so a page never overflows
// either surface; validated against the standard terms (which must stay at
// 2 pages) and a long-clause worst-case fixture in customTerms.test.ts.
export const CHARS_PER_LINE = 120;
export const LINES_PER_PAGE = 22;
/** A heading costs its line plus leading space above the section. */
const HEADING_LINES = 2;
/** Bullet indent + marker eats into the first line's width. */
const ITEM_PREFIX = 4;

function blockLines(block: TermsBlock): number {
  if (block.kind === "heading") return HEADING_LINES;
  const length = block.text.length + (block.kind === "item" ? ITEM_PREFIX : 0);
  return Math.max(1, Math.ceil(length / CHARS_PER_LINE));
}

/**
 * Deterministic pagination shared by the HTML pages and the PPT slides.
 * A heading never orphans at a page bottom: when its first following block
 * does not also fit, the heading moves to the next page with it.
 */
export function paginateTerms(blocks: TermsBlock[]): TermsBlock[][] {
  const pages: TermsBlock[][] = [];
  let page: TermsBlock[] = [];
  let used = 0;
  const flush = () => {
    if (page.length > 0) pages.push(page);
    page = [];
    used = 0;
  };
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    let cost = blockLines(block);
    if (block.kind === "heading") {
      const next = blocks[i + 1];
      if (next && next.kind !== "heading") cost += blockLines(next);
      if (used > 0 && used + cost > LINES_PER_PAGE) flush();
      page.push(block);
      used += HEADING_LINES;
      continue;
    }
    if (used > 0 && used + cost > LINES_PER_PAGE) flush();
    page.push(block);
    used += blockLines(block);
  }
  flush();
  return pages.length > 0 ? pages : [[]];
}

/** Page count the editor's live indicator shows. */
export function customTermsPageCount(text: string): number {
  const blocks = parseCustomTerms(text);
  return blocks.length === 0 ? 0 : paginateTerms(blocks).length;
}
