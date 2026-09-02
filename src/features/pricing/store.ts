// Persistence for the pricing feature, behind a thin interface so the
// localStorage v1 can be swapped for Supabase later without touching the UI
// (design premise 5: local-first is debt with named repayment triggers).
//
// Layout (per-proposal keys, eng review 5A):
//   hni.pricing.v1.index            string[] of proposal ids, display order
//   hni.pricing.v1.proposal.<id>    one Proposal
//   hni.pricing.v1.settings         Settings
//
// A corrupted key loses one proposal, not the store; corrupt ids are reported
// so the screen can surface recovery instead of crashing.

import {
  asImageDataUrl,
  DEFAULT_SETTINGS,
  DEFAULT_TARGETS,
  normalizeProposal,
  type ExternalDeal,
  type Proposal,
  type Settings,
  type Targets,
} from "./types";

const PREFIX = "hni.pricing.v1";
const INDEX_KEY = `${PREFIX}.index`;
const SETTINGS_KEY = `${PREFIX}.settings`;
const EXTERNAL_INDEX_KEY = `${PREFIX}.externalIndex`;
const proposalKey = (id: string) => `${PREFIX}.proposal.${id}`;
const externalKey = (id: string) => `${PREFIX}.external.${id}`;

export type LoadResult = {
  proposals: Proposal[];
  externalDeals: ExternalDeal[];
  settings: Settings;
  /** Ids whose stored JSON failed to parse; surfaced for recovery, never fatal. */
  corruptIds: string[];
  /**
   * Cloud mode only: teammates' proposals (design: accounts-supabase.md).
   * A SEPARATE surface — never merged into `proposals`, never fed to
   * pipeline math (their deals arrive via the shared pipeline channel).
   * localStorage mode omits it.
   */
  teamProposals?: Array<{ proposal: Proposal; ownerId: string; ownerName: string }>;
};

export interface PricingStore {
  loadAll(): LoadResult;
  /**
   * Cloud-mode optional methods (SupabaseStore implements them; localStorage
   * mode omits them and the screen falls back to its historic write paths).
   */
  updateJourney?(proposal: Proposal, patch: Partial<import("./types").PipelineInfo>): void;
  updateTeamJourney?(proposalId: string, journey: import("./types").PipelineInfo): void;
  stampCopied?(rowIds: string[]): void;
  hasPending?(): boolean;
  /** Returns false when the write failed (quota, disabled storage). */
  saveProposal(proposal: Proposal, order: string[]): boolean;
  deleteProposal(id: string, order: string[]): boolean;
  /** Replaces the whole external-deal set (import is a snapshot; design T1). */
  replaceExternalDeals(deals: ExternalDeal[]): boolean;
  deleteExternalDeal(id: string): boolean;
  saveSettings(settings: Settings): boolean;
  exportAll(): string;
  /** Replaces the whole store with the imported payload. Throws on invalid input. */
  importAll(json: string): LoadResult;
}

/** v2 adds externalDeals and settings.targets; v1 payloads still import (design T3.5). */
type ExportPayload = {
  version: 1 | 2;
  settings: Settings;
  proposals: Proposal[];
  externalDeals?: ExternalDeal[];
};

function normalizeTargets(raw: unknown): Targets {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_TARGETS };
  const t = raw as Partial<Targets>;
  return {
    periodStart: typeof t.periodStart === "string" ? t.periodStart : null,
    periodEnd: typeof t.periodEnd === "string" ? t.periodEnd : null,
    revenueTarget: typeof t.revenueTarget === "number" ? t.revenueTarget : null,
    gpTarget: typeof t.gpTarget === "number" ? t.gpTarget : null,
  };
}

function isExternalDeal(value: unknown): value is ExternalDeal {
  if (typeof value !== "object" || value === null) return false;
  const d = value as Record<string, unknown>;
  return typeof d.id === "string" && typeof d.company === "string" && typeof d.projectName === "string";
}

function isProposal(value: unknown): value is Proposal {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return (
    typeof p.id === "string" &&
    typeof p.title === "string" &&
    typeof p.markupPct === "number" &&
    Array.isArray(p.programs) &&
    Array.isArray(p.schedule) &&
    typeof p.discount === "object" &&
    p.discount !== null
  );
}

export class LocalStoragePricingStore implements PricingStore {
  private read(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  private remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* removal failures are harmless */
    }
  }

  loadAll(): LoadResult {
    let ids: string[] = [];
    const corruptIds: string[] = [];

    const rawIndex = this.read(INDEX_KEY);
    if (rawIndex) {
      try {
        const parsed: unknown = JSON.parse(rawIndex);
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) ids = parsed;
      } catch {
        corruptIds.push("index");
      }
    }

    const proposals: Proposal[] = [];
    for (const id of ids) {
      const raw = this.read(proposalKey(id));
      if (raw === null) continue;
      try {
        const parsed: unknown = JSON.parse(raw);
        if (isProposal(parsed)) proposals.push(normalizeProposal(parsed));
        else corruptIds.push(id);
      } catch {
        corruptIds.push(id);
      }
    }

    const externalDeals: ExternalDeal[] = [];
    const rawExtIndex = this.read(EXTERNAL_INDEX_KEY);
    if (rawExtIndex) {
      try {
        const parsed: unknown = JSON.parse(rawExtIndex);
        if (Array.isArray(parsed)) {
          for (const id of parsed) {
            if (typeof id !== "string") continue;
            const raw = this.read(externalKey(id));
            if (raw === null) continue;
            try {
              const deal: unknown = JSON.parse(raw);
              // Backfill the 50% GP default onto rows imported before the
              // rule existed (only when the row has NO GP data at all).
              if (isExternalDeal(deal)) {
                externalDeals.push(deal.gpPct == null && deal.gpAmount == null ? { ...deal, gpPct: 50 } : deal);
              } else corruptIds.push(id);
            } catch {
              corruptIds.push(id);
            }
          }
        }
      } catch {
        corruptIds.push("externalIndex");
      }
    }

    let settings: Settings = { ...DEFAULT_SETTINGS };
    const rawSettings = this.read(SETTINGS_KEY);
    if (rawSettings) {
      try {
        const parsed = JSON.parse(rawSettings) as Partial<Settings>;
        if (typeof parsed.marginFloorPct === "number") settings.marginFloorPct = parsed.marginFloorPct;
        if (typeof parsed.lastExportAt === "string" || parsed.lastExportAt === null) {
          settings.lastExportAt = parsed.lastExportAt ?? null;
        }
        settings.signatureImage = asImageDataUrl(parsed.signatureImage);
        settings.stampImage = asImageDataUrl(parsed.stampImage);
        settings.targets = normalizeTargets(parsed.targets);
      } catch {
        corruptIds.push("settings");
      }
    }

    return { proposals, externalDeals, settings, corruptIds };
  }

  replaceExternalDeals(deals: ExternalDeal[]): boolean {
    const existing = this.read(EXTERNAL_INDEX_KEY);
    if (existing) {
      try {
        const parsed: unknown = JSON.parse(existing);
        if (Array.isArray(parsed)) for (const id of parsed) if (typeof id === "string") this.remove(externalKey(id));
      } catch {
        /* replaced below regardless */
      }
    }
    let ok = true;
    for (const deal of deals) ok = this.write(externalKey(deal.id), JSON.stringify(deal)) && ok;
    return this.write(EXTERNAL_INDEX_KEY, JSON.stringify(deals.map((d) => d.id))) && ok;
  }

  deleteExternalDeal(id: string): boolean {
    this.remove(externalKey(id));
    const raw = this.read(EXTERNAL_INDEX_KEY);
    let ids: string[] = [];
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) ids = parsed.filter((v): v is string => typeof v === "string");
    } catch {
      ids = [];
    }
    return this.write(EXTERNAL_INDEX_KEY, JSON.stringify(ids.filter((v) => v !== id)));
  }

  saveProposal(proposal: Proposal, order: string[]): boolean {
    const wroteProposal = this.write(proposalKey(proposal.id), JSON.stringify(proposal));
    const wroteIndex = this.write(INDEX_KEY, JSON.stringify(order));
    return wroteProposal && wroteIndex;
  }

  deleteProposal(id: string, order: string[]): boolean {
    this.remove(proposalKey(id));
    return this.write(INDEX_KEY, JSON.stringify(order));
  }

  saveSettings(settings: Settings): boolean {
    return this.write(SETTINGS_KEY, JSON.stringify(settings));
  }

  exportAll(): string {
    const { proposals, externalDeals, settings } = this.loadAll();
    const payload: ExportPayload = { version: 2, settings, proposals, externalDeals };
    return JSON.stringify(payload, null, 2);
  }

  importAll(json: string): LoadResult {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) throw new Error("invalid payload");
    const payload = parsed as Partial<ExportPayload>;
    if ((payload.version !== 1 && payload.version !== 2) || !Array.isArray(payload.proposals)) {
      throw new Error("invalid payload");
    }
    const proposals = payload.proposals.filter(isProposal).map(normalizeProposal);
    if (proposals.length !== payload.proposals.length) throw new Error("invalid proposal in payload");
    const externalDeals = Array.isArray(payload.externalDeals) ? payload.externalDeals.filter(isExternalDeal) : [];

    const settings: Settings = {
      marginFloorPct:
        typeof payload.settings?.marginFloorPct === "number"
          ? payload.settings.marginFloorPct
          : DEFAULT_SETTINGS.marginFloorPct,
      lastExportAt: payload.settings?.lastExportAt ?? null,
      signatureImage: asImageDataUrl(payload.settings?.signatureImage),
      stampImage: asImageDataUrl(payload.settings?.stampImage),
      targets: normalizeTargets(payload.settings?.targets),
    };

    // Replace-all semantics: import is a recovery operation.
    const existing = this.loadAll();
    for (const p of existing.proposals) this.remove(proposalKey(p.id));
    for (const p of proposals) this.write(proposalKey(p.id), JSON.stringify(p));
    this.write(INDEX_KEY, JSON.stringify(proposals.map((p) => p.id)));
    this.replaceExternalDeals(externalDeals);
    this.write(SETTINGS_KEY, JSON.stringify(settings));

    return { proposals, externalDeals, settings, corruptIds: [] };
  }
}

/** Trailing-edge debounce for autosave (eng review 5A: ~300ms). flush() runs a pending call immediately. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: A | null = null;
  const debounced = (...args: A) => {
    lastArgs = args;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, waitMs);
  };
  debounced.flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }
  };
  return debounced;
}
