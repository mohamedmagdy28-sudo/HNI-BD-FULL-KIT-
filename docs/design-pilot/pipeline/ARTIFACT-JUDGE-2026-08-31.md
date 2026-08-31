# HNI Artifact Judge: Pipeline dashboard (goal band, KPI strip, deal table, drawer, import/export)

Date: 2026-08-31
Artifact: http://localhost:5173 (Pipeline tab), commit 1175f90, src/features/pricing/PipelineTab.tsx + pipelineMath.ts + pipelineCsv.ts
Brief: given (docs/designs/pipeline.md + pipeline-goal-visuals.md)
USER: BD lead (Mohamed) | JOB: know achievement vs GP goal, keep deal stages/probabilities/GP current, move rows to the Google Sheet | INFORMATION: achieved GP vs target, booked share, open + weighted pipeline, per-deal stage/prob/revenue/GP | DECISION: which deals to push, what to report to management | ACTION: set stage/prob/GP inline, drawer details, copy rows, import sheet | SUCCESS: dashboard numbers match reality and paste cleanly into the sheet

Evidence collected:
- Directions: EN LTR yes, AR RTL yes
- Breakpoints: 1440 yes, 1280 spot (matrix e2e), tablet 834 yes, mobile 375 yes
- States: loading n/a (synchronous localStorage by design), empty yes (app-level + pipeline-level + no-target goal card), error yes (import-failure path unit/e2e), validation yes (prob/GP clamps), long text yes (120-char EN + long AR names), large numbers yes (9-digit values)
- Method: live browser (preview pane) + instrumented JS audits + existing Playwright suite (207 tests) + source greps

## Verdict (after refinement, same day)

**SHIP** Weighted score: **8.7/10**  CRITICAL: 0  HIGH: 0  MEDIUM: 1 (F5, accepted partial)  LOW: 2 (F8, F9, accepted)

Initial pass scored **8.4 / DO NOT SHIP** (1 HIGH). Refinement fixed F1 (delete confirm), F2 (<1%/>99% display), F3 (sticky client column), F4 (contrast tokens), F6 (CLDR plurals EN/AR), F7 (wording), and F10 (pipeline reachable with zero proposals — found during re-test). F5 partially fixed (hover underline added; explicit details button deferred). All fixes re-verified live and by the automated suite (107 unit, 52 e2e on both extreme projects). Post-fix scores: Interaction quality 8, Accessibility 8, Responsiveness 8 → weighted 8.7.

## Scorecard

| Dimension | Weight | Score | Weighted | Findings | Note if < 8 |
|---|---:|---:|---:|---|---|
| Task effectiveness | 20% | 9 | 1.80 | — | |
| Information architecture | 15% | 9 | 1.35 | — | |
| Decision usefulness | 15% | 8 | 1.20 | F2 | |
| Cognitive load | 10% | 8 | 0.80 | F9 (accepted duplication, design premise) | |
| Visual hierarchy | 10% | 9 | 0.90 | — | |
| Interaction quality | 10% | 7 | 0.70 | F1, F5 | One-click destructive delete on imported rows; drawer reachable only by unhinted cell click |
| Accessibility | 5% | 7 | 0.35 | F4 | grey-mid (#999, 2.8:1) on informational % suffixes and captions |
| Responsiveness | 5% | 7 | 0.35 | F3 | Mobile table scrolls with no pinned client column |
| RTL/LTR parity | 5% | 9 | 0.45 | — | |
| Visual distinction | 5% | 9 | 0.45 | — | |
| **Total** | 100% | | **8.4** | | |

## Job walk

Open app → 1 click to Pipeline tab. Achievement readable in ~2 seconds (goal band leads). Updating a deal: stage via inline select (2 clicks), probability/GP typed directly in the row (0 transitions). Drawer details: 1 click on a name cell (no visual hint this is clickable — hesitation point). Copy to sheet: 2 clicks (menu → option), toast confirms row count. Import: 2 clicks + file picker + confirm on replace. No route transitions anywhere. No dead ends found: every empty state carries a next action.

### F10. Pipeline unreachable when only imported deals exist  [MEDIUM — found during re-test, FIXED]  (catalog A7)
PROBLEM: With zero proposals the header (and Pipeline toggle) did not render, making imported deals invisible.
EVIDENCE: Live: 2 externals + 0 proposals showed only the "No proposals yet" empty state.
FIX APPLIED: Header controls render when any pipeline data exists; verified live.

## Findings (ranked; F1-F4, F6, F7, F10 FIXED same day — see verdict)

### F1. Imported deal deletes on one click, no confirmation  [HIGH]  (catalog D6)
PROBLEM: The trash button on an imported row deletes the deal immediately, with no confirm and no undo.
EVIDENCE: PricingScreen.tsx `deleteExternal` calls store delete directly; verified live — one click removes the row and totals change. Contrast: deleting a Won/Lost proposal DOES confirm (`confirmDecidedDelete`).
USER IMPACT: A Won imported deal feeds Achieved revenue/GP; one misclick silently shrinks the achievement numbers shown to management, recoverable only by re-importing the sheet.
RECOMMENDED FIX: The same `window.confirm` guard used for decided proposals, for all imported rows (they cannot be recreated in-app).

### F2. Booked bar can show "0% booked" while the legend shows Won deals  [MEDIUM]  (catalog B5)
PROBLEM: Integer rounding floors small shares to 0% (and would ceil >99.5 to 100%).
EVIDENCE: 1440/mobile EN + AR screenshots: "0% booked" beside "Won (3)"; wonValue 541,000 / total 1.12B = 0.048%.
USER IMPACT: Executive reads "nothing booked" while wins exist; data credibility hit in exactly the report-out moment the band was built for.
RECOMMENDED FIX: Display "<1%" when 0 < share < 1 and ">99%" when 99 < share < 100; keep integers otherwise.

### F3. Mobile table: horizontal scroll without a pinned client column  [MEDIUM]  (catalog F2)
PROBLEM: At 375px the table scrolls horizontally and the client/title columns scroll out of view while editing probability/GP.
EVIDENCE: Mobile 375 screenshots EN + AR; editing STC's GP% with the client column off-screen.
USER IMPACT: Editing the wrong deal's numbers on mobile is easy; recovery requires scrolling back to verify.
RECOMMENDED FIX: `position: sticky` inline-start on the first column (th + td) with an elevated background token.

### F4. Informational text below contrast minimums  [MEDIUM]  (catalog E3)
PROBLEM: `text-hni-grey-mid` (#999999, 2.85:1 on white) is used for the % suffixes inside probability/GP inputs and the "All deals" caption — informational, not decorative.
EVIDENCE: Computed style rgb(153,153,153); WCAG AA requires 4.5:1 for small text.
USER IMPACT: Low-vision users lose the unit marker and the period-scope caption that disambiguates Card 2 from Card 1.
RECOMMENDED FIX: Use `text-hni-grey-dark` (11:1, verified) for these three usages; reserve grey-mid for true decoration.

### F5. Drawer reachable only by unhinted cell click  [MEDIUM]  (catalog A3)
PROBLEM: Deal details (source, dates, PO, notes) open by clicking the client/title cell; nothing marks these cells as interactive beyond `cursor: pointer` on hover.
EVIDENCE: Live walk: first-time hesitation locating where the drawer opens; no chevron, no underline, no button.
USER IMPACT: Weekly fields (PO number, delivery dates) are effectively hidden from a new user (the team, once shared).
RECOMMENDED FIX: Add a hover underline on the client cell and an explicit trailing "details" icon-button per row, reusing the ghost button pattern.

### F6. "deals" never pluralizes; Arabic count grammar off  [LOW]  (catalog B3)
PROBLEM: "1 deals" (EN); "5 صفقة" where 3-10 takes "صفقات" (AR).
EVIDENCE: KPI tiles at all breakpoints.
RECOMMENDED FIX: Simple n===1 branch EN; AR: "صفقة واحدة" / "صفقتان" / "{n} صفقات" (3-10) / "{n} صفقة".

### F7. Pipeline empty state says "as CSV" but xlsx is supported  [LOW]  (catalog D1 wording)
EVIDENCE: Empty-state body text vs the "Import sheet file" button label.
RECOMMENDED FIX: "…or import your existing sheet (Excel or CSV)."

### F8. External drawer delivery dates are free text while proposal dates get date pickers  [LOW]
EVIDENCE: Drawer input types audit: 9 text inputs on external rows.
RECOMMENDED FIX: Accepted for now (imported strings are free-form by design); revisit if externals become long-lived.

### F9. Copy rows / Download CSV enabled with an empty pipeline  [LOW]
EVIDENCE: Empty-state screenshot; clicking yields the "no new rows" toast.
RECOMMENDED FIX: Disable both when no rows; keep Import enabled.

## Checked, not observed

A1 navigation (3 destinations reached first try, labels match); A2 clicks (primary job ≤2 clicks, minimum path); A4 (no navigation tiles); A5 (zero modals; drawer + confirms only); A6 (one primary per region); A7 dead ends (every state has an action); B1 (achieved GP appears in band + tile — deliberate, recorded design premise with "All deals" caption differentiating scope); B2 (targets and counts present on all KPIs); B3 terminology (deal/صفقة consistent, stage names consistent); B4 (both bars answer stated questions, axes n/a); B6 (excluded rows surfaced with count note); C1 squint (band leads, one emphasis); C2/C3 (flat cards, no card-in-card, no icon-tile grids); C4 (magenta only on progress + primary button; success/danger semantic); C5 density (11 rows above fold at 1440, 45px rows); D2 loading (synchronous store, no flash observed); D3 error (import-failure toast path exercised in tests); D4 validation (prob/GP clamped 0-100, import confirm); D5 long text/large numbers (wrap, no overflow, no broken alignment at any tested breakpoint, both directions); E1 keyboard (all controls reachable; Radix menus/selects keyboard-verified in e2e); E2 focus (rings verified on select trigger + inputs); E4 semantics (0 unnamed buttons, 0 unlabeled inputs, real th headers, progressbar/img roles with localized aria); E5 targets (≥24px everywhere; 28px delete icon); E6 reduced motion (no non-essential animation beyond Radix transitions); E7 (both bars have text alternatives); F1 breakpoints (1440/834/375 live + 1280 via e2e matrix, no horizontal page scroll, no overlap); F3 drawer mobile (full-height sheet, scrollable); G1-G8 (RTL live-tested: mirrored columns, start-anchored fills, end-side drawer, Tajawal, Latin digits with bdi isolation, no physical CSS props in grep); H1 (no raw hex in pipeline components); H2 (KpiStrip/StatusBadge/DetailSheet/EmptyState reused); H3 (badge/header/empty-state patterns match other modules); H4 (inline edits repaint imperceptibly; 11-row table + 9-digit values no jank). Stale console note: two ReferenceErrors in the long-lived dev tab predate this build (HMR mid-edit artifacts); a fresh instrumented session across the full walk recorded zero errors, and the Playwright console guard is green across 207 tests.

## What to keep

- Verbatim sheet stage strings under localized labels — the sheet paste keeps working.
- Excluded-rows counting note — silent data loss is the failure mode this prevents.
- bdi-wrapped money everywhere — AR numbers never shear.

## Re-test instructions

After fixes: F1 — delete an imported row, expect a confirm; cancel keeps the row and totals. F2 — seed won=541k/total=1.12B, expect "<1%"; won=0 expect "0%". F4 — computed color of % suffixes and "All deals" ≥ 4.5:1. F3/F5 if taken: sticky first column at 375px; visible details affordance. Then re-run e2e pipeline suite both extremes.
