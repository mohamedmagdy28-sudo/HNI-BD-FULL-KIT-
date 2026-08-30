// Domain model for the Pricing & Costing Calculator.
// Design: docs/designs/pricing-costing-calculator.md (APPROVED, eng-cleared).
// All money is integer whole SAR; rounded values are canonical at every derived
// stage, so the number displayed IS the number stored and quoted.

export type DiscountType = "percent" | "amount";

/**
 * Project types seed new programs with their fixed cost items. "workshop"
 * (Stand Alone Workshop) pre-creates trainer daily rate, materials printing,
 * air ticket, and accommodation lines; "custom" starts blank. A second real
 * project type slots in here as one more union member plus a template.
 */
export type ProjectType = "workshop" | "custom";

export type Discount = {
  type: DiscountType;
  /** percent: 0-100. amount: whole SAR. Stored exactly as the user entered it. */
  value: number;
};

export type CostLine = {
  id: string;
  label: string;
  qty: number;
  /** Whole SAR per unit. */
  unitRate: number;
};

export type Program = {
  id: string;
  name: string;
  /** Optional client-facing description; the client document shows a Description column only when at least one group has one. */
  description: string;
  days: number;
  participants: number;
  city: string;
  costLines: CostLine[];
};

export type ScheduleItem = {
  id: string;
  label: string;
  /** Integer percent of the total incl. VAT. All items must sum to exactly 100. */
  percent: number;
};

export type Proposal = {
  id: string;
  clientName: string;
  title: string;
  /** ISO date (yyyy-mm-dd). */
  date: string;
  currency: "SAR";
  /** Controls what Add-program seeds. Proposals saved before this field exist load as "custom". */
  projectType: ProjectType;
  /** What a group of cost lines is called: "phase" renders localized Phase; anything else renders localized Program. */
  sectionLabel: string;
  /** Client's logo as a downscaled data URL, shown on the cover next to the HNI logo. */
  clientLogo: string | null;
  /** Canonical stored pricing field. Editing target margin writes back the implied markup. */
  markupPct: number;
  discount: Discount;
  vatPct: number;
  schedule: ScheduleItem[];
  programs: Program[];
  /** Set by the explicit Mark-as-sent action; a sent proposal is locked read-only. */
  sentAt: string | null;
};

export type Settings = {
  /** Pricing policy: margin % below which the margin block warns. */
  marginFloorPct: number;
  /** Drives the weekly backup reminder banner. */
  lastExportAt: string | null;
};

export const DEFAULT_SETTINGS: Settings = {
  marginFloorPct: 30,
  lastExportAt: null,
};

export const VAT_DEFAULT = 15;
export const VAT_MIN = 0;
export const VAT_MAX = 25;

export function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

export function newCostLine(label = ""): CostLine {
  return { id: newId(), label, qty: 1, unitRate: 0 };
}

/** seedLabels pre-creates one line per fixed cost item; omitted -> one blank line. */
export function newProgram(name: string, seedLabels?: readonly string[]): Program {
  const costLines =
    seedLabels && seedLabels.length > 0 ? seedLabels.map((label) => newCostLine(label)) : [newCostLine()];
  return { id: newId(), name, description: "", days: 1, participants: 0, city: "", costLines };
}

export function newProposal(title: string, scheduleLabel: string, projectType: ProjectType = "workshop"): Proposal {
  return {
    id: newId(),
    clientName: "",
    title,
    date: new Date().toISOString().slice(0, 10),
    currency: "SAR",
    projectType,
    sectionLabel: "",
    clientLogo: null,
    markupPct: 35,
    discount: { type: "percent", value: 0 },
    vatPct: VAT_DEFAULT,
    schedule: [{ id: newId(), label: scheduleLabel, percent: 100 }],
    programs: [],
    sentAt: null,
  };
}

/** Backfills fields added after a proposal was stored (schema drift tolerance). */
/** Dropdown kinds for what a group of cost lines is called. "program" is stored as "". */
export const SECTION_KINDS = ["program", "phase", "module", "track", "sprint"] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

const LEGACY_SECTION_LABELS: Record<string, string> = {
  phase: "phase",
  "المرحلة": "phase",
  "مرحلة": "phase",
  module: "module",
  "الوحدة": "module",
  "وحدة": "module",
  track: "track",
  "المسار": "track",
  "مسار": "track",
  sprint: "sprint",
  "سبرنت": "sprint",
};

/** Localized display names for the section kinds, from the pricing dictionary. */
export function sectionKindLabels(p: {
  program: string;
  phase: string;
  module: string;
  track: string;
  sprint: string;
}): Record<SectionKind, string> {
  return { program: p.program, phase: p.phase, module: p.module, track: p.track, sprint: p.sprint };
}

/** Resolves a stored sectionLabel ("" = program) to its localized display name. */
export function sectionKindLabel(
  stored: string,
  p: { program: string; phase: string; module: string; track: string; sprint: string },
): string {
  const kind = (SECTION_KINDS as readonly string[]).includes(stored) ? (stored as SectionKind) : "program";
  return sectionKindLabels(p)[kind];
}

export function normalizeProposal(p: Proposal): Proposal {
  // Legacy free-text section labels collapse onto the dropdown kinds.
  const rawLabel = typeof p.sectionLabel === "string" ? p.sectionLabel.trim().toLowerCase() : "";
  return {
    ...p,
    projectType: p.projectType === "workshop" ? "workshop" : "custom",
    sectionLabel: LEGACY_SECTION_LABELS[rawLabel] ?? "",
    clientLogo: typeof p.clientLogo === "string" && p.clientLogo.startsWith("data:image/") ? p.clientLogo : null,
    programs: p.programs.map((pr) => ({ ...pr, description: typeof pr.description === "string" ? pr.description : "" })),
  };
}
