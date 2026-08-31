// Shared display decisions for the client document (eng review T2).
// Both renderers (HTML client view -> PDF, and the PPT exporter) call these,
// so the two surfaces can never disagree on WHAT the document shows.
// Rendering (fonts, currency labels, layout) stays per-surface by design.

import type { CalcResult } from "./calc";
import type { Program } from "./types";

/** The Description column exists only when at least one group carries a description. */
export function hasDescriptions(programs: Program[]): boolean {
  return programs.some((p) => p.description.trim() !== "");
}

/** The discount rows exist only when a discount actually applies. */
export function discountVisible(result: CalcResult): boolean {
  return result.discountAmount > 0;
}

/** The payment schedule renders only when valid and non-empty. */
export function scheduleVisible(result: CalcResult, scheduleLength: number): boolean {
  return result.scheduleValid && scheduleLength > 0;
}

/**
 * Caps a row list for fixed-height surfaces (deck slide 2, eng review T6.3).
 * Returns the rows to show and how many were hidden.
 */
export function capRows<T>(items: T[], max: number): { shown: T[]; hiddenCount: number } {
  if (items.length <= max) return { shown: items, hiddenCount: 0 };
  return { shown: items.slice(0, max), hiddenCount: items.length - max };
}
