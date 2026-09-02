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
  /**
   * Per-phase markup override (design: docs/designs/per-phase-pricing.md).
   * null/absent = inherit the proposal-level markup. Setting ANY phase's
   * override flips the whole proposal to per-phase totaling (gated in calc).
   */
  markupPct?: number | null;
};

/** The pipeline sheet's exact stage strings; stored and exported verbatim so the sheet's dropdown validation keeps working. UI shows localized labels. */
export const PIPELINE_STAGES = [
  "Proposal",
  "Initial Negotiation",
  "Final Negotiation",
  "Verbal Awarding",
  "Won",
  "Lost",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];
export const OPEN_STAGES: readonly PipelineStage[] = ["Proposal", "Initial Negotiation", "Final Negotiation", "Verbal Awarding"];

/**
 * Sales-journey state on a proposal. Deliberately editable after Mark-as-sent:
 * the sent-lock guarantees the QUOTED DOCUMENT, not the deal's later journey
 * (design: docs/designs/pipeline.md, sent-lock amendment). Writes go through
 * the structural updatePipeline path only.
 */
export type PipelineInfo = {
  source?: string;
  dealType?: string;
  sector?: string;
  primaryService?: string;
  stage?: PipelineStage;
  /** Integer percent 0-100. */
  winningProbability?: number;
  /**
   * Manual GP% for the pipeline, overriding the costing-derived margin
   * (user rule 2026-08-31: the reported GP is BD's call). undefined/null =
   * use the derived margin.
   */
  gpPctOverride?: number | null;
  deliveryStart?: string;
  deliveryEnd?: string;
  poNumber?: string;
  projectStatus?: string;
  notes?: string;
  /** Auto-stamped when stage becomes Won/Lost; cleared on revert to an open stage; a manual edit is never overwritten. */
  decidedAt?: string | null;
  /** Stamp of the last Copy-rows export that included this row (new-since-last-copy default). */
  copiedAt?: string | null;
};

/** A row imported from the pipeline sheet that has no app proposal. One-time backfill; never merged into proposals. */
export type ExternalDeal = {
  id: string;
  importedAt: string;
  date: string;
  source: string;
  dealType: string;
  sector: string;
  primaryService: string;
  company: string;
  projectName: string;
  stage: PipelineStage | "";
  winningProbability: number | null;
  deliveryStart: string;
  deliveryEnd: string;
  poNumber: string;
  currency: string;
  dealValue: number | null;
  gpPct: number | null;
  gpAmount: number | null;
  projectStatus: string;
  notes: string;
  flags: {
    /** Value/GP cell unparseable: excluded from sums, visible in the excluded note. */
    badValue?: boolean;
    /** Date unparseable: excluded from period math. */
    badDate?: boolean;
    /** Currency is not SAR: excluded from sums (values would mix denominations). */
    nonSar?: boolean;
  };
  /** Cloud mode only: set on teammates' pipeline rows (pseudo-externals) to badge the owner. */
  ownerName?: string;
};

export type Targets = {
  periodStart: string | null;
  periodEnd: string | null;
  revenueTarget: number | null;
  gpTarget: number | null;
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
  /**
   * Custom Terms & Conditions replacing the standard pages when non-blank
   * (design: docs/designs/cost-excel-and-custom-terms.md). Line format:
   * "- " = bullet, trailing ":" = heading. null/absent = standard terms.
   * Quote field: covered by the sent-lock like every other quote field.
   */
  customTerms?: string | null;
  /** Set by the explicit Mark-as-sent action; a sent proposal is locked read-only. */
  sentAt: string | null;
  /** Sales pipeline state; {} until the user sets a field. Membership rule: in the pipeline iff stage is set. */
  pipeline: PipelineInfo;
};

export type Settings = {
  /** Pricing policy: margin % below which the margin block warns. */
  marginFloorPct: number;
  /** Drives the weekly backup reminder banner. */
  lastExportAt: string | null;
  /**
   * Authorized signature and company stamp as data URLs, rendered on the
   * document's signature blocks. Stored ONLY in this browser, never in the
   * public bundle or repository: a downloadable signature/stamp image would
   * be a forgery kit. Uploaded once per machine via the client-view toolbar.
   */
  signatureImage: string | null;
  stampImage: string | null;
  /** Achievement targets for the pipeline dashboard. */
  targets: Targets;
};

export const DEFAULT_TARGETS: Targets = {
  periodStart: null,
  periodEnd: null,
  revenueTarget: null,
  gpTarget: null,
};

export const DEFAULT_SETTINGS: Settings = {
  marginFloorPct: 30,
  lastExportAt: null,
  signatureImage: null,
  stampImage: null,
  targets: DEFAULT_TARGETS,
};

/** Accepts only embedded image data, so imported backups cannot inject scriptable URLs. */
export function asImageDataUrl(value: unknown): string | null {
  return typeof value === "string" && value.startsWith("data:image/") ? value : null;
}

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
    pipeline: {},
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
  const rawPipeline = typeof p.pipeline === "object" && p.pipeline !== null ? p.pipeline : {};
  const stage = (PIPELINE_STAGES as readonly string[]).includes(rawPipeline.stage as string)
    ? (rawPipeline.stage as PipelineStage)
    : undefined;
  return {
    ...p,
    projectType: p.projectType === "workshop" ? "workshop" : "custom",
    sectionLabel: LEGACY_SECTION_LABELS[rawLabel] ?? "",
    clientLogo: asImageDataUrl(p.clientLogo),
    customTerms: typeof p.customTerms === "string" ? p.customTerms : null,
    pipeline: { ...rawPipeline, stage },
    programs: p.programs.map((pr) => ({
      ...pr,
      description: typeof pr.description === "string" ? pr.description : "",
      // Phase override: finite ≥0 kept (clamped), anything else = inherit.
      markupPct: typeof pr.markupPct === "number" && Number.isFinite(pr.markupPct) ? Math.max(0, pr.markupPct) : null,
    })),
  };
}

/**
 * Version-style title for a duplicated proposal (user rule 2026-09-01):
 * "AI Workshop" -> "AI Workshop V0.2"; "AI Workshop V0.2" -> "AI Workshop V0.3".
 * The trailing number increments; anything without a V-suffix starts at V0.2
 * (the original is implicitly V0.1). Case-insensitive; base title untouched.
 */
export function nextVersionTitle(title: string): string {
  const m = /^(.*?)\s*[vV](\d+)\.(\d+)\s*$/.exec(title);
  if (m) return `${m[1]} V${Number(m[2])}.${Number(m[3]) + 1}`.trim();
  return `${title.trim()} V0.2`.trim();
}

/** Membership rule: a proposal is in the pipeline iff its stage is set (design T3.6). */
export function inPipeline(p: Proposal): boolean {
  return p.pipeline.stage !== undefined;
}

/**
 * External deal GP amount: Revenue x GP% when both are known (user rule,
 * 2026-08-31); the imported sheet figure is only a fallback for rows missing
 * a GP%. Table, totals, and sheet export all use this one function.
 */
export function dealGpAmount(dealValue: number | null, gpPct: number | null, fallback: number | null): number | null {
  if (dealValue != null && gpPct != null && Number.isFinite(dealValue) && Number.isFinite(gpPct)) {
    return Math.round((dealValue * gpPct) / 100);
  }
  return fallback;
}
