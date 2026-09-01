import { describe, expect, it } from "vitest";
import {
  allocate,
  calc,
  isScheduleValid,
  lineSubtotal,
  marginPctFromMarkup,
  markupFromMarginPct,
  markupFromPricePerDay,
  programCost,
  totalDays,
} from "./calc";
import { newId, type Proposal, type Program } from "./types";

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: newId(),
    name: "Executive Leadership",
    description: "",
    days: 3,
    participants: 24,
    city: "Riyadh",
    costLines: [
      { id: newId(), label: "Senior trainer days", qty: 3, unitRate: 9000 },
      { id: newId(), label: "Venue days", qty: 3, unitRate: 4000 },
      { id: newId(), label: "Materials", qty: 24, unitRate: 150 },
    ],
    ...overrides,
  };
}

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: newId(),
    clientName: "Client",
    title: "Proposal",
    date: "2026-08-29",
    currency: "SAR",
    projectType: "custom",
    sectionLabel: "",
    clientLogo: null,
    markupPct: 35,
    discount: { type: "percent", value: 0 },
    vatPct: 15,
    schedule: [{ id: "s1", label: "On signature", percent: 100 }],
    programs: [makeProgram()],
    sentAt: null,
    pipeline: {},
    ...overrides,
  };
}

describe("lineSubtotal", () => {
  it("multiplies and rounds to whole SAR", () => {
    expect(lineSubtotal(3, 9000)).toBe(27000);
    expect(lineSubtotal(2.5, 1201)).toBe(3003); // 3002.5 rounds up
  });
  it("clamps negatives and non-finite values to 0", () => {
    expect(lineSubtotal(-1, 500)).toBe(0);
    expect(lineSubtotal(2, -500)).toBe(0);
    expect(lineSubtotal(NaN, 100)).toBe(0);
    expect(lineSubtotal(1, Infinity)).toBe(0);
  });
});

describe("programCost", () => {
  it("sums rounded line subtotals", () => {
    expect(programCost(makeProgram())).toBe(27000 + 12000 + 3600);
  });
});

describe("markup and margin conversions", () => {
  it("round-trips: markup -> margin -> markup", () => {
    for (const markup of [0, 10, 35, 100, 250]) {
      const margin = marginPctFromMarkup(markup);
      expect(markupFromMarginPct(margin)).toBeCloseTo(markup, 6);
    }
  });
  it("35% markup implies about 25.9% margin", () => {
    expect(marginPctFromMarkup(35)).toBeCloseTo(25.9259, 3);
  });
  it("clamps target margin below 100 so markup never explodes", () => {
    expect(markupFromMarginPct(100)).toBeCloseTo(markupFromMarginPct(99));
    expect(markupFromMarginPct(150)).toBeCloseTo(markupFromMarginPct(99));
    expect(Number.isFinite(markupFromMarginPct(99.999))).toBe(true);
  });
  it("handles pathological inputs without NaN", () => {
    expect(marginPctFromMarkup(NaN)).toBe(0);
    expect(marginPctFromMarkup(-100)).toBe(0);
    expect(markupFromMarginPct(NaN)).toBe(0);
  });
});

describe("price per day", () => {
  it("totalDays sums program days, ignoring negatives and non-finite values", () => {
    expect(totalDays([makeProgram({ days: 3 }), makeProgram({ days: 2 })])).toBe(5);
    expect(totalDays([makeProgram({ days: -1 }), makeProgram({ days: NaN })])).toBe(0);
    expect(totalDays([])).toBe(0);
  });

  it("markupFromPricePerDay makes list price equal days x rate", () => {
    // cost 42600, 3 days, want 20000/day -> list 60000
    const markup = markupFromPricePerDay(20000, 42600, 3);
    expect(Math.round(42600 * (1 + markup / 100))).toBe(60000);
  });

  it("round-trips with the derived pricePerDay from calc", () => {
    const proposal = makeProposal();
    const r = calc(proposal);
    expect(r.totalDays).toBe(3);
    expect(r.pricePerDay).toBe(Math.round(r.listPrice / 3));
    const markup = markupFromPricePerDay(r.pricePerDay!, r.totalCost, r.totalDays);
    expect(Math.round(r.totalCost * (1 + markup / 100))).toBeCloseTo(r.listPrice, -1);
  });

  it("clamps a below-cost day rate to markup 0 and handles bad inputs", () => {
    expect(markupFromPricePerDay(1, 42600, 3)).toBe(0);
    expect(markupFromPricePerDay(-5000, 42600, 3)).toBe(0);
    expect(markupFromPricePerDay(NaN, 42600, 3)).toBe(0);
    expect(markupFromPricePerDay(20000, 0, 3)).toBe(0);
    expect(markupFromPricePerDay(20000, 42600, 0)).toBe(0);
  });

  it("pricePerDay is null with zero days or zero cost", () => {
    const noDays = calc(makeProposal({ programs: [makeProgram({ days: 0 })] }));
    expect(noDays.pricePerDay).toBeNull();
    const noCost = calc(makeProposal({ programs: [] }));
    expect(noCost.pricePerDay).toBeNull();
  });
});

describe("allocate", () => {
  it("splits proportionally and sums exactly to the total", () => {
    const shares = allocate(100, [1, 1, 1]);
    expect(shares.reduce((s, v) => s + v, 0)).toBe(100);
    expect(shares).toEqual([33, 33, 34]); // last absorbs
  });
  it("returns zeros when all weights are zero", () => {
    expect(allocate(100, [0, 0])).toEqual([0, 0]);
  });
  it("gives everything to a single positive weight", () => {
    expect(allocate(500, [0, 7, 0])).toEqual([0, 500, 0]);
  });
});

describe("isScheduleValid", () => {
  it("accepts integer percents summing to exactly 100", () => {
    expect(
      isScheduleValid([
        { id: "a", label: "x", percent: 40 },
        { id: "b", label: "y", percent: 40 },
        { id: "c", label: "z", percent: 20 },
      ]),
    ).toBe(true);
  });
  it("rejects sums other than 100, non-integers, negatives, and empty lists", () => {
    expect(isScheduleValid([{ id: "a", label: "x", percent: 99 }])).toBe(false);
    expect(isScheduleValid([{ id: "a", label: "x", percent: 99.5 }, { id: "b", label: "y", percent: 0.5 }])).toBe(false);
    expect(isScheduleValid([{ id: "a", label: "x", percent: -10 }, { id: "b", label: "y", percent: 110 }])).toBe(false);
    expect(isScheduleValid([])).toBe(false);
  });
});

describe("calc: the full chain, rounded-canonical", () => {
  it("computes the happy path and every displayed row recomputes from displayed values", () => {
    const r = calc(makeProposal());
    expect(r.totalCost).toBe(42600);
    expect(r.listPrice).toBe(Math.round(42600 * 1.35)); // 57510
    expect(r.discountAmount).toBe(0);
    expect(r.netPrice).toBe(57510);
    expect(r.marginAmount).toBe(57510 - 42600);
    expect(r.vatAmount).toBe(Math.round(57510 * 0.15)); // 8627 (8626.5 rounds up)
    expect(r.totalIncVat).toBe(r.netPrice + r.vatAmount);
    // The client's arithmetic checks out from displayed figures alone:
    expect(Math.round(r.netPrice * 0.15)).toBe(r.vatAmount);
  });

  it("percent discount rounds against the displayed list price", () => {
    const r = calc(makeProposal({ discount: { type: "percent", value: 5 } }));
    expect(r.discountAmount).toBe(Math.round(r.listPrice * 0.05));
    expect(r.netPrice).toBe(r.listPrice - r.discountAmount);
    expect(r.discountClamped).toBe(false);
  });

  it("amount discount stays fixed when costs change; percent scales", () => {
    const base = makeProposal({ discount: { type: "amount", value: 5000 } });
    const before = calc(base);
    const grown = {
      ...base,
      programs: [...base.programs, makeProgram({ name: "Second" })],
    };
    const after = calc(grown);
    expect(before.discountAmount).toBe(5000);
    expect(after.discountAmount).toBe(5000); // amount anchored

    const pctBase = makeProposal({ discount: { type: "percent", value: 10 } });
    const pctGrown = { ...pctBase, programs: [...pctBase.programs, makeProgram({ name: "Second" })] };
    expect(calc(pctGrown).discountAmount).toBeGreaterThan(calc(pctBase).discountAmount); // percent scales
  });

  it("clamps an amount discount that exceeds list price and flags it", () => {
    const r = calc(makeProposal({ discount: { type: "amount", value: 999999 } }));
    expect(r.discountAmount).toBe(r.listPrice);
    expect(r.netPrice).toBe(0);
    expect(r.discountClamped).toBe(true);
  });

  it("allows negative margin (deep discount) and reports it", () => {
    const r = calc(makeProposal({ markupPct: 0, discount: { type: "percent", value: 20 } }));
    expect(r.marginAmount).toBeLessThan(0);
    expect(r.marginPct).toBeLessThan(0);
  });

  it("zero cost disables pricing and produces all-zero money with no NaN", () => {
    const r = calc(makeProposal({ programs: [] }));
    expect(r.pricingDisabled).toBe(true);
    expect(r.totalCost).toBe(0);
    expect(r.listPrice).toBe(0);
    expect(r.netPrice).toBe(0);
    expect(r.marginPct).toBe(0);
    expect(Number.isNaN(r.marginPct)).toBe(false);
    expect(r.totalIncVat).toBe(0);
  });

  it("per-day unit price is net share over days, null when days or cost is 0", () => {
    const proposal = makeProposal({
      programs: [makeProgram(), makeProgram({ name: "NoDays", days: 0 })],
    });
    const r = calc(proposal);
    expect(r.programs[0].perDay).toBe(Math.round(r.programs[0].netShare / 3));
    expect(r.programs[1].perDay).toBeNull();
    const empty = calc(makeProposal({ programs: [] }));
    expect(empty.programs).toEqual([]);
  });

  it("per-participant is per program and null when participants or cost is 0", () => {
    const proposal = makeProposal({
      programs: [makeProgram(), makeProgram({ name: "Empty", participants: 0 })],
    });
    const r = calc(proposal);
    expect(r.programs[0].perParticipant).toBe(Math.round(r.programs[0].netShare / 24));
    expect(r.programs[1].perParticipant).toBeNull();
  });

  it("program net shares always sum to the net price", () => {
    const proposal = makeProposal({
      programs: [makeProgram(), makeProgram({ name: "B" }), makeProgram({ name: "C" })],
      discount: { type: "percent", value: 7 },
    });
    const r = calc(proposal);
    expect(r.programs.reduce((s, x) => s + x.netShare, 0)).toBe(r.netPrice);
  });

  it("installments round to whole SAR and the last absorbs so they sum exactly", () => {
    const proposal = makeProposal({
      schedule: [
        { id: "a", label: "Signature", percent: 40 },
        { id: "b", label: "Delivery", percent: 40 },
        { id: "c", label: "Completion", percent: 20 },
      ],
    });
    const r = calc(proposal);
    expect(r.scheduleValid).toBe(true);
    expect(r.installments.reduce((s, x) => s + x.amount, 0)).toBe(r.totalIncVat);
  });

  it("invalid schedule yields no installments and a false flag", () => {
    const r = calc(makeProposal({ schedule: [{ id: "a", label: "x", percent: 50 }] }));
    expect(r.scheduleValid).toBe(false);
    expect(r.installments).toEqual([]);
  });

  it("clamps VAT into range and negative markup to zero", () => {
    const r = calc(makeProposal({ vatPct: -5, markupPct: -20 }));
    expect(r.vatAmount).toBe(0);
    expect(r.listPrice).toBe(r.totalCost); // markup clamped to 0
  });
});

describe("per-phase pricing (design: per-phase-pricing.md)", () => {
  const phased = (aMarkup: number | null | undefined, bMarkup: number | null | undefined) =>
    makeProposal({
      markupPct: 35,
      programs: [
        makeProgram({ days: 2, costLines: [{ id: newId(), label: "A", qty: 1, unitRate: 10000 }], markupPct: aMarkup ?? undefined }),
        makeProgram({ days: 3, costLines: [{ id: newId(), label: "B", qty: 1, unitRate: 33333 }], markupPct: bMarkup ?? undefined }),
      ],
    });

  it("zero overrides: bit-identical to today's single-multiplication chain, unequal costs", () => {
    const r = calc(phased(undefined, undefined));
    expect(r.hasOverrides).toBe(false);
    expect(r.listPrice).toBe(Math.round(43333 * 1.35)); // one multiplication on pooled cost
    // netShares come from cost-weight allocate, exactly today's path
    expect(r.programs.reduce((s, x) => s + x.netShare, 0)).toBe(r.netPrice);
    // listShares in gated mode come from allocate and sum exactly
    expect(r.programs.reduce((s, x) => s + x.listShare, 0)).toBe(r.listPrice);
    expect(r.defaultPricePerDay).toBe(r.pricePerDay);
  });

  it("one override flips totaling to sum-of-phase-prices and changes only that phase's rate", () => {
    const r = calc(phased(60, undefined));
    expect(r.hasOverrides).toBe(true);
    const a = Math.round(10000 * 1.6); // own markup
    const b = Math.round(33333 * 1.35); // inherits the default
    expect(r.programs[0].listShare).toBe(a);
    expect(r.programs[1].listShare).toBe(b);
    expect(r.listPrice).toBe(a + b); // sum of displayed phase prices
    expect(r.programs[0].effMarkupPct).toBe(60);
    expect(r.programs[1].effMarkupPct).toBe(35);
    expect(r.programs[0].overridden).toBe(true);
    expect(r.programs[1].overridden).toBe(false);
  });

  it("summed totaling is actually exercised: sum of rounds differs from round of sum", () => {
    // Both phases at the same 33.335% via overrides: rounding per phase diverges.
    const p = makeProposal({
      markupPct: 35,
      programs: [
        makeProgram({ costLines: [{ id: newId(), label: "A", qty: 1, unitRate: 101 }], markupPct: 33.335 }),
        makeProgram({ costLines: [{ id: newId(), label: "B", qty: 1, unitRate: 101 }], markupPct: 33.335 }),
      ],
    });
    const r = calc(p);
    const perPhase = Math.round(101 * 1.33335);
    expect(r.listPrice).toBe(perPhase * 2);
    expect(r.listPrice).not.toBe(Math.round(202 * 1.33335)); // the gate matters
  });

  it("discount spreads across list shares; phase margins are net-based and zero-guarded", () => {
    const r = calc({ ...phased(60, undefined), discount: { type: "percent", value: 10 } });
    expect(r.programs.reduce((s, x) => s + x.netShare, 0)).toBe(r.netPrice);
    for (const x of r.programs) {
      const expected = x.netShare > 0 ? ((x.netShare - x.cost) / x.netShare) * 100 : 0;
      expect(x.phaseMarginPct).toBeCloseTo(expected, 6);
    }
    const zeroed = calc({ ...phased(60, undefined), discount: { type: "amount", value: 99999999 } });
    expect(zeroed.programs.every((x) => x.phaseMarginPct === 0)).toBe(true); // netPrice 0, no NaN
  });

  it("listPerDay is the phase's list-based day rate; null without days", () => {
    const r = calc(phased(60, undefined));
    expect(r.programs[0].listPerDay).toBe(Math.round(r.programs[0].listShare / 2));
    const noDays = calc(makeProposal({ programs: [makeProgram({ days: 0, markupPct: 50 })] }));
    expect(noDays.programs[0].listPerDay).toBeNull();
  });

  it("defaultPricePerDay covers inheriting phases only; null when all override", () => {
    const r = calc(phased(60, undefined));
    expect(r.defaultPricePerDay).toBe(Math.round(r.programs[1].listShare / 3));
    const all = calc(phased(60, 40));
    expect(all.defaultPricePerDay).toBeNull();
    expect(all.hasOverrides).toBe(true);
  });

  it("consolidated marginPct keeps the untouched net formula", () => {
    const r = calc({ ...phased(60, undefined), discount: { type: "percent", value: 5 } });
    expect(r.marginPct).toBeCloseTo(((r.netPrice - r.totalCost) / r.netPrice) * 100, 6);
  });
});

describe("phase price/day manual entry (full-precision override)", () => {
  it("a typed day rate reproduces exactly when the implied markup is stored unrounded", () => {
    // BD types 40,000/day on a 3-day phase costing 27,000: the strip stores
    // markupFromPricePerDay at full precision, so listShare = 120,000 exactly.
    const markup = markupFromPricePerDay(40000, 27000, 3);
    const p = makeProposal({
      markupPct: 35,
      programs: [
        makeProgram({ days: 3, costLines: [{ id: newId(), label: "A", qty: 3, unitRate: 9000 }], markupPct: markup }),
        makeProgram({ days: 1, costLines: [{ id: newId(), label: "B", qty: 1, unitRate: 10000 }] }),
      ],
    });
    const r = calc(p);
    expect(r.programs[0].listShare).toBe(120000);
    expect(r.programs[0].listPerDay).toBe(40000);
    // Margin follows automatically from the typed rate: (120,000 - 27,000) / 120,000.
    expect(r.programs[0].phaseMarginPct).toBeCloseTo(77.5, 6);
    expect(r.listPrice).toBe(120000 + Math.round(10000 * 1.35));
  });
});
