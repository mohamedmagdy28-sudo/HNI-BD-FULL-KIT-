import { describe, expect, it } from "vitest";
import { calc } from "../calc";
import {
  externalToJourneyPatch,
  identityColumns,
  journeyColumns,
  rowToPipelineInfo,
  rowToTeamExternal,
  stripJourney,
  TEAM_ROW_PREFIX,
} from "./supabaseStore";
import { newId, type Proposal } from "../types";

function proposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "p1",
    clientName: "Maaden",
    title: "Leadership Track",
    date: "2026-09-02",
    currency: "SAR",
    projectType: "custom",
    sectionLabel: "",
    clientLogo: null,
    markupPct: 35,
    discount: { type: "percent", value: 0 },
    vatPct: 15,
    schedule: [{ id: "s1", label: "On signature", percent: 100 }],
    programs: [
      {
        id: newId(),
        name: "Phase 1",
        description: "",
        days: 1,
        participants: 0,
        city: "",
        costLines: [{ id: newId(), label: "Trainer", qty: 3, unitRate: 9000 }],
      },
    ],
    customTerms: null,
    sentAt: null,
    pipeline: {
      stage: "Proposal",
      winningProbability: 60,
      source: "Referral",
      notes: "hot deal",
      gpPctOverride: 42,
      copiedAt: "2026-09-01T00:00:00Z",
    },
    ...overrides,
  };
}

describe("stripJourney (proposals.data keeps quote content only)", () => {
  it("drops journey fields and copiedAt, keeps gpPctOverride", () => {
    const stripped = stripJourney(proposal());
    expect(stripped.pipeline).toEqual({ gpPctOverride: 42 });
    expect(stripped.programs).toHaveLength(1); // quote content intact
  });

  it("no override yields an empty pipeline object", () => {
    const stripped = stripJourney(proposal({ pipeline: { stage: "Won" } }));
    expect(stripped.pipeline).toEqual({});
  });
});

describe("identityColumns (owner-only money columns)", () => {
  it("uses the gpPctOverride for GP when set (user rule: reported GP is BD's call)", () => {
    const p = proposal();
    const cols = identityColumns(p);
    const result = calc(p);
    expect(cols.value).toBe(result.netPrice);
    expect(cols.gp_amount).toBe(Math.round((result.netPrice * 42) / 100));
    expect(cols.gp_pct).toBe(42);
    expect(cols.client).toBe("Maaden");
  });

  it("falls back to the derived margin without an override", () => {
    const p = proposal({ pipeline: { stage: "Proposal" } });
    const result = calc(p);
    const cols = identityColumns(p);
    expect(cols.gp_amount).toBe(result.marginAmount);
    expect(cols.gp_pct).toBe(result.marginPct);
  });
});

describe("journey round-trip (row columns → PipelineInfo)", () => {
  it("journeyColumns → rowToPipelineInfo reproduces the journey fields", () => {
    const info = proposal().pipeline;
    const cols = journeyColumns(info);
    const back = rowToPipelineInfo({
      proposal_id: "p1",
      owner: "u1",
      client: "",
      title: "",
      value: null,
      gp_amount: null,
      gp_pct: null,
      ...cols,
    });
    expect(back.stage).toBe("Proposal");
    expect(back.winningProbability).toBe(60);
    expect(back.source).toBe("Referral");
    expect(back.notes).toBe("hot deal");
    // Owner-private fields never travel on the row.
    expect("gpPctOverride" in back).toBe(false);
  });

  it("an unknown stage string hydrates as no-stage (not in pipeline)", () => {
    const back = rowToPipelineInfo({
      proposal_id: "p1", owner: "u1", client: "", title: "", value: null, gp_amount: null, gp_pct: null,
      stage: "Garbage", probability: null, decided_at: null, source: null, deal_type: null, sector: null,
      primary_service: null, delivery_start: null, delivery_end: null, po_number: null, project_status: null, notes: null,
    });
    expect(back.stage).toBeUndefined();
  });
});

describe("rowToTeamExternal (teammates' deals as pseudo-externals)", () => {
  const row = {
    proposal_id: "abc", owner: "heba", client: "STC", title: "Onboarding", value: 100000, gp_amount: 45000,
    gp_pct: 45, stage: "Won", probability: 100, decided_at: "2026-09-01", source: "RFP", deal_type: null,
    sector: null, primary_service: null, delivery_start: null, delivery_end: null, po_number: null,
    project_status: null, notes: null,
  };

  it("maps money and identity so shared totals count the deal exactly once", () => {
    const ext = rowToTeamExternal(row, "Heba");
    expect(ext.id).toBe(`${TEAM_ROW_PREFIX}abc`);
    expect(ext.company).toBe("STC");
    expect(ext.dealValue).toBe(100000);
    expect(ext.gpAmount).toBe(45000);
    expect(ext.stage).toBe("Won");
    expect(ext.ownerName).toBe("Heba");
    expect(ext.flags).toEqual({}); // counted in sums, never excluded
  });

  it("journey edits on the pseudo-external convert back to a journey patch", () => {
    const ext = rowToTeamExternal(row, "Heba");
    const patch = externalToJourneyPatch({ ...ext, stage: "Lost", notes: "price" });
    expect(patch.stage).toBe("Lost");
    expect(patch.notes).toBe("price");
    expect("gpPctOverride" in patch).toBe(false); // money/identity never in the patch
  });
});
