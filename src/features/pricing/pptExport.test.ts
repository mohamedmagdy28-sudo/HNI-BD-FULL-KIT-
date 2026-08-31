import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { getPricingDict } from "@/lib/i18n";
import { calc } from "./calc";
import {
  buildProposalDeck,
  deckMoney,
  MAX_DECK_PROGRAM_ROWS,
  proposalFileName,
  splitMixedRuns,
  type DeckInput,
} from "./pptExport";
import { BANK_DETAILS, TERMS_PAGE_1, TERMS_PAGE_2 } from "./template";
import { newId, DEFAULT_SETTINGS, type Program, type Proposal } from "./types";

const PIXEL_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: newId(),
    name: "Phase 1: Discovery",
    description: "Stakeholder interviews and needs analysis.",
    days: 2,
    participants: 0,
    city: "Riyadh",
    costLines: [{ id: newId(), label: "Consultant days", qty: 2, unitRate: 8000 }],
    ...overrides,
  };
}

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: newId(),
    clientName: "NEOM",
    title: "Transformation Journey",
    date: "2026-08-31",
    currency: "SAR",
    projectType: "custom",
    sectionLabel: "phase",
    clientLogo: PIXEL_PNG,
    markupPct: 40,
    discount: { type: "percent", value: 5 },
    vatPct: 15,
    schedule: [
      { id: "s1", label: "On signature", percent: 40 },
      { id: "s2", label: "On delivery", percent: 40 },
      { id: "s3", label: "On completion", percent: 20 },
    ],
    programs: [
      makeProgram(),
      makeProgram({ name: "Phase 2: Delivery", description: "Executive workshops on-site.", days: 6, participants: 20 }),
    ],
    sentAt: null,
    ...overrides,
  };
}

function makeInput(lang: "en" | "ar", proposal = makeProposal()): DeckInput {
  return {
    proposal,
    result: calc(proposal),
    settings: { ...DEFAULT_SETTINGS, signatureImage: PIXEL_PNG, stampImage: PIXEL_PNG },
    dict: getPricingDict(lang),
    lang,
    assets: { coverJpg: null, logoPng: PIXEL_PNG },
    termsPage1: TERMS_PAGE_1,
    termsPage2: TERMS_PAGE_2,
    bankDetails: BANK_DETAILS,
  };
}

async function unzipDeck(input: DeckInput): Promise<Map<string, string>> {
  const pres = buildProposalDeck(input);
  const base64 = (await pres.write({ outputType: "base64" })) as string;
  const zip = await JSZip.loadAsync(base64, { base64: true });
  const out = new Map<string, string>();
  for (const name of Object.keys(zip.files)) {
    if (name.startsWith("ppt/slides/slide") && name.endsWith(".xml")) {
      out.set(name, await zip.files[name].async("string"));
    }
  }
  return out;
}

describe("splitMixedRuns", () => {
  it("keeps single-script text as one run with the right face", () => {
    expect(splitMixedRuns("Financial Proposal", {})).toEqual([
      { text: "Financial Proposal", options: { fontFace: "Myriad Pro" } },
    ]);
    const ar = splitMixedRuns("الشروط والأحكام", {});
    expect(ar).toHaveLength(1);
    expect(ar[0].options.fontFace).toBe("Tajawal");
  });

  it("never emits a run mixing Arabic letters with Latin letters or digits", () => {
    for (const sample of ["الشروط والأحكام (1/2)", "مُعد لصالح NEOM", "SAR 15,000 ريال"]) {
      for (const run of splitMixedRuns(sample, {})) {
        const hasArabic = /[؀-ۿ]/.test(run.text);
        const hasLatinStrong = /[A-Za-z0-9]/.test(run.text);
        expect(hasArabic && hasLatinStrong).toBe(false);
      }
    }
  });
});

describe("deckMoney", () => {
  it("is all-Latin SAR with en-US grouping, minus sign preserved", () => {
    expect(deckMoney(107065)).toBe("SAR 107,065");
    expect(deckMoney(-4900)).toBe("−SAR 4,900");
    expect(deckMoney(0)).toBe("SAR 0");
  });
});

describe("proposalFileName (3B ASCII shortcut, asserted deliberately)", () => {
  it("slugs Latin names", () => {
    expect(proposalFileName("Acme Corp", "2026-08-31")).toBe("hni-proposal-acme-corp-2026-08-31.pptx");
  });
  it("falls back to untitled for Arabic and empty names (accepted 3B ceiling)", () => {
    expect(proposalFileName("بنك الرياض", "2026-08-31")).toBe("hni-proposal-untitled-2026-08-31.pptx");
    expect(proposalFileName("", "2026-08-31")).toBe("hni-proposal-untitled-2026-08-31.pptx");
  });
});

describe("buildProposalDeck", () => {
  it("assembles six slides; client name on slide 1, totals and SAR on slide 2, terms on slides 3-4, IBAN on slide 5", async () => {
    const slides = await unzipDeck(makeInput("en"));
    expect(slides.size).toBe(6);
    expect(slides.get("ppt/slides/slide1.xml")).toContain("NEOM");
    const slide2 = slides.get("ppt/slides/slide2.xml")!;
    expect(slide2).toContain("SAR 48,944");
    expect(slide2).toContain("SAR 44,800");
    expect(slides.get("ppt/slides/slide3.xml")).toContain("Training material and delivery will be conducted in English.");
    expect(slides.get("ppt/slides/slide4.xml")).toContain("Cancellation Terms");
    expect(slides.get("ppt/slides/slide5.xml")).toContain("SA1080000151608010789276");
    expect(slides.get("ppt/slides/slide6.xml")).toContain("THANK YOU");
  });

  it("Arabic deck money cells are SAR (never the Arabic currency symbol) and terms stay English", async () => {
    const slides = await unzipDeck(makeInput("ar"));
    const slide2 = slides.get("ppt/slides/slide2.xml")!;
    expect(slide2).toContain("SAR 48,944");
    expect(slide2).not.toContain("ر.س");
    expect(slides.get("ppt/slides/slide2.xml")).toContain("التفصيل المالي");
    expect(slides.get("ppt/slides/slide3.xml")).toContain("Training material and delivery will be conducted in English.");
  });

  it("caps program rows and shows the +N more line (T6.3)", async () => {
    const programs = Array.from({ length: MAX_DECK_PROGRAM_ROWS + 4 }, (_, i) =>
      makeProgram({ name: `Phase ${i + 1}`, description: "" }),
    );
    const slides = await unzipDeck(makeInput("en", makeProposal({ programs, discount: { type: "percent", value: 0 } })));
    const slide2 = slides.get("ppt/slides/slide2.xml")!;
    expect(slide2).toContain("+ 4 more");
    expect(slide2).not.toContain(`Phase ${MAX_DECK_PROGRAM_ROWS + 1}<`);
  });

  it("omits optional assets gracefully (no logo, no signature, no client logo, zero discount)", async () => {
    const proposal = makeProposal({ clientLogo: null, discount: { type: "percent", value: 0 } });
    const input = makeInput("en", proposal);
    input.assets = { coverJpg: null, logoPng: null };
    input.settings = { ...DEFAULT_SETTINGS };
    const slides = await unzipDeck(input);
    expect(slides.size).toBe(6);
    const slide2 = slides.get("ppt/slides/slide2.xml")!;
    expect(slide2).not.toContain(getPricingDict("en").docDiscount);
  });
});
