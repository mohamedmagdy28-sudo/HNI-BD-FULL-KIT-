// PPT export: a six-slide, template-matching, editable PowerPoint deck built
// entirely client-side with pptxgenjs (design: docs/designs/ppt-export.md,
// Post-Gate Revision). Slides are native objects wherever words live; only
// cover art, logos, motifs, signature, and stamp are images. All money in the
// Arabic deck renders as all-Latin "SAR n" runs (eng review T1): mixed
// Arabic+Latin inside one run triggers gitbrent/PptxGenJS#1349.
//
// Assets arrive as data URLs (dependency injection): the UI layer fetches
// brand files, tests pass fixtures, and Node test runs need no network.

import pptxgen from "pptxgenjs";
import type { CalcResult } from "./calc";
import { capRows, discountVisible, hasDescriptions, scheduleVisible } from "./documentPredicates";
import type { Proposal, Settings } from "./types";

// Localized strings the deck needs; structurally a subset of Dict["pricing"].
export type DeckDict = {
  docTitle: string;
  docProposedIn: string;
  docFor: string;
  docBreakdown: string;
  docTerms1: string;
  docTerms2: string;
  /** "Terms and Conditions ({k}/{n})" for custom terms pages. */
  docTermsPage: string;
  docBank: string;
  docDays: string;
  docParticipants: string;
  docUnitPrice: string;
  docInvestment: string;
  docSubtotal: string;
  docDiscount: string;
  docNet: string;
  docVat: string;
  docTotal: string;
  docScheduleTitle: string;
  docSignedHni: string;
  docSignedClientPre: string;
  docSignedClientPost: string;
  docThankYou: string;
  docGetInTouch: string;
  docCountries: string;
  docFooter: string;
  docProgram: string;
  phase: string;
  module: string;
  track: string;
  sprint: string;
  program: string;
  description: string;
  pptMore: string;
};

export type DeckAssets = {
  /** data:image/jpeg cover art; null renders a plain light cover. */
  coverJpg: string | null;
  /** data:image/png or svg logo; null omits the logo. */
  logoPng: string | null;
};

export type TermsSectionData = { heading: string; items: string[] };

export type DeckInput = {
  proposal: Proposal;
  result: CalcResult;
  settings: Settings;
  dict: DeckDict;
  lang: "en" | "ar";
  assets: DeckAssets;
  /** Static content injected by the caller (template.ts in the app; fixtures in tests). */
  termsPage1: TermsSectionData[];
  termsPage2: TermsSectionData[];
  bankDetails: Array<{ label: string; value: string }>;
  /**
   * Pre-paginated custom terms (the CALLER runs the shared paginator in
   * customTerms.ts); null/absent = the standard two terms slides.
   */
  customTermsPages?: Array<Array<{ kind: "heading" | "item" | "para"; text: string }>> | null;
};

// Template palette (pptxgenjs hex colors never carry a leading '#').
const MAGENTA = "91195A";
const BLACK = "231F20";
const GREY = "393C3C";
const GREY_MID = "999999";
const LINE = "E8E8EA";
const WHITE = "FFFFFF";

const PAGE_W = 13.33;
const PAGE_H = 7.5;
/** Slide 2 caps program rows; overflow gets a "+N more" line (eng review T6.3). */
export const MAX_DECK_PROGRAM_ROWS = 8;

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿ]/;

function font(_lang: "en" | "ar", text?: string): string {
  // Text-driven, not deck-driven: Arabic clauses (e.g. Arabic custom terms
  // exported inside the English deck) must carry Tajawal, or PowerPoint
  // substitutes an arbitrary Arabic fallback. Latin keeps the brand face.
  if (text && ARABIC_RE.test(text)) return "Tajawal";
  return "Myriad Pro";
}

/**
 * Splits text mixing Arabic and Latin segments into separate runs so no single
 * run carries both scripts (the #1349 corruption pattern). Latin-only or
 * Arabic-only text returns a single run.
 */
export function splitMixedRuns(
  text: string,
  base: { fontSize?: number; bold?: boolean; color?: string },
): Array<{ text: string; options: { fontFace: string; fontSize?: number; bold?: boolean; color?: string } }> {
  // Digits count as Latin-STRONG on purpose: Arabic words plus Latin digits in
  // one run is precisely the #1349 corruption pattern (the ر.س 15,000 case).
  type Kind = "ar" | "lat" | null;
  const kindOf = (ch: string): Kind => (ARABIC_RE.test(ch) ? "ar" : /[A-Za-z0-9]/.test(ch) ? "lat" : null);
  const runs: Array<{ text: string; kind: Kind }> = [];
  for (const ch of text) {
    const kind = kindOf(ch);
    const last = runs[runs.length - 1];
    if (!last) {
      runs.push({ text: ch, kind });
    } else if (kind === null || last.kind === null || kind === last.kind) {
      last.text += ch;
      if (last.kind === null) last.kind = kind;
    } else {
      runs.push({ text: ch, kind });
    }
  }
  return runs.map((r) => ({
    text: r.text,
    options: { fontFace: r.kind === "ar" ? "Tajawal" : "Myriad Pro", ...base },
  }));
}

/** All-Latin money string for every deck surface (T1). */
export function deckMoney(value: number): string {
  const abs = Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${value < 0 ? "−" : ""}SAR ${abs}`;
}

/**
 * Download filename. ASCII-only slug by explicit user decision (eng review 3B).
 * gstack-shortcut(3B): ceiling: Arabic client names collapse to "untitled";
 * upgrade when the team reports indistinguishable proposal files.
 */
export function proposalFileName(clientName: string, isoDate: string): string {
  const slug = clientName
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `hni-proposal-${slug || "untitled"}-${isoDate || "undated"}.pptx`;
}

function sectionLabelFor(p: DeckDict, stored: string): string {
  const map: Record<string, string> = { phase: p.phase, module: p.module, track: p.track, sprint: p.sprint };
  return map[stored] ?? p.docProgram;
}

type Slide = ReturnType<pptxgen["addSlide"]>;

function addChrome(slide: Slide, assets: DeckAssets, ring: string) {
  if (assets.logoPng) slide.addImage({ data: assets.logoPng, x: 0.35, y: 6.62, w: 1.49, h: 0.55 });
  slide.addImage({ data: ring, x: PAGE_W - 1.33, y: PAGE_H - 1.33, w: 1.33, h: 1.33 });
}

function svgDataUrl(svg: string): string {
  const b64 =
    typeof btoa === "function"
      ? btoa(svg)
      : // Node (vitest): Buffer path
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).Buffer.from(svg, "utf8").toString("base64");
  return `data:image/svg+xml;base64,${b64}`;
}

const QUARTER_RING = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 605.75 605.73"><path d="M605.75 0 605.75 0C271.19 0 0 271.19 0 605.73L222.48 605.73C222.48 394.1 394.09 222.56 605.75 222.56" fill="#91195A"/></svg>`,
);
const RING = svgDataUrl(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 313.65 313.65"><path d="M156.83 62.79C208.68 62.79 250.87 104.97 250.87 156.83 250.87 208.69 208.69 250.87 156.83 250.87 104.97 250.87 62.79 208.69 62.79 156.83 62.79 104.97 104.97 62.79 156.83 62.79M156.83 0C70.21 0 0 70.21 0 156.83 0 243.45 70.21 313.66 156.83 313.66 243.45 313.66 313.66 243.45 313.66 156.83 313.66 70.21 243.44 0 156.83 0L156.83 0Z" fill="#911E5C"/></svg>`,
);

function addSignatureStrip(slide: Slide, input: DeckInput) {
  const { dict: p, settings, proposal, lang } = input;
  const y = 6.55;
  // HNI side
  slide.addShape("line", { x: 2.9, y, w: 4.4, h: 0, line: { color: GREY, width: 0.75 } });
  slide.addText(splitMixedRuns(p.docSignedHni, { fontSize: 11, color: GREY }), {
    x: 2.9, y: y + 0.05, w: 4.4, h: 0.3, isTextBox: true, margin: 0, align: lang === "ar" ? "right" : "left",
  });
  if (settings.signatureImage) {
    slide.addImage({ data: settings.signatureImage, x: 3.05, y: y - 0.72, w: 2.2, h: 0.65, sizing: { type: "contain", w: 2.2, h: 0.65 } });
  }
  if (settings.stampImage) {
    slide.addImage({ data: settings.stampImage, x: 5.5, y: y - 1.0, w: 1.4, h: 1.05, sizing: { type: "contain", w: 1.4, h: 1.05 } });
  }
  // Client side (always blank for counter-signing)
  const clientLabel = `${p.docSignedClientPre} ${proposal.clientName || "…………………"} ${p.docSignedClientPost}`;
  slide.addShape("line", { x: 8.1, y, w: 4.4, h: 0, line: { color: GREY, width: 0.75 } });
  slide.addText(splitMixedRuns(clientLabel, { fontSize: 11, color: GREY }), {
    x: 8.1, y: y + 0.05, w: 4.4, h: 0.3, isTextBox: true, margin: 0, align: lang === "ar" ? "right" : "left",
  });
}

function addHeading(slide: Slide, text: string, lang: "en" | "ar", y = 0.28) {
  slide.addText(splitMixedRuns(text, { fontSize: 26, bold: true, color: BLACK }), {
    x: 0.35, y, w: 12.6, h: 0.6, isTextBox: true, margin: 0, align: lang === "ar" ? "right" : "left",
  });
}

function addTermsSlide(
  pres: pptxgen,
  input: DeckInput,
  title: string,
  sections: Array<{ heading: string; items: string[] }>,
) {
  const slide = pres.addSlide();
  addHeading(slide, title, input.lang, 0.2);
  const runs: Array<{ text: string; options: Record<string, unknown> }> = [];
  for (const s of sections) {
    runs.push({
      text: s.heading,
      options: { fontFace: "Myriad Pro", fontSize: 11.5, bold: true, color: BLACK, breakLine: true, paraSpaceBefore: 6 },
    });
    s.items.forEach((item, i) => {
      runs.push({
        text: item,
        options: {
          fontFace: "Myriad Pro", fontSize: 10, color: GREY, bullet: true,
          breakLine: i < s.items.length - 1 || true, paraSpaceAfter: 2,
        },
      });
    });
  }
  // Terms stay English (LTR) in both decks per the parent design decision.
  slide.addText(runs as never, { x: 0.35, y: 0.95, w: 12.6, h: 4.9, isTextBox: true, margin: 0, valign: "top", align: "left" });
  addSignatureStrip(slide, input);
  addChrome(slide, input.assets, QUARTER_RING);
}

const ARABIC_STRONG_RE = ARABIC_RE;

/**
 * Custom terms slides, one per pre-paginated page (design:
 * cost-excel-and-custom-terms.md). Every block renders through splitMixedRuns —
 * the guard against the mixed Arabic+Latin-digit run corruption (#1349) and
 * the Tajawal/Myriad assignment. Per-paragraph alignment follows the block's
 * own first strong character, so pasted Arabic clauses align right.
 * The legal-English note is deliberately absent (it asserts the standard
 * English text is authoritative, which is false for negotiated terms).
 */
function addCustomTermsSlides(pres: pptxgen, input: DeckInput) {
  const pages = input.customTermsPages ?? [];
  const isRtl = (text: string): boolean => {
    for (const ch of text) {
      if (ARABIC_STRONG_RE.test(ch)) return true;
      if (/[A-Za-z]/.test(ch)) return false;
    }
    return false;
  };
  pages.forEach((blocks, k) => {
    const slide = pres.addSlide();
    const title = input.dict.docTermsPage.replace("{k}", String(k + 1)).replace("{n}", String(pages.length));
    addHeading(slide, title, input.lang, 0.2);
    const runs: Array<{ text: string; options: Record<string, unknown> }> = [];
    for (const block of blocks) {
      const align = isRtl(block.text) ? "right" : "left";
      const base =
        block.kind === "heading"
          ? { fontSize: 11.5, bold: true, color: BLACK }
          : { fontSize: 10, color: GREY };
      const split = splitMixedRuns(block.text, base);
      split.forEach((run, i) => {
        const last = i === split.length - 1;
        runs.push({
          text: run.text,
          options: {
            ...run.options,
            align,
            rtlMode: align === "right",
            ...(block.kind === "item" && i === 0 ? { bullet: true } : {}),
            ...(last
              ? { breakLine: true, ...(block.kind === "heading" ? { paraSpaceBefore: 6 } : { paraSpaceAfter: 2 }) }
              : {}),
          },
        });
      });
    }
    slide.addText(runs as never, { x: 0.35, y: 0.95, w: 12.6, h: 4.9, isTextBox: true, margin: 0, valign: "top" });
    addSignatureStrip(slide, input);
    addChrome(slide, input.assets, QUARTER_RING);
  });
}

export function buildProposalDeck(input: DeckInput): pptxgen {
  const { proposal, result, dict: p, lang, assets } = input;
  const pres = new pptxgen();
  pres.defineLayout({ name: "HNI", width: PAGE_W, height: PAGE_H });
  pres.layout = "HNI";
  pres.title = `${proposal.title} — ${p.docTitle}`;

  const align = lang === "ar" ? ("right" as const) : ("left" as const);
  const groupLabel = sectionLabelFor(p, proposal.sectionLabel);
  const withDesc = hasDescriptions(proposal.programs);

  // ---- Slide 1: Cover -------------------------------------------------
  const cover = pres.addSlide();
  if (assets.coverJpg) cover.addImage({ data: assets.coverJpg, x: 0, y: 0, w: PAGE_W, h: PAGE_H });
  else cover.background = { color: "F4F4F5" };
  if (assets.logoPng) cover.addImage({ data: assets.logoPng, x: 0.95, y: 1.25, w: 2.03, h: 0.75 });
  if (proposal.clientLogo) {
    cover.addShape("line", { x: 3.2, y: 1.31, w: 0, h: 0.62, line: { color: GREY_MID, width: 0.75 } });
    cover.addImage({ data: proposal.clientLogo, x: 3.42, y: 1.25, w: 2.0, h: 0.75, sizing: { type: "contain", w: 2.0, h: 0.75 } });
  }
  cover.addText(splitMixedRuns(proposal.title || p.docTitle, { fontSize: 34, bold: true, color: BLACK }), {
    x: 0.46, y: 2.75, w: 7.6, h: 0.9, isTextBox: true, margin: 0, align: "left",
  });
  cover.addText(splitMixedRuns(p.docTitle, { fontSize: 24, bold: true, color: MAGENTA }), {
    x: 0.46, y: 3.7, w: 7.6, h: 0.6, isTextBox: true, margin: 0, align: "left",
  });
  const proposedIn = proposal.date
    ? new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn" : "en-US", { month: "long", year: "numeric" }).format(
        new Date(`${proposal.date}T00:00:00`),
      )
    : "";
  cover.addText(splitMixedRuns(`${p.docProposedIn} ${proposedIn}`, { fontSize: 15, bold: true, color: GREY }), {
    x: 0.46, y: 4.35, w: 7.6, h: 0.4, isTextBox: true, margin: 0, align: "left",
  });
  if (proposal.clientName) {
    cover.addText(splitMixedRuns(`${p.docFor} ${proposal.clientName}`, { fontSize: 13, color: GREY }), {
      x: 0.46, y: 4.78, w: 7.6, h: 0.4, isTextBox: true, margin: 0, align: "left",
    });
  }

  // ---- Slide 2: Financial Breakdown ----------------------------------
  const br = pres.addSlide();
  addHeading(br, p.docBreakdown, lang);
  const headerOpts = { bold: true, fontSize: 8.5, color: GREY, fill: { color: WHITE }, border: [
    { type: "none" }, { type: "none" }, { pt: 1.5, color: BLACK }, { type: "none" },
  ] } as const;
  const cell = (text: string, extra: Record<string, unknown> = {}) => ({
    text,
    options: { fontFace: font(lang, text), fontSize: 10.5, color: GREY, valign: "top", ...extra },
  });
  const num = (text: string, extra: Record<string, unknown> = {}) => cell(text, { align: "right", ...extra });

  const { shown, hiddenCount } = capRows(proposal.programs, MAX_DECK_PROGRAM_ROWS);
  const rows: unknown[][] = [];
  const header = [
    cell(groupLabel.toUpperCase(), headerOpts as never),
    ...(withDesc ? [cell(p.description.toUpperCase(), headerOpts as never)] : []),
    num(p.docDays.toUpperCase(), headerOpts as never),
    num(p.docParticipants.toUpperCase(), headerOpts as never),
    num(p.docUnitPrice.toUpperCase(), headerOpts as never),
    num(p.docInvestment.toUpperCase(), headerOpts as never),
  ];
  rows.push(header);
  for (const program of shown) {
    const totals = result.programs.find((x) => x.programId === program.id);
    rows.push([
      cell(`${program.name}${program.city ? ` · ${program.city}` : ""}`, { bold: true, color: BLACK }),
      ...(withDesc ? [cell(program.description || "—", { fontSize: 9 })] : []),
      num(String(program.days)),
      num(program.participants ? String(program.participants) : "—"),
      num(totals?.perDay != null ? deckMoney(totals.perDay) : "—"),
      num(totals ? deckMoney(totals.netShare) : "—", { bold: true, color: BLACK }),
    ]);
  }
  if (hiddenCount > 0) {
    rows.push([
      cell(p.pptMore.replace("{n}", String(hiddenCount)), { italic: true, colspan: withDesc ? 6 : 5 } as never),
    ]);
  }
  rows.push([
    cell("", {}),
    ...(withDesc ? [cell("", {})] : []),
    cell("", {}),
    num(p.docSubtotal, { bold: true, color: BLACK }),
    cell("", {}),
    num(deckMoney(result.listPrice), { bold: true, color: BLACK }),
  ]);
  const colW = withDesc ? [3.3, 3.3, 0.9, 1.3, 1.7, 2.1] : [5.6, 1.0, 1.5, 2.0, 2.5];
  br.addTable(rows as never, {
    x: 0.35, y: 1.15, w: 12.6, colW,
    border: { type: "solid", color: LINE, pt: 0.5 },
    margin: 0.04,
  });

  // Payment schedule (left) + totals ladder (right)
  const bottomY = 3.9;
  if (scheduleVisible(result, proposal.schedule.length)) {
    const schedRows: unknown[][] = [
      [cell(p.docScheduleTitle.toUpperCase(), { bold: true, fontSize: 9, color: BLACK })],
    ];
    proposal.schedule.forEach((item, i) => {
      const inst = result.installments.find((x) => x.itemId === item.id);
      schedRows.push([
        cell(`${i + 1}   ${item.label || "—"}`, {}),
        num(`${item.percent}%`, {}),
        num(inst ? deckMoney(inst.amount) : "—", { bold: true, color: BLACK }),
      ]);
    });
    // Header row spans; simplest: emit title as its own table then rows
    br.addTable(schedRows.slice(1) as never, {
      x: 0.35, y: bottomY + 0.35, w: 5.2, colW: [3.0, 0.7, 1.5],
      border: { type: "solid", color: LINE, pt: 0.5 }, margin: 0.04,
    });
    br.addText(splitMixedRuns(p.docScheduleTitle, { fontSize: 10, bold: true, color: BLACK }), {
      x: 0.35, y: bottomY, w: 5.2, h: 0.3, isTextBox: true, margin: 0, align,
    });
    br.addShape("line", { x: 0.35, y: bottomY + 0.32, w: 5.2, h: 0, line: { color: BLACK, width: 1.5 } });
  }

  const ladder: Array<[string, string, boolean]> = [];
  if (discountVisible(result)) ladder.push([p.docDiscount, deckMoney(-result.discountAmount), false]);
  ladder.push([p.docNet, deckMoney(result.netPrice), true]);
  ladder.push([`${p.docVat} ${proposal.vatPct}%`, deckMoney(result.vatAmount), false]);
  let ly = bottomY;
  for (const [label, value, bold] of ladder) {
    br.addText(splitMixedRuns(label, { fontSize: 11, bold, color: bold ? BLACK : GREY }), {
      x: 8.0, y: ly, w: 3.0, h: 0.3, isTextBox: true, margin: 0, align,
    });
    br.addText(value, {
      x: 11.0, y: ly, w: 1.95, h: 0.3, isTextBox: true, margin: 0, align: "right",
      fontFace: "Myriad Pro", fontSize: 11, bold, color: bold ? BLACK : GREY,
    });
    ly += 0.32;
  }
  // The page's single brand moment: the magenta total band.
  br.addShape("rect", { x: 8.0, y: ly + 0.05, w: 4.95, h: 0.42, fill: { color: MAGENTA } });
  br.addText(splitMixedRuns(p.docTotal, { fontSize: 12.5, bold: true, color: WHITE }), {
    x: 8.16, y: ly + 0.05, w: 3.2, h: 0.42, isTextBox: true, margin: 0, align, valign: "middle",
  });
  br.addText(deckMoney(result.totalIncVat), {
    x: 11.2, y: ly + 0.05, w: 1.6, h: 0.42, isTextBox: true, margin: 0, align: "right", valign: "middle",
    fontFace: "Myriad Pro", fontSize: 12.5, bold: true, color: WHITE,
  });
  addChrome(br, assets, QUARTER_RING);

  // ---- Slides 3-4 (or 3..N): Terms — custom pages when set, else the
  // standard two verbatim English slides. Same rule as the client view.
  if (input.customTermsPages && input.customTermsPages.length > 0) {
    addCustomTermsSlides(pres, input);
  } else {
    addTermsSlide(pres, input, p.docTerms1, input.termsPage1);
    addTermsSlide(pres, input, p.docTerms2, input.termsPage2);
  }

  // ---- Slide 5: Bank details ------------------------------------------
  const bank = pres.addSlide();
  addHeading(bank, p.docBank, lang, 0.45);
  const bankRows = input.bankDetails.map((row) => [
    cell(row.label, { bold: true, fontSize: 9.5, color: GREY }),
    cell(row.value, { color: BLACK }),
  ]);
  bank.addTable(bankRows as never, {
    x: 0.6, y: 1.6, w: 7.5, colW: [2.4, 5.1],
    border: { type: "solid", color: LINE, pt: 0.5 }, margin: 0.06,
  });
  addSignatureStrip(bank, input);
  addChrome(bank, assets, QUARTER_RING);

  // ---- Slide 6: Thank you ---------------------------------------------
  const thanks = pres.addSlide();
  thanks.addImage({ data: RING, x: -0.4, y: -0.4, w: 3.2, h: 3.2 });
  if (assets.logoPng) thanks.addImage({ data: assets.logoPng, x: 10.5, y: 0.85, w: 2.16, h: 0.8 });
  thanks.addText(splitMixedRuns(p.docThankYou, { fontSize: 52, bold: true, color: BLACK }), {
    x: 1.5, y: 2.8, w: 10.33, h: 1.2, isTextBox: true, margin: 0, align: "center",
  });
  thanks.addText(splitMixedRuns(p.docGetInTouch, { fontSize: 20, bold: true, color: BLACK }), {
    x: 0.57, y: 5.9, w: 6.0, h: 0.5, isTextBox: true, margin: 0, align,
  });
  thanks.addText(splitMixedRuns(p.docCountries, { fontSize: 12, color: GREY }), {
    x: 0.57, y: 6.45, w: 6.0, h: 0.35, isTextBox: true, margin: 0, align,
  });
  thanks.addImage({ data: QUARTER_RING, x: PAGE_W - 1.33, y: PAGE_H - 1.33, w: 1.33, h: 1.33 });

  return pres;
}
