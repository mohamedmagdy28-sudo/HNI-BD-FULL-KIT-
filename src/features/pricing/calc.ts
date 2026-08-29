// Pure calculation chain. No React, no storage, fully unit-tested (calc.test.ts).
//
//   total cost -> list price (markup %) -> discount -> net price
//     -> margin (on net, excl. VAT) -> VAT -> total incl. VAT
//     -> per-program allocation -> payment installments
//
// Every derived stage rounds to whole SAR and downstream math uses the rounded
// value (rounded-canonical), so any row a client recomputes from displayed
// figures matches exactly. Installments and per-program allocations make the
// last share absorb rounding so parts always sum to their whole.

import type { Program, Proposal } from "./types";

export type ProgramTotals = {
  programId: string;
  cost: number;
  /** Program's share of the net price (excl. VAT), allocated by cost share. */
  netShare: number;
  /** Net share divided by participants; null when participants is 0. */
  perParticipant: number | null;
};

export type ScheduleTotals = {
  itemId: string;
  amount: number;
};

export type CalcResult = {
  totalCost: number;
  listPrice: number;
  discountAmount: number;
  /** True when a fixed-amount discount exceeded the list price and was clamped. */
  discountClamped: boolean;
  netPrice: number;
  marginAmount: number;
  /** Percent of net price, one source of truth for the panel. 0 when net is 0. */
  marginPct: number;
  vatAmount: number;
  totalIncVat: number;
  /** Sum of program days across the proposal. */
  totalDays: number;
  /** Derived list price per training day; null when there are no days or no cost. */
  pricePerDay: number | null;
  programs: ProgramTotals[];
  installments: ScheduleTotals[];
  /** Integer percents, each >= 0, summing to exactly 100, at least one item. */
  scheduleValid: boolean;
  /** No cost lines with a value yet: markup/margin/discount inputs are disabled. */
  pricingDisabled: boolean;
};

const round = Math.round;

export function lineSubtotal(qty: number, unitRate: number): number {
  if (!Number.isFinite(qty) || !Number.isFinite(unitRate)) return 0;
  return round(Math.max(0, qty) * Math.max(0, unitRate));
}

export function programCost(program: Program): number {
  return program.costLines.reduce((sum, l) => sum + lineSubtotal(l.qty, l.unitRate), 0);
}

/** markup % -> the margin % it implies (margin = markup / (100 + markup)). */
export function marginPctFromMarkup(markupPct: number): number {
  if (!Number.isFinite(markupPct) || markupPct <= -100) return 0;
  return (100 * markupPct) / (100 + markupPct);
}

/** margin % -> the markup % that produces it. Margin is clamped below 100. */
export function markupFromMarginPct(marginPct: number): number {
  if (!Number.isFinite(marginPct)) return 0;
  const m = Math.min(Math.max(marginPct, -1000), 99);
  return (100 * m) / (100 - m);
}

/** Sum of program days (the denominator for the manual price-per-day input). */
export function totalDays(programs: Program[]): number {
  return programs.reduce((s, p) => s + (Number.isFinite(p.days) ? Math.max(0, p.days) : 0), 0);
}

/**
 * Manual price-per-day -> the markup % that makes list price = days x rate.
 * Third way to set the price, alongside markup % and target margin %.
 * Clamped at markup >= 0 (a day rate below cost floors at cost; discounts are
 * the sanctioned path to selling below cost).
 */
export function markupFromPricePerDay(pricePerDay: number, cost: number, days: number): number {
  if (!Number.isFinite(pricePerDay) || cost <= 0 || days <= 0) return 0;
  return Math.max(0, ((Math.max(0, pricePerDay) * days) / cost - 1) * 100);
}

/**
 * Split `total` into integer shares proportional to `weights`; the last
 * positive-weight share absorbs the rounding remainder so shares sum to total.
 */
export function allocate(total: number, weights: number[]): number[] {
  const weightSum = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const shares = weights.map((w) => round((total * Math.max(0, w)) / weightSum));
  const drift = total - shares.reduce((s, v) => s + v, 0);
  if (drift !== 0) {
    for (let i = weights.length - 1; i >= 0; i--) {
      if (weights[i] > 0) {
        shares[i] += drift;
        break;
      }
    }
  }
  return shares;
}

export function isScheduleValid(schedule: Proposal["schedule"]): boolean {
  if (schedule.length === 0) return false;
  let sum = 0;
  for (const item of schedule) {
    if (!Number.isInteger(item.percent) || item.percent < 0) return false;
    sum += item.percent;
  }
  return sum === 100;
}

export function calc(proposal: Proposal): CalcResult {
  const costs = proposal.programs.map(programCost);
  const totalCost = costs.reduce((s, c) => s + c, 0);
  const pricingDisabled = totalCost === 0;

  const markupPct = Number.isFinite(proposal.markupPct) ? Math.max(proposal.markupPct, 0) : 0;
  const listPrice = pricingDisabled ? 0 : round(totalCost * (1 + markupPct / 100));
  const days = totalDays(proposal.programs);
  const pricePerDay = !pricingDisabled && days > 0 ? round(listPrice / days) : null;

  let discountAmount = 0;
  let discountClamped = false;
  if (!pricingDisabled) {
    if (proposal.discount.type === "percent") {
      const pct = Math.min(Math.max(proposal.discount.value, 0), 100);
      discountAmount = round((listPrice * pct) / 100);
    } else {
      const amount = Math.max(0, round(proposal.discount.value));
      discountAmount = Math.min(amount, listPrice);
      discountClamped = amount > listPrice;
    }
  }

  const netPrice = listPrice - discountAmount;
  const marginAmount = netPrice - totalCost;
  const marginPct = netPrice > 0 ? (marginAmount / netPrice) * 100 : 0;

  const vatPct = Math.min(Math.max(proposal.vatPct, 0), 100);
  const vatAmount = round((netPrice * vatPct) / 100);
  const totalIncVat = netPrice + vatAmount;

  const netShares = allocate(netPrice, costs);
  const programs: ProgramTotals[] = proposal.programs.map((p, i) => ({
    programId: p.id,
    cost: costs[i],
    netShare: netShares[i],
    perParticipant:
      p.participants > 0 && costs[i] > 0 ? round(netShares[i] / p.participants) : null,
  }));

  const scheduleValid = isScheduleValid(proposal.schedule);
  const installments: ScheduleTotals[] = [];
  if (scheduleValid) {
    const amounts = allocate(totalIncVat, proposal.schedule.map((s) => s.percent));
    proposal.schedule.forEach((s, i) => installments.push({ itemId: s.id, amount: amounts[i] }));
  }

  return {
    totalCost,
    listPrice,
    discountAmount,
    discountClamped,
    netPrice,
    marginAmount,
    marginPct,
    vatAmount,
    totalIncVat,
    totalDays: days,
    pricePerDay,
    programs,
    installments,
    scheduleValid,
    pricingDisabled,
  };
}
