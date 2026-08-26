---
name: hni-product-design
description: The design authority for every HNI enterprise operational interface (Command Center, project dashboards, P&L, Gantt/timeline, cohort calendar, action tracker, participant and trainer views, client reporting). Use this skill whenever you design, redesign, restructure, or implement any screen, component, chart, table, drawer, form, or navigation in an HNI repository, even if the user only says "make this better", "add a page", "build a dashboard", or "fix the layout". Loads HNI product philosophy, user types, UX priorities, brand tokens, dashboard rules, Arabic RTL rules, and data visualization rules. Outranks frontend-design, design-review, and impeccable-polish when instructions conflict.
user-invocable: true
---

# HNI Product Design

HNI applications are enterprise operational tools, not marketing sites. The interface exists so a project manager, an L&D director, a trainer, a participant, or an executive can understand what is happening, see what needs attention, decide, act, and produce credible evidence of impact. Every design choice is judged against that job, never against how impressive it looks in a screenshot.

## Precedence

When guidance conflicts, resolve in this order and say which rule won:

1. HNI product requirements (the feature brief, existing business logic, existing data)
2. This skill and its references
3. `frontend-design` (official Anthropic)
4. The existing component system in the repository
5. `impeccable-polish` (final refinement only)

`design-review` and `hni-artifact-judge` evaluate output; they do not redefine the rules above.

## Before you design anything

1. Read the relevant reference files below. Do not design from memory of the brand.
2. Inspect the repository for existing tokens, components, and patterns. Reuse before extending, extend before creating.
3. Write the UX brief for the feature (six lines, no code yet):

```text
USER:                 who is looking at this screen
JOB TO BE DONE:       what they must accomplish in this session
INFORMATION REQUIRED: the minimum data needed to do the job
DECISION:             what they decide here
ACTION:               what they can do here without leaving
SUCCESS STATE:        how they know the job is done
```

If any line is unclear, investigate the codebase or ask before implementing. Do not guess a persona and build for it.

4. Decide the information architecture level (see `references/ux-principles.md`): Level 1 executive summary, Level 2 operational analysis, Level 3 detail. Decide what belongs on the page, inline, in a drawer, in a modal, or on another route. Default to fewer route transitions.

## Reference files

Read the ones that apply to the task. Each is short and authoritative.

| File | Read when |
|---|---|
| `references/brand.md` | Any visual work: colors, typography (Tajawal for Arabic), tokens, logo, photography rules, "never do" list |
| `references/ux-principles.md` | Any screen or flow: user types and their needs, the 10 UX priorities, three-level IA, generic-AI-UI anti-patterns, module principles (Command Center, actions, Gantt, P&L, calendar) |
| `references/dashboard-rules.md` | Any dashboard, overview, summary, KPI strip, or landing screen inside the app |
| `references/rtl-rules.md` | Any screen that will be shown in Arabic (which is every screen); what mirrors, what does not, numbers, dates, mixed content |
| `references/data-viz-rules.md` | Any chart, sparkline, progress indicator, or data table |

## The ten priorities

Rank decisions by this order. A higher item never gives way to a lower one.

```text
1. Task effectiveness
2. Clarity
3. Decision usefulness
4. Operational speed
5. Information hierarchy
6. Data credibility
7. Error prevention
8. Accessibility (WCAG 2.2 AA)
9. Premium experience
10. Visual distinction
```

Visual distinction is last on purpose. It is earned through restraint, typography, density, and confident hierarchy, not through gradients, shadows, or oversized cards.

## Non-negotiables

- Arabic is first-class. Design the RTL layout at the same time as the LTR layout, never as a translation pass afterwards.
- Every chart answers a stated business question. If you cannot write the question, remove the chart.
- Every dashboard answers "what is happening, what changed, what needs attention, what is at risk, what decision is required, what next". A dashboard that only links elsewhere is a navigation page and must be redesigned.
- Every screen ships with empty, loading, and error states, and with validation on any input.
- Magenta (`#91195A`) is for brand, primary action, selected state, and important emphasis. Gold (`#F1BD19`) is for highlight, premium emphasis, milestones, and secondary selection. Success, warning, danger, and info use semantic colors, never brand colors.
- Use existing design tokens. Do not hard-code colors, spacing, radii, shadows, or type sizes when a token exists. If a token is missing, add it to the token file, then use it.
- Preserve business logic, data, routes, and backend integrations. Redesign the surface, not the system, unless the brief says otherwise.

## Generic AI UI: recognise and refuse

If a draft has any of these, fix it before showing it: card inside card, every KPI in its own giant card, repeating icon + title + number tiles, hero-sized headings on operational screens, large empty areas, random gradients, glassmorphism, excessive pills, excessive modals, hidden navigation, decorative charts, decorative animation, landing-page sections inside the app. The full list and the preferred alternatives are in `references/ux-principles.md`.

## Working method for a screen

1. Brief (six lines above).
2. Inventory: what data, actions, and states exist today; what components already exist.
3. Two or three conceptual layouts described in words (density, hierarchy, where actions live). Pick on usability, not on looks.
4. Implement with existing components and tokens, in both directions (LTR and RTL), with all states.
5. Self-check against `references/dashboard-rules.md`, `references/rtl-rules.md`, and `references/data-viz-rules.md`.
6. Hand off to `hni-artifact-judge`, then `hni-qa`. Do not skip to polish before the judge has run.

## Output expectations

When you present a design decision, state it in this shape so it can be reviewed:

```text
DECISION:   what you chose
WHY:        which priority or rule drove it
TRADE-OFF:  what you gave up
RTL:        how it behaves in Arabic
STATES:     empty / loading / error / validation handled how
```

Keep explanations short. The work should be visible in the interface, not in the commentary.
