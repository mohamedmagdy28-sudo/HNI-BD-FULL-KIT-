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

import { asImageDataUrl, DEFAULT_SETTINGS, normalizeProposal, type Proposal, type Settings } from "./types";

const PREFIX = "hni.pricing.v1";
const INDEX_KEY = `${PREFIX}.index`;
const SETTINGS_KEY = `${PREFIX}.settings`;
const proposalKey = (id: string) => `${PREFIX}.proposal.${id}`;

export type LoadResult = {
  proposals: Proposal[];
  settings: Settings;
  /** Ids whose stored JSON failed to parse; surfaced for recovery, never fatal. */
  corruptIds: string[];
};

export interface PricingStore {
  loadAll(): LoadResult;
  /** Returns false when the write failed (quota, disabled storage). */
  saveProposal(proposal: Proposal, order: string[]): boolean;
  deleteProposal(id: string, order: string[]): boolean;
  saveSettings(settings: Settings): boolean;
  exportAll(): string;
  /** Replaces the whole store with the imported payload. Throws on invalid input. */
  importAll(json: string): LoadResult;
}

type ExportPayload = {
  version: 1;
  settings: Settings;
  proposals: Proposal[];
};

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
      } catch {
        corruptIds.push("settings");
      }
    }

    return { proposals, settings, corruptIds };
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
    const { proposals, settings } = this.loadAll();
    const payload: ExportPayload = { version: 1, settings, proposals };
    return JSON.stringify(payload, null, 2);
  }

  importAll(json: string): LoadResult {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== "object" || parsed === null) throw new Error("invalid payload");
    const payload = parsed as Partial<ExportPayload>;
    if (payload.version !== 1 || !Array.isArray(payload.proposals)) throw new Error("invalid payload");
    const proposals = payload.proposals.filter(isProposal).map(normalizeProposal);
    if (proposals.length !== payload.proposals.length) throw new Error("invalid proposal in payload");

    const settings: Settings = {
      marginFloorPct:
        typeof payload.settings?.marginFloorPct === "number"
          ? payload.settings.marginFloorPct
          : DEFAULT_SETTINGS.marginFloorPct,
      lastExportAt: payload.settings?.lastExportAt ?? null,
      signatureImage: asImageDataUrl(payload.settings?.signatureImage),
      stampImage: asImageDataUrl(payload.settings?.stampImage),
    };

    // Replace-all semantics: import is a recovery operation.
    const existing = this.loadAll();
    for (const p of existing.proposals) this.remove(proposalKey(p.id));
    for (const p of proposals) this.write(proposalKey(p.id), JSON.stringify(p));
    this.write(INDEX_KEY, JSON.stringify(proposals.map((p) => p.id)));
    this.write(SETTINGS_KEY, JSON.stringify(settings));

    return { proposals, settings, corruptIds: [] };
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
