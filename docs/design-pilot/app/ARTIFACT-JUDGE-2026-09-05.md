# HNI Artifact Judge: Pricing & Costing (whole app)

Date: 2026-09-05
Artifact: local hermetic build http://localhost:5198 (localStorage mode) + live https://mohamedmagdy28-sudo.github.io/HNI-BD-FULL-KIT-/ (cloud mode, login screen only); source at src/features/pricing/
Brief: inferred
USER: BD lead / country manager (Mohamed), BD members (Heba, Menna, Vandana), delivery roles (Lina PT, Omar PM) | JOB: build the financial section of a client proposal, send it, and track the deal | INFORMATION: costs, markup/margin/price-per-day, discount, VAT, payment schedule, terms | DECISION: what price to quote and whether margin is acceptable | ACTION: create, price, preview, mark sent, export, track stage | SUCCESS: a locked, reproducible client document and a pipeline row with GP

Evidence collected:
- Directions: EN LTR yes, AR RTL yes
- Breakpoints: 1440 yes, 1280 yes (e2e), tablet yes, mobile yes (2026-09-04 QA pass)
- States: loading partial (cloud only, observed on live in prior sessions), empty yes, error partial (cloud error paths code-reviewed + live 400 handling observed; not forced today), validation yes, long text yes, large numbers yes
- Method: live browser walk with DOM probes + screenshots at 1440/768/375, both languages; Playwright suite (280 tests, 8 projects) as regression baseline; source reading for state coverage

## Verdict

**DO NOT SHIP (one HIGH open)**  Weighted score: **8.5/10**  CRITICAL: 0  HIGH: 1  MEDIUM: 3  LOW: 3

Shortest path to SHIP: fix J1 (block Mark as sent on invalid schedule, or auto-normalize), then J2 in the same change. Everything else is scheduled polish.

## Scorecard

| Dimension | Weight | Score | Weighted | Findings | Note if < 8 |
|---|---:|---:|---:|---|---|
| Task effectiveness | 20% | 9 | 1.80 | J1, J2 | |
| Information architecture | 15% | 9 | 1.35 | | |
| Decision usefulness | 15% | 8 | 1.20 | J5 | |
| Cognitive load | 10% | 8 | 0.80 | J5 | |
| Visual hierarchy | 10% | 8 | 0.80 | J3 | |
| Interaction quality | 10% | 8 | 0.80 | J6 | |
| Accessibility | 5% | 7 | 0.35 | J4, J7 | grey-mid text at 2.85:1 in small hints and the document legal note; 28px icon targets |
| Responsiveness | 5% | 9 | 0.45 | | |
| RTL/LTR parity | 5% | 9 | 0.45 | | |
| Visual distinction | 5% | 9 | 0.45 | | |
| **Total** | 100% | | **8.5** | | |

## Job walk

New proposal (click 1) → type client + title (autosaves, no save step) → Add program (click 2) → type days, participants, two cost lines → price panel already live; set discount inline → Client view (click 3) → back (click 4) → Mark as sent (click 5). Five clicks, zero route changes, no hesitation points for a trained user. One hesitation for a new user: the Client view button silently disables when the payment schedule is invalid (J2). Delivery-role walk (BOQ relay) not re-walked today; covered by the 2026-09-03 build verification and e2e.

## Findings (ranked by severity, then impact)

### J1. A proposal with an invalid payment schedule can be marked as sent  [HIGH]  (catalog D4, B5, A7)
PROBLEM: Mark as sent accepts a schedule that does not sum to 100%, locking a record whose client document silently omits the payment schedule.
EVIDENCE: 1440 EN, localhost:5198. Set the single installment to 60% → inline validation appears ("Installment percents must be whole numbers and sum to exactly 100."), Client view disables, but Mark as sent stays enabled and succeeds (sent badge appears). Opening the sent document from Documents renders with scheduleShown=false — no payment schedule section. The editor's own Client view button remains disabled on this locked proposal while Documents → Open document works (inconsistent gate).
USER IMPACT: BD sends/locks a quote whose document is missing the agreed payment terms; the archive no longer reproduces what should have been quoted. Finance and the client see different expectations.
RECOMMENDED FIX: disable Mark as sent while `!result.scheduleValid` (same predicate that disables Client view) and show the existing validation message next to it; remove the disable from the editor's Client view or keep both consistent. One-line predicate reuse in PricingScreen.

### J2. Disabled Client view gives no reason  [MEDIUM]  (catalog A7, D4)
PROBLEM: When the schedule is invalid the Client view button greys out with no tooltip or message linking it to the schedule error.
EVIDENCE: 1440 EN; `open-client-view` disabled=true, title attribute null; the schedule error renders ~600px away in the side panel.
USER IMPACT: user hunts for why the preview stopped working.
RECOMMENDED FIX: `title={p.scheduleInvalid}` (existing i18n string) on the disabled button, or surface the message inline under the button.

### J3. Very long titles push cover subtitles onto low-contrast art  [MEDIUM]  (catalog D5)
PROBLEM: A ~130-character proposal title wraps to 5 lines on the document cover and pushes "Proposed in …" / "Prepared for …" down onto the dark buildings of the cover photo, where the grey #404040 text loses legibility.
EVIDENCE: 1440 EN, sent stress proposal; screenshot shows subtitle lines over the skyline. No overflow (74px margin to page bottom) — a legibility issue, not a layout break.
USER IMPACT: the printed cover of a long-titled proposal looks unpolished to the client.
RECOMMENDED FIX: clamp the cover h1 (`line-clamp-3` equivalent via max-height + overflow hidden) or scale type down past ~80 characters; alternatively cap the title field length with a counter.

### J4. Small hint text below AA contrast  [MEDIUM]  (catalog E3)
PROBLEM: `--hni-grey-mid` (#999999) measures 2.85:1 on white — below 4.5:1 for text and marginally below 3:1 for UI components.
EVIDENCE: computed-style measurement; used as text in SummaryPanel `pricingDisabledHint` (12px), AuthGate hint (11.5px), the document's Arabic legal note (9.5pt, ClientView:195), and as the resting color of delete icon buttons.
USER IMPACT: low-vision users cannot read the hints; the legal note prints faint.
RECOMMENDED FIX: switch those four text usages to `text-hni-grey-dark` (11.1:1); keep grey-mid for disabled/decorative only.

### J5. "Margin" vs "GP" for adjacent concepts  [LOW]  (catalog B3)
PROBLEM: the editor speaks of "Margin %" while the pipeline speaks of "GP" with no bridge between the terms.
EVIDENCE: SummaryPanel margin banner vs PipelineTab "Achieved GP", "GP goal". Arabic uses هامش الربح consistently, so the gap is EN-only.
USER IMPACT: a new member wonders whether GP and margin are the same number.
RECOMMENDED FIX: one-time glossary line in the pipeline empty state or a title tooltip on "GP" ("gross profit = margin on won deals").

### J6. Destructive confirmations use native window.confirm  [LOW]  (catalog A5, H3)
PROBLEM: delete/mark-sent confirmations are browser-native dialogs, visually outside the design system (correctly localized, keyboard-accessible).
EVIDENCE: delete flows in editor and Documents (e2e handles them as native dialogs).
USER IMPACT: minor polish inconsistency; no functional harm.
RECOMMENDED FIX: only when convenient, swap to the existing shadcn AlertDialog; keep the same copy and testids.

### J7. Icon actions at 28px on mobile  [LOW]  (catalog E5)
PROBLEM: trash/reset icon buttons are 28×28 CSS px — above the WCAG 24px minimum, below the 40px comfort bar for mobile.
EVIDENCE: `h-7 w-7` buttons in CostTable, DocumentsList, schedule rows; all secondary actions.
USER IMPACT: slightly harder taps on phones; primary actions are all full-size.
RECOMMENDED FIX: `sm:h-7 sm:w-7 h-9 w-9` on those icon buttons if mobile use grows.

## Checked, not observed

- A1 navigation: three destinations (Documents, Pipeline, New) reached first try at 1440/375, EN/AR.
- A2 clicks: 5-click primary job, no avoidable transitions (walk above).
- A3 hidden functionality: every action has a visible labeled control; icon buttons all carry aria-labels (probe: 0 unnamed).
- A4 dashboard-as-navigation: pipeline tiles show data, none navigate-only.
- A6 CTA hierarchy: one magenta primary per region (editor header, row actions).
- B1 redundancy: each money value appears once per context; status badge single-source.
- B2 comparisons: margin vs 30% floor, GP vs targets, weighted vs open pipeline all present.
- B4 charts: progress bars only, each against a target; no decorative charts.
- B6 exceptions: below-floor margin banner, corrupt-record banner (code path), empty states with actions.
- C1–C5: squint test holds (total/margin dominate); no card-in-card, no KPI tile grids, no brand misuse (semantic colors used for status); pipeline shows >10 rows above fold at 1440.
- D1 empty states: proposals, documents, pipeline all have explanatory empty states with a next action (screenshots 2026-09-04/05).
- D2 loading: cloud AuthGate loading + saved/saving/error chip exist and were observed on live in prior sessions; localStorage mode has no async gap. Not re-forced today.
- D3 errors: load-error with retry, re-login modal, export toasts, BOQ conflict banner exist in code and e2e; stale-token 400 handling observed live 2026-09-03.
- D6 destructive: all deletes and decided-deal deletes behind confirmation (e2e green).
- E1/E2 keyboard: focusable order matches visual order (probe), global :focus-visible outline 2px magenta present.
- E4 semantics: inputs labeled, tables have headers, no color-only status (badges carry text).
- E6 reduced motion: global reduced-motion override in index.css.
- E7 charts: progress bars carry text values adjacent.
- F1–F3 breakpoints: 1440/768 probes today, 1280 + mobile via e2e and 2026-09-04 QA; zero page-level overflow anywhere; tables scroll in-card.
- G1–G8: full RTL walk 2026-09-04 (editor, documents, client doc mirroring with flipped motifs, Arabic terms, Tajawal, logical utilities only; bank table intentionally LTR).
- H1 tokens: components token-clean; the client document uses template-literal colors by design (print artifact).
- H2/H3 consistency: shared StatusBadge/EmptyState/MoneyInput reused across modules.
- H4 performance: all interactions instant in walks; 280-test suite runs with no timeout flakiness.

## What to keep

- The price chain (cost → markup → list → discount → net → margin banner → VAT → total) reads top-to-bottom with the margin floor as the single loudest signal. Do not dilute it.
- Confidentiality by construction: client document and BOQ never receive internal figures.
- The scale-to-fit document preview and in-card table scrolling from the 2026-09-04 mobile pass.

## Re-test instructions

After fixes, hni-qa should verify: (J1) invalid schedule → Mark as sent disabled with visible reason; already-sent invalid records still open from Documents; (J2) disabled Client view shows the reason; (J3) 130-char title cover renders legibly or clamps; (J4) hints and legal note measure ≥4.5:1; run desktop + mobile, EN + AR, and re-run the full e2e suite.

## Fixes applied and re-tested (same day)

- J1 FIXED: Mark as sent disables on invalid schedule with the scheduleError tooltip; markSent handler also guards (`!result?.scheduleValid`) so programmatic clicks cannot bypass (verified: forced click leaves sentAt null). Locked proposals always open (Client view disable now applies to drafts only, matching Documents).
- J2 FIXED: both disabled buttons carry the validation message as a tooltip via a wrapping span (disabled buttons drop pointer events).
- J3 FIXED: cover title steps down to 22pt past 80 characters in the document and the PPT export; 132-char title renders 3 lines with subtitles on the light band (verified visually).
- J4 FIXED: new token `--hni-grey-slate: #767676` (4.54:1) added to index.css + tailwind; the three hint texts and all resting delete/reset icon controls moved to it. Grey-mid remains for dividers, placeholders, disabled nav.
- J5 FIXED: `gpGlossary` tooltip (EN/AR) on the Achieved GP KPI label and the GP goal header via a new optional `hint` on KpiStrip.
- J7 FIXED: icon actions are 36px on mobile (`h-9 w-9 sm:h-7 sm:w-7`).
- J6 ACCEPTED (owner-visible): native confirms stay — swapping to AlertDialog is polish that would churn the e2e dialog handling for no functional gain.

Post-fix verdict: **SHIP** (HIGH = 0, weighted unchanged at 8.5 pending a fresh full judge pass). Unit 169 green; full e2e re-run recorded below by hni-qa.

## Requested extra: missing features (ranked)

Not part of the SHIP gate. Ranked by decision value to the BD job:

1. **Send guard / approval note when below the margin floor** — the banner warns, but nothing records that a below-floor quote was knowingly sent. A one-line "reason" prompt on Mark as sent below 30% creates an audit trail for the country manager. (Small)
2. **Team analytics screen** — GP-led month/quarter view across the team's pipeline rows (already the #1 gstack enhancement recommendation). Answers "are we going to hit the number" without exporting to Excel. (Medium)
3. **Follow-up nudges on sent proposals** — a "sent N days ago, still at Proposal" chip in the pipeline; stale deals are today invisible until someone remembers. (Small)
4. **Win/loss reason on stage change** — one select when moving to Won/Lost; after a quarter you can see why deals die. (Small)
5. **Rate card v2** — standard day-rates per program type that pre-fill cost lines and flag off-rate-card pricing. (Medium)
6. **Client directory** — reuse client name + logo across proposals, dedupe spelling variants that currently fragment the pipeline by client. (Medium)
7. **Proposal revision links** — Duplicate exists, but nothing ties v2 to v1; a "revision of" link would let Documents show one thread per deal. (Small)
8. **Arabic PPT export** — the deck is English-only by the 2026-08-31 decision; now that the document is fully RTL with Arabic terms, revisit. The exporter already takes a language parameter; re-exposing it is a two-line change plus QA. (Small)
