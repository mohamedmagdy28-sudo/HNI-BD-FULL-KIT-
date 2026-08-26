# HNI UX Principles

## Contents

1. Users and their jobs
2. The ten priorities
3. Three-level information architecture
4. Page, inline, drawer, modal, route
5. Generic AI UI anti-patterns and what to do instead
6. Module principles (Command Center, Actions, Timeline/Gantt, P&L, Calendar, Global search)
7. Product architecture target

---

## 1. Users and their jobs

Design for the person doing the work, not for a generic "user".

| User | Who | Needs from the interface |
|---|---|---|
| HNI internal team | Project managers, L&D consultants, program managers, business team, operations, leadership | Project control, scheduling, financial visibility, actions, risks, participant and cohort tracking, deliverables, reporting |
| Client HR / L&D | L&D managers and directors, HR and talent leaders | Program status, evidence of impact, participant progress, risks, milestones, financial visibility where applicable, executive reporting |
| Participants | Learners in a program | A clear journey: activities, assessments, learning, progress, deadlines, feedback, coaching, a premium experience |
| Trainers / coaches | Facilitators | Their participants, sessions, evaluations, attendance, feedback, actions, assignments |
| Executives | HNI leadership and client sponsors | Exception-based reporting, concise KPIs, trends, risks, impact, financial performance, decisions required |

Every screen serves a primary user. Name that user in the brief. Secondary users get what they need without diluting the primary user's job.

## 2. The ten priorities

```text
1. Task effectiveness      can the user complete the job here, correctly
2. Clarity                 is meaning obvious without a legend or tooltip
3. Decision usefulness     does the screen change what the user decides
4. Operational speed       fewest clicks, fewest transitions, fastest scan
5. Information hierarchy   most important thing first, largest, strongest
6. Data credibility        sources, dates, totals that reconcile, no misleading charts
7. Error prevention        validation, confirmation for destructive actions, safe defaults
8. Accessibility           WCAG 2.2 AA
9. Premium experience      calm, confident, consistent
10. Visual distinction     HNI identity, earned through restraint
```

Never sacrifice a higher priority for a lower one.

## 3. Three-level information architecture

| Level | Purpose | Shows |
|---|---|---|
| 1. Executive summary | Orientation and exceptions | Health, progress, critical KPIs, risks, exceptions, upcoming milestones, decisions required |
| 2. Operational analysis | Understanding and comparison | Trends, cohort comparisons, timeline, action status, financial performance, participant progress, delivery status |
| 3. Detail | Records and evidence | Records, transactions, participants, sessions, activities, invoices, actions, comments, history |

Use progressive disclosure. Level 1 is visible on load. Level 2 is one interaction away (tab, expand, filter). Level 3 opens in a drawer or a detail route. Do not show all three levels at once.

## 4. Page, inline, drawer, modal, route

Decide where each interaction lives before building it:

| Put it | When |
|---|---|
| On the page | The user needs it to orient or decide (Level 1 and 2 content) |
| Inline | A single field or status can change without context loss (inline edit, status select, quick assign) |
| In a drawer | Detail or a form that benefits from keeping the list visible behind it (record detail, edit action, participant profile) |
| In a modal | A short, blocking decision (confirm delete, resolve a conflict). Rare. |
| On another route | A different job entirely (a different module, a full-page editor, a report) |

Prefer drawers over modals. Prefer inline over drawers. Prefer the page over a new route. Avoid dead-end navigation.

## 5. Generic AI UI: anti-patterns and replacements

| Avoid | Do instead |
|---|---|
| Excessive cards, card-inside-card | Sections separated by 1px borders and spacing; cards only for genuinely discrete objects |
| Every KPI in its own giant card | A single KPI strip: 3 to 6 numbers in a row, label above, delta beside, sparkline optional |
| Repetitive icon + title + number tiles | Tables with conditional indicators; a strip; a bullet chart |
| Giant headings, huge empty areas | Operational type scale, dense-but-readable layout |
| Random gradients, glassmorphism, excessive shadows, excessive rounding | Flat surfaces, 1px borders, 6 to 12px radius, shadow only on floating layers |
| Decorative charts | Charts that answer a written business question, otherwise a table |
| Excessive pills, excessive modals | Text badges, drawers, inline editing |
| Hidden navigation | Persistent primary navigation, breadcrumbs, contextual actions in the page header |
| Dashboard as a set of links | Dashboard that shows state, exceptions, and lets the user act (see `dashboard-rules.md`) |
| Decorative animation | Motion only to explain a state change (drawer open, row update, sort) at 150 to 250ms, respecting reduced motion |
| Landing-page patterns in the app | Product patterns: page header with title, filters, actions; content below |

Prefer: strong hierarchy, dense-but-readable layouts, contextual actions, inline editing, drill-down, drawers, progressive disclosure, meaningful tables, meaningful visualizations, saved filters, search, contextual navigation, exception management, action-oriented dashboards.

## 6. Module principles

### Command Center

Aggregates meaning from every module: portfolio health, revenue and GP, project risk, upcoming milestones, overdue actions, cohort status, participant progress, invoices, resource conflicts, client decisions required. Users take common actions directly from it where safe (assign, update status, acknowledge risk). It is not a launcher.

### Action tracker

Data model should support: action, project, owner, due date, status, priority, source, created by, created date, updated date, comments, attachments, dependencies, overdue state. Views: My Actions (default for most users), All, Overdue, Due Soon, Completed, By Project, By Owner. Do not overload the default view; show the columns needed to decide and act, hide the rest behind a column picker.

### Timeline / Gantt

Should support phases, activities, milestones, dependencies, cohort schedules, parallel groups, baseline versus actual, pinned milestones, filters, zoom, Arabic and English, Hijri and Gregorian, export. Progressive disclosure is mandatory: default view shows phases and milestones; dependencies, baseline, and calendars are toggles. Never show every control permanently.

### P&L

Must answer: are we profitable, are we on budget, where is the variance from, what changed, what needs intervention, what is the forecast. Lead with Revenue, Cost, Gross Profit, GP%, Budget, Actual, Forecast, Variance. Then drill down by project, cohort, cost category, period. Avoid decorative finance dashboards; variance tables with conditional indicators outperform ring charts.

### Calendar

Must show cohorts, groups, parallel groups, sessions, milestones, trainers, venues, conflicts. Conflicts must be visually obvious (overlapping trainer or venue highlighted with a warning indicator and an explanation). Editing dates must be simple and safe: drag with confirmation or a small inline date editor, undo available.

### Global search and command palette

Search across projects, clients, participants, actions, programs. A command palette (Cmd/Ctrl + K) with create project, add action, find participant, open project, add cohort, export report is worthwhile only if it saves real clicks for internal users. Implement only if it materially improves usability.

## 7. Product architecture target

The platform should feel like one operating system, not disconnected tools:

```text
Command Center
Projects: Overview, Timeline, Cohorts, Participants, Actions, Risks, Deliverables, Financials, Impact
Clients
Programs
Resources
Analytics
Administration
```

Compare this with the existing architecture before changing routes. Preserve existing routes unless there is a strong reason.
