# TODOS

## Pricing

### Rate card v2 (dropped from v1 by user decision)

**What:** Reintroduce a canonical rate card: default rates referenced by cost lines instead of typed each time, with the sent-snapshot machinery the eng review designed.

**Why:** V1 is fully manual entry, so the tool does not enforce rate consistency across proposals (the original premise 1, superseded on 2026-08-29). If real usage shows the same rates being retyped, or two proposals disagree on the same trainer rate, the rate card earns its way back.

**Context:** The full design already exists: see the RateSet, rate-pinning, and Mark-as-sent snapshot sections in the git history of docs/designs/pricing-costing-calculator.md (pre-revision), plus D24/D25/D26 decisions in that doc's review report. Trigger evidence comes from the new assignment: notes taken while pricing real proposals in v1.

**Effort:** M
**Priority:** P3
**Depends on:** V1 shipped and real-usage evidence that manual entry causes rate drift.

### Migrate PricingStore to Supabase and deploy

**What:** Swap the localStorage PricingStore implementation for Supabase and deploy the app, keeping the same storage interface.

**Why:** The canonical rate card cannot live in one browser forever. The design (docs/designs/pricing-costing-calculator.md, premise 5) treats local-first as debt with named repayment triggers: (a) an exported JSON gets emailed to a colleague or another machine, (b) any data-loss or "which export is current?" incident, (c) a second person asks to use the tool. Any one trigger means this TODO is due.

**Context:** The storage interface in src/features/pricing/store.ts (once built) is designed for this swap; .env.example already lists the expected Supabase variables. Migration is: implement the interface against Supabase, add an import path for the existing JSON export, deploy to a static host. No calc or UI changes.

**Effort:** M
**Priority:** P2
**Depends on:** Pricing v1 shipped and a premise-5 trigger firing.

### Copy-as-formatted-table on the client view

**What:** A "Copy table" action that puts the client-facing pricing table on the clipboard as formatted HTML for pasting into Word.

**Why:** If the real proposal workflow is pasting the pricing section into a Word document rather than attaching a PDF, this closes the last mile. Deferred during eng review (D30: letterhead PDF chosen for v1).

**Context:** Implement in the client view component (src/features/pricing/ClientView.tsx once built) using the async clipboard API with text/html. Verify paste fidelity into Word in both EN LTR and AR RTL; RTL table direction in clipboard HTML is the risky part.

**Effort:** S
**Priority:** P3
**Depends on:** Client view (task T4 of the eng review) shipped.

### Financial Breakdown page overflow (print)

**What:** Handle table overflow on the client document's Financial Breakdown page: many programs or long descriptions silently overflow the fixed 13.33x7.5in page and get clipped in print.
**Why:** A 12-program proposal today prints with missing rows and no warning. Same class of bug the PPT export caps with "+N more" (eng review T6.3).
**Context:** `.doc-page` is `overflow:hidden` at fixed size; start in ClientView's breakdown page. Options: paginate onto a second breakdown page, or cap with a continuation note.
**Effort:** S · **Priority:** P2 · **Depends on:** nothing.

### Single-slide breakdown export

**What:** Export just the Financial Breakdown slide as a .pptx for merging into larger client decks.
**Why:** The deck-merge job (rejected Approach A in docs/designs/ppt-export.md) resurfaces whenever the financial section joins a bigger presentation; manual rebuilding today.
**Context:** ~20 minutes after the full exporter ships: reuse slide 2's builder with a one-slide presentation. Gate on someone actually asking.
**Effort:** S · **Priority:** P3 · **Depends on:** PPT exporter shipped.

### Per-export language for the PDF

**What:** Give Print/Save PDF the same English/Arabic choice the PPT export has, instead of following UI language.
**Why:** Same mixed-language workflow argument (work in AR UI, send EN document).
**Context:** ClientView renders from global i18n dir/lang; an override needs a scoped language context around the document render. Decide after living with the PPT language menu.
**Effort:** S-M · **Priority:** P3 · **Depends on:** PPT export shipped (UX reference).

### Terms management by engagement type (feature B, next design session)

**What:** Move terms correctness into the app: engagement types (Stand Alone Workshop / Development Track / Assessment Center) each carry their own Terms & Conditions variant; Project Assumptions become per-proposal editable content seeded from the type's default. PDF and PPT both render from this single source.
**Why:** The eng-review gate (docs/designs/ppt-export.md, Post-Gate Revision) proved the team edits terms per engagement type today, by hand, in PowerPoint. That rule belongs in the app.
**Context:** User holds an Assessment Center proposal PDF containing that variant's terms; collect it at session start. Extends projectType or adds a parallel termsVariant field; assumptions likely `string[]` on Proposal with a small editor. Run /office-hours for this feature.
**Effort:** M · **Priority:** P2 · **Depends on:** PPT export shipped; Assessment Center PDF provided.

### Pipeline first paste test (user assignment)

**What:** Import the real Google Sheet pipeline tab (File > Download > CSV of the pipeline tab) via Pipeline > Import sheet CSV, reconcile the dashboard totals against the sheet's own sums, then Copy rows and paste into the sheet to check cell formats land correctly.
**Why:** The build gate was waived; the export format defaults (percents "50%", plain integer money, DD/MM dates) are educated guesses isolated in `src/features/pricing/pipelineCsv.ts` and must be tuned against reality.
**Effort:** S · **Priority:** P1 · **Depends on:** pipeline feature shipped (done).

## Completed
