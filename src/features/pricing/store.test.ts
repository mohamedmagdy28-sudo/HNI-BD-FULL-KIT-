import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { debounce, LocalStoragePricingStore } from "./store";
import { DEFAULT_TARGETS, newProgram, newProposal, normalizeProposal, type Proposal } from "./types";

// Minimal localStorage stand-in for the node test environment.
class MemoryStorage {
  private map = new Map<string, string>();
  failWrites = false;
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    if (this.failWrites) throw new Error("QuotaExceededError");
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  raw() {
    return this.map;
  }
}

let storage: MemoryStorage;
let store: LocalStoragePricingStore;

function proposal(title: string): Proposal {
  return { ...newProposal(title, "On signature"), clientName: "Acme" };
}

beforeEach(() => {
  storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  store = new LocalStoragePricingStore();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("LocalStoragePricingStore", () => {
  it("seeds defaults when storage is empty", () => {
    const r = store.loadAll();
    expect(r.proposals).toEqual([]);
    expect(r.settings.marginFloorPct).toBe(30);
    expect(r.corruptIds).toEqual([]);
  });

  it("round-trips proposals through per-proposal keys in index order", () => {
    const a = proposal("A");
    const b = proposal("B");
    store.saveProposal(a, [a.id]);
    store.saveProposal(b, [b.id, a.id]);
    const r = store.loadAll();
    expect(r.proposals.map((x) => x.title)).toEqual(["B", "A"]);
    expect(storage.raw().has(`hni.pricing.v1.proposal.${a.id}`)).toBe(true);
  });

  it("a corrupted proposal key loses one proposal, not the store", () => {
    const a = proposal("A");
    const b = proposal("B");
    store.saveProposal(a, [a.id]);
    store.saveProposal(b, [a.id, b.id]);
    storage.setItem(`hni.pricing.v1.proposal.${a.id}`, "{not json");
    const r = store.loadAll();
    expect(r.proposals.map((x) => x.title)).toEqual(["B"]);
    expect(r.corruptIds).toEqual([a.id]);
  });

  it("corrupted settings fall back to defaults and are reported", () => {
    storage.setItem("hni.pricing.v1.settings", "garbage");
    const r = store.loadAll();
    expect(r.settings.marginFloorPct).toBe(30);
    expect(r.corruptIds).toContain("settings");
  });

  it("signature and stamp settings round-trip and reject non-image values", () => {
    store.saveSettings({
      marginFloorPct: 30,
      lastExportAt: null,
      signatureImage: "data:image/png;base64,SIG",
      stampImage: "data:image/png;base64,STAMP",
      targets: DEFAULT_TARGETS,
    });
    const r = store.loadAll();
    expect(r.settings.signatureImage).toBe("data:image/png;base64,SIG");
    expect(r.settings.stampImage).toBe("data:image/png;base64,STAMP");

    storage.setItem(
      "hni.pricing.v1.settings",
      JSON.stringify({ marginFloorPct: 30, lastExportAt: null, signatureImage: "https://evil/x.png", stampImage: 42 }),
    );
    const bad = store.loadAll();
    expect(bad.settings.signatureImage).toBeNull();
    expect(bad.settings.stampImage).toBeNull();
  });

  it("write failures return false instead of throwing", () => {
    const a = proposal("A");
    storage.failWrites = true;
    expect(store.saveProposal(a, [a.id])).toBe(false);
    expect(store.saveSettings({ marginFloorPct: 30, lastExportAt: null, signatureImage: null, stampImage: null, targets: DEFAULT_TARGETS })).toBe(false);
  });

  it("deleteProposal removes the key and rewrites the index", () => {
    const a = proposal("A");
    const b = proposal("B");
    store.saveProposal(a, [a.id]);
    store.saveProposal(b, [a.id, b.id]);
    store.deleteProposal(a.id, [b.id]);
    const r = store.loadAll();
    expect(r.proposals.map((x) => x.title)).toEqual(["B"]);
    expect(storage.raw().has(`hni.pricing.v1.proposal.${a.id}`)).toBe(false);
  });

  it("export and import round-trip the whole store", () => {
    const a = proposal("A");
    store.saveProposal(a, [a.id]);
    store.saveSettings({ marginFloorPct: 25, lastExportAt: "2026-08-01T00:00:00Z", signatureImage: null, stampImage: null, targets: DEFAULT_TARGETS });
    const json = store.exportAll();

    // Fresh store: import replaces everything.
    const other = proposal("Other");
    store.saveProposal(other, [other.id, a.id]);
    const r = store.importAll(json);
    expect(r.proposals.map((x) => x.title)).toEqual(["A"]);
    expect(r.settings.marginFloorPct).toBe(25);
    expect(storage.raw().has(`hni.pricing.v1.proposal.${other.id}`)).toBe(false);
  });

  it("import rejects malformed payloads and changes nothing", () => {
    const a = proposal("A");
    store.saveProposal(a, [a.id]);
    expect(() => store.importAll("not json")).toThrow();
    expect(() => store.importAll('{"version":3,"proposals":[]}')).toThrow();
    expect(() => store.importAll('{"version":2}')).toThrow();
    expect(() => store.importAll('{"version":1,"proposals":[{"bad":true}]}')).toThrow();
    expect(store.loadAll().proposals.map((x) => x.title)).toEqual(["A"]);
  });
});

describe("project types", () => {
  it("newProgram seeds one line per fixed cost item for workshops", () => {
    const seeded = newProgram("W1", ["Trainer daily rate", "Materials printing", "Air ticket", "Accommodation"]);
    expect(seeded.costLines.map((l) => l.label)).toEqual([
      "Trainer daily rate",
      "Materials printing",
      "Air ticket",
      "Accommodation",
    ]);
    expect(seeded.costLines.every((l) => l.qty === 1 && l.unitRate === 0)).toBe(true);
  });

  it("newProgram without seeds starts with one blank line", () => {
    expect(newProgram("C1").costLines).toHaveLength(1);
    expect(newProgram("C2", []).costLines).toHaveLength(1);
  });

  it("normalizeProposal collapses legacy free-text section labels onto the dropdown kinds", () => {
    const base = newProposal("X", "On signature");
    expect(normalizeProposal({ ...base, sectionLabel: "Phase" }).sectionLabel).toBe("phase");
    expect(normalizeProposal({ ...base, sectionLabel: " phase " }).sectionLabel).toBe("phase");
    expect(normalizeProposal({ ...base, sectionLabel: "المرحلة" }).sectionLabel).toBe("phase");
    expect(normalizeProposal({ ...base, sectionLabel: "Module" }).sectionLabel).toBe("module");
    expect(normalizeProposal({ ...base, sectionLabel: "المسار" }).sectionLabel).toBe("track");
    expect(normalizeProposal({ ...base, sectionLabel: "Sprint" }).sectionLabel).toBe("sprint");
    expect(normalizeProposal({ ...base, sectionLabel: "Workstream" }).sectionLabel).toBe("");
    expect(normalizeProposal({ ...base, sectionLabel: "" }).sectionLabel).toBe("");
  });

  it("normalizeProposal keeps only valid image data URLs as client logos", () => {
    const base = newProposal("X", "On signature");
    expect(normalizeProposal({ ...base, clientLogo: "data:image/png;base64,AAAA" }).clientLogo).toBe(
      "data:image/png;base64,AAAA",
    );
    expect(normalizeProposal({ ...base, clientLogo: "javascript:alert(1)" }).clientLogo).toBeNull();
    expect(normalizeProposal({ ...base, clientLogo: "https://x/logo.png" }).clientLogo).toBeNull();
    const legacy = { ...base } as Record<string, unknown>;
    delete legacy.clientLogo;
    expect(normalizeProposal(legacy as unknown as Proposal).clientLogo).toBeNull();
  });

  it("normalizeProposal backfills projectType as custom for pre-field proposals", () => {
    const legacy = { ...newProposal("Old", "On signature") } as Record<string, unknown>;
    delete legacy.projectType;
    expect(normalizeProposal(legacy as unknown as Proposal).projectType).toBe("custom");
    expect(normalizeProposal(newProposal("New", "On signature", "workshop")).projectType).toBe("workshop");
  });

  it("loadAll normalizes stored proposals missing projectType, sectionLabel, and descriptions", () => {
    const p = newProposal("Legacy", "On signature");
    p.programs = [newProgram("Old program")];
    const stripped = JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
    delete stripped.projectType;
    delete stripped.sectionLabel;
    delete (stripped.programs as Record<string, unknown>[])[0].description;
    storage.setItem("hni.pricing.v1.index", JSON.stringify([p.id]));
    storage.setItem(`hni.pricing.v1.proposal.${p.id}`, JSON.stringify(stripped));
    const r = store.loadAll();
    expect(r.proposals[0].projectType).toBe("custom");
    expect(r.proposals[0].sectionLabel).toBe("");
    expect(r.proposals[0].programs[0].description).toBe("");
    expect(r.corruptIds).toEqual([]);
  });
});

describe("external deals and targets", () => {
  function deal(company: string): import("./types").ExternalDeal {
    return {
      id: crypto.randomUUID(),
      importedAt: "2026-08-30T00:00:00.000Z",
      date: "2026-06-01",
      source: "",
      dealType: "",
      sector: "",
      primaryService: "",
      company,
      projectName: "Deal",
      stage: "Won",
      winningProbability: null,
      deliveryStart: "",
      deliveryEnd: "",
      poNumber: "",
      currency: "SAR",
      dealValue: 1000,
      gpPct: null,
      gpAmount: null,
      projectStatus: "",
      notes: "",
      flags: {},
    };
  }

  it("replaceExternalDeals round-trips and a second replace removes old keys", () => {
    const a = deal("A");
    const b = deal("B");
    expect(store.replaceExternalDeals([a, b])).toBe(true);
    expect(store.loadAll().externalDeals.map((d) => d.company)).toEqual(["A", "B"]);
    const c = deal("C");
    store.replaceExternalDeals([c]);
    expect(store.loadAll().externalDeals.map((d) => d.company)).toEqual(["C"]);
    expect(storage.raw().has(`hni.pricing.v1.external.${a.id}`)).toBe(false);
  });

  it("loadAll backfills the 50% GP default onto stored rows with no GP data", () => {
    const noGp = { ...deal("A"), gpPct: null, gpAmount: null };
    const amtOnly = { ...deal("B"), gpPct: null, gpAmount: 4000 };
    store.replaceExternalDeals([noGp, amtOnly]);
    const r = store.loadAll();
    expect(r.externalDeals.find((d) => d.company === "A")!.gpPct).toBe(50);
    expect(r.externalDeals.find((d) => d.company === "B")!.gpPct).toBeNull();
  });

  it("deleteExternalDeal removes one deal and keeps the rest", () => {
    const a = deal("A");
    const b = deal("B");
    store.replaceExternalDeals([a, b]);
    store.deleteExternalDeal(a.id);
    expect(store.loadAll().externalDeals.map((d) => d.company)).toEqual(["B"]);
  });

  it("exportAll emits version 2 with externalDeals; import restores them", () => {
    const a = deal("A");
    store.replaceExternalDeals([a]);
    store.saveSettings({ ...store.loadAll().settings, targets: { periodStart: "2026-01-01", periodEnd: null, revenueTarget: 5000000, gpTarget: null } });
    const json = store.exportAll();
    expect(JSON.parse(json).version).toBe(2);

    store.replaceExternalDeals([]);
    const r = store.importAll(json);
    expect(r.externalDeals.map((d) => d.company)).toEqual(["A"]);
    expect(r.settings.targets.revenueTarget).toBe(5000000);
  });

  it("v1 backups (no externalDeals, no targets) still import with defaults", () => {
    const a = proposal("A");
    store.saveProposal(a, [a.id]);
    const v1 = JSON.stringify({
      version: 1,
      settings: { marginFloorPct: 25, lastExportAt: null, signatureImage: null, stampImage: null },
      proposals: [a],
    });
    const r = store.importAll(v1);
    expect(r.proposals.map((x) => x.title)).toEqual(["A"]);
    expect(r.externalDeals).toEqual([]);
    expect(r.settings.targets).toEqual({ periodStart: null, periodEnd: null, revenueTarget: null, gpTarget: null });
  });

  it("normalizeProposal backfills a missing pipeline and drops invalid stages", () => {
    const base = newProposal("X", "On signature");
    const legacy = { ...base } as Record<string, unknown>;
    delete legacy.pipeline;
    expect(normalizeProposal(legacy as unknown as Proposal).pipeline).toEqual({});
    const badStage = { ...base, pipeline: { stage: "Negotiating", notes: "keep me" } } as unknown as Proposal;
    const normalized = normalizeProposal(badStage);
    expect(normalized.pipeline.stage).toBeUndefined();
    expect(normalized.pipeline.notes).toBe("keep me");
    const goodStage = { ...base, pipeline: { stage: "Won" } } as unknown as Proposal;
    expect(normalizeProposal(goodStage).pipeline.stage).toBe("Won");
  });
});

describe("debounce", () => {
  it("collapses rapid calls into one trailing call", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d(1);
    d(2);
    d(3);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });

  it("flush runs the pending call immediately, once", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 300);
    d("pending");
    d.flush();
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("pending");
    vi.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1); // no double fire
    d.flush(); // nothing pending: no-op
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
