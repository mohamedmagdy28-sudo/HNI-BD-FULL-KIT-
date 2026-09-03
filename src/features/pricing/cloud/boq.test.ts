import { describe, expect, it } from "vitest";
import {
  boqTotals,
  canEditLines,
  lineAdderName,
  importBoqLines,
  isDeliveryRole,
  penHolder,
  seedContext,
  seedLines,
  type BoqRecord,
} from "./boq";
import { newId, type Proposal } from "../types";

function proposal(): Proposal {
  return {
    id: "p1",
    clientName: "Maaden",
    title: "Supervisors Track",
    date: "2026-09-03",
    currency: "SAR",
    projectType: "custom",
    sectionLabel: "phase",
    clientLogo: null,
    markupPct: 35,
    discount: { type: "percent", value: 10 },
    vatPct: 15,
    schedule: [{ id: "s1", label: "On signature", percent: 100 }],
    programs: [
      {
        id: "prog1",
        name: "Phase 1",
        description: "",
        days: 3,
        participants: 20,
        city: "Riyadh",
        markupPct: 60,
        costLines: [
          { id: "l1", label: "Trainer", qty: 3, unitRate: 9000 },
          { id: "l2", label: "", qty: 1, unitRate: 0 },
        ],
      },
      { id: "prog2", name: "Phase 2", description: "", days: 2, participants: 0, city: "", costLines: [] },
    ],
    customTerms: null,
    sentAt: null,
    pipeline: { stage: "Proposal", gpPctOverride: 42 },
  };
}

function boq(overrides: Partial<BoqRecord> = {}): BoqRecord {
  return {
    proposalId: "p1",
    owner: "bd",
    ptAssignee: "pt",
    pmAssignee: "pm",
    status: "draft",
    context: { title: "Supervisors Track", programs: [] },
    lines: [],
    rev: 0,
    ...overrides,
  };
}

describe("seedContext (pricing stripped by construction)", () => {
  it("copies only the five identity fields per program", () => {
    const ctx = seedContext(proposal(), true);
    expect(ctx.clientName).toBe("Maaden");
    expect(ctx.programs).toEqual([
      { id: "prog1", name: "Phase 1", days: 3, participants: 20, city: "Riyadh" },
      { id: "prog2", name: "Phase 2", days: 2, participants: 0, city: "" },
    ]);
    // The proof of D1: no pricing key survives serialization.
    const json = JSON.stringify(ctx);
    for (const leak of ["markup", "margin", "discount", "gpPct", "vat", "schedule", "netPrice"]) {
      expect(json.toLowerCase()).not.toContain(leak.toLowerCase());
    }
  });

  it("client name only when the owner opted in", () => {
    expect(seedContext(proposal(), false).clientName).toBeUndefined();
  });
});

describe("seedLines", () => {
  it("copies real cost lines as pt-origin, skips blank seeds", () => {
    const lines = seedLines(proposal());
    expect(lines).toEqual([{ id: "l1", programId: "prog1", label: "Trainer", qty: 3, unitRate: 9000, origin: "pt" }]);
  });
});

describe("importBoqLines (replace per matched program)", () => {
  const record = boq({
    status: "ready",
    lines: [
      { id: "b1", programId: "prog1", label: "Trainer senior", qty: 3, unitRate: 9500, origin: "pt" },
      { id: "b2", programId: "prog1", label: "Logistics", qty: 1, unitRate: 4000, origin: "pm" },
      { id: "b3", programId: "ghost", label: "Site visit", qty: 2, unitRate: 800, origin: "pm" },
    ],
  });

  it("replaces matched program lines wholesale, drops origin tags, keeps pricing untouched", () => {
    const before = proposal();
    const after = importBoqLines(before, record, "Additional items (BOQ)");
    expect(after.programs[0].costLines).toEqual([
      { id: "b1", label: "Trainer senior", qty: 3, unitRate: 9500 },
      { id: "b2", label: "Logistics", qty: 1, unitRate: 4000 },
    ]);
    // Untouched program keeps its lines; pricing fields fully preserved.
    expect(after.programs[1].costLines).toEqual([]);
    expect(after.programs[0].markupPct).toBe(60);
    expect(after.markupPct).toBe(35);
    expect(after.discount).toEqual({ type: "percent", value: 10 });
    expect(after.pipeline.gpPctOverride).toBe(42);
  });

  it("unmatched lines land in ONE new section at the end", () => {
    const after = importBoqLines(proposal(), record, "Additional items (BOQ)");
    const extra = after.programs[2];
    expect(extra.name).toBe("Additional items (BOQ)");
    expect(extra.costLines).toEqual([{ id: "b3", label: "Site visit", qty: 2, unitRate: 800 }]);
    expect(extra.days).toBe(0);
  });

  it("no unmatched lines: no extra section", () => {
    const only = boq({ lines: [{ id: "b1", programId: "prog1", label: "X", qty: 1, unitRate: 1, origin: "pt" }] });
    expect(importBoqLines(proposal(), only, "extra").programs).toHaveLength(2);
  });
});

describe("boqTotals / penHolder / roles", () => {
  it("cost totals per program and overall", () => {
    const { byProgram, total } = boqTotals([
      { id: newId(), programId: "a", label: "x", qty: 2, unitRate: 100, origin: "pt" },
      { id: newId(), programId: "a", label: "y", qty: 1, unitRate: 50, origin: "pm" },
      { id: newId(), programId: "b", label: "z", qty: 3, unitRate: 10, origin: "pt" },
    ]);
    expect(byProgram.get("a")).toBe(250);
    expect(byProgram.get("b")).toBe(30);
    expect(total).toBe(280);
  });

  it("pen follows the stage", () => {
    expect(penHolder(boq({ status: "draft" }))).toBe("pt");
    expect(penHolder(boq({ status: "pm_review" }))).toBe("pm");
    expect(penHolder(boq({ status: "ready" }))).toBe("bd");
    expect(penHolder(boq({ status: "imported" }))).toBe("bd");
  });

  it("delivery role detection", () => {
    expect(isDeliveryRole("proposals_team")).toBe(true);
    expect(isDeliveryRole("project_manager")).toBe(true);
    expect(isDeliveryRole("member")).toBe(false);
    expect(isDeliveryRole("manager")).toBe(false);
    expect(isDeliveryRole(null)).toBe(false);
  });
});

describe("canEditLines (amended: both assignees pre-ready, owner always)", () => {
  it("both assignees edit during draft and pm_review", () => {
    for (const status of ["draft", "pm_review"] as const) {
      expect(canEditLines(boq({ status }), "pt")).toBe(true);
      expect(canEditLines(boq({ status }), "pm")).toBe(true);
    }
  });

  it("assignees lose the pen at ready/imported; owner keeps it always", () => {
    for (const status of ["ready", "imported"] as const) {
      expect(canEditLines(boq({ status }), "pt")).toBe(false);
      expect(canEditLines(boq({ status }), "pm")).toBe(false);
      expect(canEditLines(boq({ status }), "bd")).toBe(true);
    }
  });

  it("strangers never edit", () => {
    expect(canEditLines(boq({ status: "draft" }), "someone-else")).toBe(false);
  });
});

describe("lineAdderName", () => {
  it("maps origin to the assignee's display name", () => {
    const names = (id: string | null) => (id === "pt" ? "Lina" : id === "pm" ? "Omar" : "—");
    expect(lineAdderName("pt", boq(), names)).toBe("Lina");
    expect(lineAdderName("pm", boq(), names)).toBe("Omar");
  });
});
