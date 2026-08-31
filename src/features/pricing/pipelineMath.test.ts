import { describe, expect, it } from "vitest";
import { calc } from "./calc";
import { bookedShare, buildRows, computeTotals } from "./pipelineMath";
import { newId, DEFAULT_TARGETS, type ExternalDeal, type PipelineInfo, type Program, type Proposal } from "./types";

function makeProgram(unitRate: number): Program {
  return {
    id: newId(),
    name: "P",
    description: "",
    days: 1,
    participants: 0,
    city: "",
    costLines: [{ id: newId(), label: "Cost", qty: 1, unitRate }],
  };
}

function makeProposal(pipeline: PipelineInfo, overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: newId(),
    clientName: "Client",
    title: "Deal",
    date: "2026-08-10",
    currency: "SAR",
    projectType: "custom",
    sectionLabel: "",
    clientLogo: null,
    markupPct: 50,
    discount: { type: "percent", value: 0 },
    vatPct: 15,
    schedule: [{ id: "s1", label: "x", percent: 100 }],
    programs: [makeProgram(100000)], // net 150,000, GP 50,000
    sentAt: null,
    pipeline,
    ...overrides,
  };
}

function makeExternal(overrides: Partial<ExternalDeal> = {}): ExternalDeal {
  return {
    id: newId(),
    importedAt: "2026-08-30T00:00:00.000Z",
    date: "2026-06-01",
    source: "",
    dealType: "",
    sector: "",
    primaryService: "",
    company: "Ext Co",
    projectName: "Ext Deal",
    stage: "Won",
    winningProbability: null,
    deliveryStart: "",
    deliveryEnd: "",
    poNumber: "",
    currency: "SAR",
    dealValue: 200000,
    gpPct: 30,
    gpAmount: 60000,
    projectStatus: "",
    notes: "",
    flags: {},
    ...overrides,
  };
}

describe("buildRows", () => {
  it("includes only proposals with a stage; value and GP come from calc()", () => {
    const inP = makeProposal({ stage: "Proposal", winningProbability: 40 });
    const out = makeProposal({});
    const rows = buildRows([inP, out], []);
    expect(rows).toHaveLength(1);
    const r = calc(inP);
    expect(rows[0].value).toBe(r.netPrice);
    expect(rows[0].gpAmount).toBe(r.marginAmount);
    expect(rows[0].winningProbability).toBe(40);
  });

  it("a manual GP override on a proposal beats the derived margin; clearing reverts", () => {
    const derived = buildRows([makeProposal({ stage: "Won", decidedAt: "2026-08-01" })], [])[0];
    expect(derived.gpAmount).toBe(50000); // costing-derived margin
    const overridden = buildRows([makeProposal({ stage: "Won", decidedAt: "2026-08-01", gpPctOverride: 40 })], [])[0];
    expect(overridden.gpPct).toBe(40);
    expect(overridden.gpAmount).toBe(60000); // 150,000 x 40%
    const t = computeTotals([overridden], DEFAULT_TARGETS);
    expect(t.achievedGp).toBe(60000);
    const cleared = buildRows([makeProposal({ stage: "Won", decidedAt: "2026-08-01", gpPctOverride: null })], [])[0];
    expect(cleared.gpAmount).toBe(50000);
  });

  it("effectiveDate prefers decidedAt over the proposal date and flags defaulted Won dates", () => {
    const decided = makeProposal({ stage: "Won", decidedAt: "2026-08-20" });
    const defaulted = makeProposal({ stage: "Won" });
    const rows = buildRows([decided, defaulted], []);
    expect(rows[0].effectiveDate).toBe("2026-08-20");
    expect(rows[0].dateDefaulted).toBe(false);
    expect(rows[1].effectiveDate).toBe("2026-08-10");
    expect(rows[1].dateDefaulted).toBe(true);
  });

  it("external GP amount is Revenue x GP% when both exist; imported figure only as fallback", () => {
    const rows = buildRows([], [
      makeExternal({ dealValue: 200000, gpPct: 30, gpAmount: 58800 }), // sheet had a 0.98 factor
      makeExternal({ dealValue: 100000, gpPct: null, gpAmount: 41000 }), // no GP%: fallback
      makeExternal({ dealValue: 100000, gpPct: 33.3, gpAmount: null }), // GP% without imported amount
    ]);
    expect(rows[0].gpAmount).toBe(60000); // 200,000 x 30%, not the imported 58,800
    expect(rows[1].gpAmount).toBe(41000);
    expect(rows[2].gpAmount).toBe(33300);
    const t = computeTotals(rows, DEFAULT_TARGETS);
    expect(t.achievedGp).toBe(60000 + 41000 + 33300);
  });

  it("externals with badValue or nonSar flags carry null value and excluded=true", () => {
    const rows = buildRows([], [
      makeExternal(),
      makeExternal({ flags: { badValue: true } }),
      makeExternal({ flags: { nonSar: true }, currency: "AED" }),
      makeExternal({ flags: { badDate: true }, date: "soon" }),
    ]);
    expect(rows[0].excluded).toBe(false);
    expect(rows[1].value).toBeNull();
    expect(rows[1].excluded).toBe(true);
    expect(rows[2].excluded).toBe(true);
    expect(rows[3].effectiveDate).toBeNull();
  });
});

describe("bookedShare", () => {
  it("is 0 (not NaN) on an empty pipeline", () => {
    expect(bookedShare([])).toEqual({ wonValue: 0, openValue: 0, wonCount: 0, openCount: 0, pct: 0 });
  });

  it("Won-only pipeline is 100% booked; open-only is 0%", () => {
    const wonOnly = bookedShare(buildRows([], [makeExternal()]));
    expect(wonOnly.pct).toBe(100);
    const openOnly = bookedShare(buildRows([], [makeExternal({ stage: "Proposal" })]));
    expect(openOnly.pct).toBe(0);
    expect(openOnly.openValue).toBe(200000);
  });

  it("mixes proposals and externals, ignores Lost and excluded rows, rounds to integer", () => {
    const rows = buildRows(
      [
        makeProposal({ stage: "Won", decidedAt: "2026-08-01" }), // 150,000 won
        makeProposal({ stage: "Lost" }), // ignored
      ],
      [
        makeExternal({ stage: "Initial Negotiation", dealValue: 100000 }), // open
        makeExternal({ stage: "Won", flags: { badValue: true } }), // excluded
      ],
    );
    const share = bookedShare(rows);
    expect(share.wonValue).toBe(150000);
    expect(share.openValue).toBe(100000);
    expect(share.wonCount).toBe(1);
    expect(share.openCount).toBe(1);
    expect(share.pct).toBe(60); // 150k / 250k
  });

  it("ignores the period entirely: a Won deal outside any period still counts", () => {
    const rows = buildRows([makeProposal({ stage: "Won", decidedAt: "2020-01-01" })], []);
    expect(bookedShare(rows).pct).toBe(100);
  });
});

describe("computeTotals", () => {
  it("splits achieved (Won) from open stages and excludes Lost entirely", () => {
    const rows = buildRows(
      [
        makeProposal({ stage: "Won", decidedAt: "2026-08-01" }),
        makeProposal({ stage: "Proposal", winningProbability: 50 }),
        makeProposal({ stage: "Final Negotiation", winningProbability: 80 }),
        makeProposal({ stage: "Lost", decidedAt: "2026-08-05" }),
      ],
      [],
    );
    const t = computeTotals(rows, DEFAULT_TARGETS);
    expect(t.achievedCount).toBe(1);
    expect(t.achievedRevenue).toBe(150000);
    expect(t.achievedGp).toBe(50000);
    expect(t.openCount).toBe(2);
    expect(t.openRevenue).toBe(300000);
    expect(t.weighted).toBe(Math.round(150000 * 0.5) + Math.round(150000 * 0.8));
    expect(t.unweightedCount).toBe(0);
    expect(t.excludedCount).toBe(0);
  });

  it("open deals without a probability count as unweighted, never as silent zero", () => {
    const rows = buildRows([makeProposal({ stage: "Proposal" })], []);
    const t = computeTotals(rows, DEFAULT_TARGETS);
    expect(t.weighted).toBe(0);
    expect(t.unweightedCount).toBe(1);
  });

  it("period boundaries are inclusive on both ends and only gate Won deals", () => {
    const targets = { ...DEFAULT_TARGETS, periodStart: "2026-08-01", periodEnd: "2026-08-31" };
    const rows = buildRows(
      [
        makeProposal({ stage: "Won", decidedAt: "2026-08-01" }), // on start boundary: in
        makeProposal({ stage: "Won", decidedAt: "2026-08-31" }), // on end boundary: in
        makeProposal({ stage: "Won", decidedAt: "2026-07-31" }), // before: out
        makeProposal({ stage: "Proposal", winningProbability: 10 }, { date: "2025-01-01" }), // open ignores period
      ],
      [],
    );
    const t = computeTotals(rows, targets);
    expect(t.achievedCount).toBe(2);
    expect(t.openCount).toBe(1);
  });

  it("a Won row with no usable date is excluded (counted) when a period is set", () => {
    const rows = buildRows([], [makeExternal({ flags: { badDate: true } })]);
    const t = computeTotals(rows, { ...DEFAULT_TARGETS, periodStart: "2026-01-01", periodEnd: "2026-12-31" });
    expect(t.achievedCount).toBe(0);
    expect(t.excludedCount).toBe(1);
  });

  it("excluded rows (bad value / non-SAR) are counted, Lost exclusions are not", () => {
    const rows = buildRows([], [
      makeExternal({ flags: { badValue: true } }),
      makeExternal({ flags: { nonSar: true }, stage: "Proposal" }),
      makeExternal({ flags: { badValue: true }, stage: "Lost" }),
    ]);
    const t = computeTotals(rows, DEFAULT_TARGETS);
    expect(t.excludedCount).toBe(2);
  });

  it("target percentages compute from achieved sums; null without targets", () => {
    const rows = buildRows([makeProposal({ stage: "Won", decidedAt: "2026-08-01" })], []);
    const withTargets = computeTotals(rows, { ...DEFAULT_TARGETS, revenueTarget: 1000000, gpTarget: 200000 });
    expect(withTargets.revenueTargetPct).toBeCloseTo(15, 5);
    expect(withTargets.gpTargetPct).toBeCloseTo(25, 5);
    const noTargets = computeTotals(rows, DEFAULT_TARGETS);
    expect(noTargets.revenueTargetPct).toBeNull();
    expect(noTargets.gpTargetPct).toBeNull();
  });

  it("mixed proposal and external rows sum together in SAR", () => {
    const rows = buildRows([makeProposal({ stage: "Won", decidedAt: "2026-08-01" })], [makeExternal()]);
    const t = computeTotals(rows, DEFAULT_TARGETS);
    expect(t.achievedRevenue).toBe(150000 + 200000);
    expect(t.achievedGp).toBe(50000 + 60000);
  });
});
