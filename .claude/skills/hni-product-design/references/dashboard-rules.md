# HNI Dashboard Rules

A dashboard is an instrument panel, not a lobby. Apply these rules to the Command Center, project overviews, P&L, client reporting views, and any screen with a KPI strip.

## The six questions

A dashboard is complete only when a user can answer all six without leaving it:

```text
1. What is happening?          current state, health, progress
2. What changed?               deltas since last period or last visit
3. What requires attention?    exceptions, overdue, blocked, unassigned
4. What is at risk?            risks with likelihood, impact, owner
5. What decision is required?  approvals, client decisions, escalations
6. What should I do next?      a ranked list of actions the user can take here
```

A dashboard must not primarily answer "where can I click to go somewhere else". If more than a third of the surface is navigation tiles, it is a menu, not a dashboard. Redesign it.

## Layout skeleton

Top to bottom, for a 1440px desktop:

```text
Page header:     title, scope selector (portfolio / client / project), period selector, primary action
KPI strip:       3 to 6 numbers. Label, value (tabular figures), delta with direction and period, optional sparkline. One row. No individual cards.
Attention band:  exceptions and decisions required. Table or compact list with owner, due, severity, and an inline action.
Analysis area:   one or two meaningful visualizations answering a stated question, or a comparison table.
Detail access:   filters, drill-down into drawers, links to Level 3 only from rows.
```

Mobile: the KPI strip becomes a 2-column grid, attention band stays first after it, analysis collapses into tabs.

## KPI rules

- Every KPI has a label, a value, a comparison (versus target, budget, or prior period), and a time reference.
- Deltas show direction and magnitude with color used semantically (positive Emerald, negative danger) and never with brand colors.
- A KPI with no comparison is a number, not a KPI. Either add the comparison or move it into a table.
- Six is the maximum in one strip. If you need more, you have two audiences; split the view.
- Clicking a KPI filters or drills the content below it; it does not navigate away.

## Attention band rules

- Sort by severity then due date.
- Each row has an owner and an action the user can take inline where safe (acknowledge, assign, update status, open in drawer).
- Overdue is stated in days ("3 days overdue"), not just colored.
- Empty state says why it is empty ("No overdue actions in this portfolio") and does not celebrate with illustrations.

## Charts on dashboards

Follow `data-viz-rules.md`. On a dashboard specifically:

- Two charts maximum above the fold.
- Each chart has a one-line title phrased as the question it answers ("GP% by project versus 35% target").
- If the chart would work as a five-row table, use the table.

## Actions from the dashboard

Allow inspect, filter, drill down, update, comment, assign, approve, resolve without a page transition when the action is safe and reversible. Destructive or financial actions confirm first.

## States

- Loading: skeleton rows in the KPI strip and attention band; never a full-page spinner.
- Empty: explain the scope and offer the one relevant next step.
- Error: say what failed, keep the rest of the dashboard working, offer retry.
- Stale data: show "as of" time in the header when data is not live.

## Self-check before handing off

- [ ] All six questions answerable
- [ ] KPI strip has comparisons and a period
- [ ] Attention band exists and has inline actions
- [ ] No navigation tiles dressed as content
- [ ] Two charts maximum above the fold, each with a question title
- [ ] Works at 1440, 1280, tablet, mobile
- [ ] Works in Arabic RTL with equivalent hierarchy
- [ ] Empty, loading, error, stale states present
