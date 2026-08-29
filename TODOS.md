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

## Completed
