# HNI Claude Code — Award-Winning Artifact Design & Skills Setup

## Mission

Upgrade the existing HNI artifact/application into a **world-class enterprise product** that is:

- Highly useful
- Visually distinctive
- Premium
- Intuitive
- Operationally efficient
- Data-driven
- Responsive
- Accessible
- Arabic RTL / English LTR ready
- Production-quality
- Consistent across all modules

The goal is **NOT** to make the application merely prettier.

The goal is to create an enterprise product that could compete with best-in-class SaaS platforms while maintaining HNI's own visual identity and operational requirements.

---

# 0. CRITICAL EXECUTION RULES

Before making any major changes:

1. Inspect the existing repository completely.
2. Read the existing `CLAUDE.md`, if present.
3. Identify the framework, dependencies, routes, components, design system, state management, database integrations, and deployment configuration.
4. Do NOT delete or rewrite working functionality unnecessarily.
5. Preserve existing business logic.
6. Preserve existing data.
7. Preserve Supabase/database integrations if present.
8. Preserve existing routes unless there is a strong architectural reason to change them.
9. Create a Git checkpoint/commit before major refactoring if Git is available.
10. Install only skills and dependencies that are genuinely useful.
11. Do not install hundreds of overlapping community skills.
12. Prefer official Anthropic skills when an official equivalent exists.
13. Review third-party skills before installing or executing them.
14. Never expose secrets, API keys, `.env` contents, credentials, or production data.
15. Never execute untrusted scripts blindly.
16. After every significant change, verify that existing functionality still works.

Do not start by redesigning the entire application.

First establish the **product design system, Claude operating rules, skills, evaluation framework, and QA process**.

---

# 1. INSPECT CURRENT PROJECT

Before installing or modifying anything, inspect:

```bash
pwd
find . -maxdepth 3 -type f | sort | head -300
```

Then inspect, when present:

```text
package.json
CLAUDE.md
README.md
vite.config.*
next.config.*
tsconfig.json
tailwind.config.*
src/
app/
components/
pages/
.claude/
supabase/
```

Determine:

- Framework
- React version
- TypeScript usage
- Tailwind usage
- shadcn/ui usage
- Routing architecture
- Component architecture
- State management
- Database/backend
- Authentication
- Existing design tokens
- Existing charts
- Existing testing framework
- Existing accessibility tooling
- Existing export functionality
- Existing RTL implementation

Create:

```text
docs/CURRENT-ARCHITECTURE.md
```

Document the findings before major restructuring.

---

# 2. INSTALL / CONFIGURE CORE CLAUDE SKILLS

## Priority 1 — Anthropic Frontend Design

Official source:

https://github.com/anthropics/skills/tree/main/skills/frontend-design

Purpose:

- Prevent generic AI-generated interfaces
- Improve typography
- Improve hierarchy
- Improve spacing
- Improve visual composition
- Improve interaction design
- Create distinctive visual identity
- Produce production-quality frontend work

Install/configure this skill for the project using the current supported Claude Code skill installation mechanism.

If manual project-level installation is required, use:

```text
.claude/skills/frontend-design/
```

Do not modify the official skill unnecessarily.

---

## Priority 2 — Anthropic Web Artifacts Builder

Official source:

https://github.com/anthropics/skills/tree/main/skills/web-artifacts-builder

Purpose:

- Complex React applications
- TypeScript
- Vite
- Tailwind
- shadcn/ui
- Multi-component artifacts
- Interactive dashboards
- State-heavy applications

Install/configure it if compatible with the existing architecture.

Do NOT migrate the entire project simply because this skill recommends a particular stack.

Existing production architecture takes precedence unless migration has a clear benefit.

---

## Priority 3 — Design Review

Source:

https://github.com/humbleteam/design-review

Purpose:

Create a structured UX/UI review process using principles such as:

- Nielsen usability heuristics
- Accessibility
- Discoverability
- Visual hierarchy
- Interaction consistency
- Error prevention
- Workflow efficiency
- Cognitive load

Before installing:

1. Inspect the repository.
2. Inspect the skill instructions.
3. Check for scripts or external commands.
4. Do not execute unknown scripts automatically.
5. Install only the relevant skill files.

---

## Priority 4 — Taste / Impeccable

Source:

https://github.com/tyfarrago-hub/taste

Use primarily:

```text
impeccable
```

Purpose:

- Final UI refinement
- Typography
- Spacing
- hierarchy
- interaction polish
- responsive refinement
- motion
- edge cases

This is a **polishing skill**, not the primary design authority.

Priority order must remain:

```text
HNI Product Requirements
        ↓
HNI Product Design System
        ↓
Anthropic Frontend Design
        ↓
Existing Component System
        ↓
Impeccable Polish
```

If instructions conflict, HNI-specific rules win.

---

# 3. CREATE HNI CUSTOM SKILLS

Create:

```text
.claude/
└── skills/
    ├── hni-product-design/
    │   ├── SKILL.md
    │   └── references/
    │       ├── brand.md
    │       ├── ux-principles.md
    │       ├── dashboard-rules.md
    │       ├── rtl-rules.md
    │       └── data-viz-rules.md
    │
    ├── hni-artifact-judge/
    │   └── SKILL.md
    │
    └── hni-qa/
        └── SKILL.md
```

---

# 4. CREATE `hni-product-design`

Create:

```text
.claude/skills/hni-product-design/SKILL.md
```

Use the following principles.

## HNI Product Design Philosophy

HNI applications are **enterprise operational applications**, not marketing websites.

The interface exists to help users:

1. Understand what is happening.
2. Identify what requires attention.
3. Make decisions.
4. Take action.
5. Track outcomes.
6. Produce credible evidence.
7. Communicate progress.

Never sacrifice usability for aesthetics.

---

# 5. PRIMARY USERS

Design for multiple user types.

## HNI Internal Team

Includes:

- Project managers
- L&D consultants
- Program managers
- Business team
- Operations
- Leadership

They need:

- Project control
- Scheduling
- Financial visibility
- Actions
- Risks
- Participant tracking
- Cohort tracking
- Deliverables
- Reporting

---

## Client HR / L&D

Includes:

- L&D Managers
- L&D Directors
- HR Leaders
- Talent Leaders

They need:

- Program status
- Evidence of impact
- Participant progress
- Risks
- Milestones
- Financial visibility where applicable
- Executive reporting

---

## Participants

Need:

- Clear journey
- Activities
- Assessments
- learning
- progress
- deadlines
- feedback
- coaching
- premium experience

---

## Trainers / Coaches

Need:

- Participants
- Sessions
- evaluations
- attendance
- feedback
- actions
- assignments

---

## Executives

Need:

- Exception-based reporting
- concise KPIs
- trend visibility
- risks
- impact
- financial performance
- decisions required

---

# 6. HNI UX PRIORITIES

Every design decision should prioritize:

```text
1. Task effectiveness
2. Clarity
3. Decision usefulness
4. Operational speed
5. Information hierarchy
6. Data credibility
7. Error prevention
8. Accessibility
9. Premium experience
10. Visual distinction
```

---

# 7. HNI VISUAL IDENTITY

Primary brand colors:

```text
HNI Magenta: #91195A
HNI Gold:    #F1BD19
```

Arabic font preference:

```text
Tajawal
```

Do not use HNI colors excessively.

Magenta should primarily communicate:

- Brand
- Primary action
- Selected state
- important emphasis

Gold should primarily communicate:

- Highlight
- premium emphasis
- selected secondary indicators
- special milestones

Operational colors such as success, warning, danger and information should have semantic meaning.

Do not turn the interface into a magenta-and-gold poster.

---

# 8. AVOID GENERIC AI UI

Avoid:

- Excessive cards
- Card-inside-card layouts
- Excessive rounded containers
- Giant headings
- Huge empty areas
- Random gradients
- Decorative charts
- Excessive shadows
- Every KPI having its own giant card
- Repetitive icon + title + number layouts
- Unnecessary glassmorphism
- Excessive pills
- Excessive modals
- Hidden navigation
- Dashboards that merely redirect users elsewhere
- Decorative animation without functional purpose
- Landing-page patterns inside operational screens

Prefer:

- Strong hierarchy
- Dense-but-readable layouts
- contextual actions
- inline editing
- drill-down
- drawers
- progressive disclosure
- meaningful tables
- meaningful visualizations
- saved filters
- search
- contextual navigation
- exception management
- action-oriented dashboards

---

# 9. DASHBOARD PHILOSOPHY

A dashboard must answer:

```text
What is happening?
What changed?
What requires attention?
What is at risk?
What decision is required?
What should I do next?
```

A dashboard should NOT primarily answer:

```text
Where can I click to go somewhere else?
```

Avoid dashboards that are simply collections of navigation cards.

Where possible, allow users to:

- inspect
- filter
- drill down
- update
- comment
- assign
- approve
- resolve

without unnecessary page transitions.

---

# 10. INFORMATION ARCHITECTURE

Use three levels.

## Level 1 — Executive Summary

Show:

- Health
- progress
- critical KPIs
- risks
- exceptions
- upcoming milestones
- decisions required

## Level 2 — Operational Analysis

Show:

- trends
- cohort comparisons
- timeline
- action status
- financial performance
- participant progress
- delivery status

## Level 3 — Detail

Show:

- records
- transactions
- participants
- sessions
- activities
- invoices
- actions
- comments
- history

Use progressive disclosure instead of displaying everything simultaneously.

---

# 11. RTL / ARABIC RULES

Arabic is first-class.

Do NOT treat Arabic as a translated English interface.

Test:

```text
Arabic RTL
English LTR
```

independently.

Check:

- Alignment
- icons
- navigation
- breadcrumbs
- drawers
- tables
- charts
- timelines
- Gantt
- date placement
- form controls
- pagination
- tooltips
- numbers
- currency
- mixed Arabic/English content

Do not mirror icons whose meaning should remain direction-independent.

Do mirror directional navigation where appropriate.

Arabic and English must maintain equivalent information hierarchy.

---

# 12. DATA VISUALIZATION RULES

Never add a chart merely because there is data.

Every chart must answer a business question.

Before adding a visualization determine:

```text
QUESTION
↓
DATA
↓
COMPARISON
↓
VISUALIZATION
↓
DECISION
```

Prefer:

### Trend over time

```text
Line chart
```

### Category comparison

```text
Bar chart
```

### Progress toward target

```text
Progress bar / bullet chart
```

### Composition

Use only when composition is genuinely important.

Avoid excessive pie/donut charts.

### Detailed operational analysis

Prefer:

```text
Table + conditional indicators + filtering
```

Tables are often better than charts for operational applications.

---

# 13. CREATE `hni-artifact-judge`

Create:

```text
.claude/skills/hni-artifact-judge/SKILL.md
```

This skill must evaluate completed interfaces objectively.

It must NOT automatically praise the interface.

Score the product using:

| Dimension | Weight |
|---|---:|
| Task effectiveness | 20% |
| Information architecture | 15% |
| Decision usefulness | 15% |
| Cognitive load | 10% |
| Visual hierarchy | 10% |
| Interaction quality | 10% |
| Accessibility | 5% |
| Responsiveness | 5% |
| RTL/LTR parity | 5% |
| Visual distinction | 5% |

Score each dimension:

```text
1–10
```

Anything below:

```text
8/10
```

requires investigation.

For every identified issue report:

```text
Problem
Evidence
User impact
Severity
Recommended fix
```

Severity:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

The judge must specifically search for:

- confusing navigation
- excessive clicks
- redundant information
- hidden functionality
- weak hierarchy
- misleading charts
- inconsistent terminology
- excessive visual noise
- poor empty states
- poor loading states
- poor error handling
- inaccessible controls
- broken mobile layouts
- weak RTL implementation
- unnecessary modals
- weak call-to-action hierarchy
- dashboard-as-navigation problems

---

# 14. CREATE `hni-qa`

Create:

```text
.claude/skills/hni-qa/SKILL.md
```

Purpose:

Systematically test completed features.

Test at minimum:

```text
Desktop: 1440px
Laptop: 1280px
Tablet
Mobile
```

Test:

```text
Arabic RTL
English LTR
```

Check:

- Console errors
- broken links
- buttons
- drawers
- dialogs
- forms
- validation
- filters
- sorting
- search
- pagination
- charts
- tables
- tooltips
- navigation
- permissions
- loading
- errors
- empty states
- long text
- large numbers
- keyboard navigation
- responsive layout

---

# 15. PLAYWRIGHT

Official:

https://playwright.dev/

Inspect whether Playwright already exists.

If not, determine whether adding it is appropriate.

Install only if compatible with the project.

Use Playwright for real interaction testing rather than assuming UI functionality from source code.

Create tests for critical workflows.

Examples:

```text
Open dashboard
→ Filter project
→ Open action
→ Change status
→ Save
→ Verify update
```

and:

```text
Open cohort calendar
→ Change cohort
→ Edit group date
→ Save
→ Verify calendar
```

and:

```text
Switch English → Arabic
→ verify RTL
→ open navigation
→ open drawer
→ inspect table
→ verify alignment
```

---

# 16. ACCESSIBILITY

Target:

```text
WCAG 2.2 AA
```

Review:

- contrast
- keyboard navigation
- focus states
- labels
- semantic HTML
- screen-reader meaning
- error messaging
- touch target size
- reduced motion
- chart accessibility

Never remove focus outlines without replacing them with an accessible focus indicator.

---

# 17. STORYBOOK — PHASE 2

Official:

https://storybook.js.org/

Do not install immediately unless reusable component complexity justifies it.

When the component library becomes sufficiently large, use Storybook for:

- Button
- Input
- Select
- KPI
- Status badge
- Filter
- Data table
- Drawer
- Dialog
- Timeline
- Empty state
- Error state
- Page header
- Navigation
- Charts

The objective is to prevent every module from inventing its own UI.

---

# 18. FIGMA MCP — FUTURE PHASE

Do not make Figma a dependency unless required.

When a formal HNI design system exists in Figma, investigate the official/current Figma MCP integration.

Use it to connect:

```text
Design tokens
Components
Design references
Implementation
```

Do not install random unofficial MCP servers without review.

---

# 19. CONTEXT7 — OPTIONAL

Investigate Context7 only if it materially improves access to current framework/library documentation.

Do not add MCP infrastructure merely because it is available.

The rule is:

```text
Useful > fashionable
```

---

# 20. CREATE / UPDATE ROOT `CLAUDE.md`

At the project root create or carefully update:

```text
CLAUDE.md
```

Do not destroy valuable existing instructions.

Merge the following concepts.

---

# PRODUCT

This repository contains an HNI enterprise operational platform.

The platform must help HNI and its clients manage complex Learning & Development programs.

The product is not a marketing website.

Optimize for operational work, decision-making and evidence of impact.

---

# DESIGN PRINCIPLES

Always prioritize:

```text
Clarity
Task completion
Decision usefulness
Operational efficiency
Consistency
Accessibility
Premium quality
Visual distinction
```

Never prioritize visual novelty over usability.

---

# DEVELOPMENT RULE

Before implementing a significant feature:

```text
UNDERSTAND
↓
DESIGN
↓
IMPLEMENT
↓
REVIEW
↓
TEST
↓
REFINE
```

Do not jump directly from request to code for complex functionality.

---

# COMPONENT RULE

Before creating a component:

1. Search for an existing equivalent.
2. Reuse if appropriate.
3. Extend if appropriate.
4. Create a new component only when necessary.

Avoid duplicate components.

---

# DESIGN TOKEN RULE

Do not hard-code arbitrary:

- colors
- spacing
- radii
- shadows
- typography

when an appropriate design token exists.

---

# UX RULE

For every feature identify:

```text
USER
JOB TO BE DONE
INFORMATION REQUIRED
DECISION
ACTION
SUCCESS STATE
```

If these are unclear, investigate before implementing.

---

# 21. DEFINITION OF DONE

No feature is complete merely because it compiles.

A feature is complete only when applicable checks pass:

```text
[ ] Functional requirement works
[ ] Existing functionality still works
[ ] Desktop tested
[ ] Laptop tested
[ ] Tablet tested
[ ] Mobile tested
[ ] Arabic RTL tested
[ ] English LTR tested
[ ] Empty state exists
[ ] Loading state exists
[ ] Error state exists
[ ] Validation exists
[ ] Keyboard navigation checked
[ ] Focus states checked
[ ] No relevant console errors
[ ] Design tokens respected
[ ] Existing components reused where appropriate
[ ] Information hierarchy reviewed
[ ] User can identify next action
[ ] HNI Artifact Judge completed
[ ] Critical issues = 0
[ ] High issues = 0 or explicitly accepted
[ ] Overall UX score >= 8/10
```

---

# 22. FEATURE DEVELOPMENT WORKFLOW

For every significant feature use the following workflow.

## Stage 1 — Product Definition

Do NOT code yet.

Determine:

```text
User
Problem
Job-to-be-done
Current friction
Required information
Required decisions
Required actions
Success criteria
Edge cases
```

---

## Stage 2 — Information Architecture

Determine:

```text
What belongs on page?
What belongs inline?
What belongs in drawer?
What belongs in modal?
What requires another route?
```

Avoid unnecessary navigation.

---

## Stage 3 — UX Design

Apply:

```text
hni-product-design
+
frontend-design
```

For major interfaces, consider multiple conceptual approaches before implementation.

Select the best based on usability, not appearance alone.

---

## Stage 4 — Implementation

Implement using:

- existing design system
- existing components
- React architecture
- TypeScript
- existing backend
- existing state architecture

Do not create unnecessary dependencies.

---

## Stage 5 — Visual Polish

Use the polishing skill only after core UX is correct.

Check:

- typography
- spacing
- density
- hierarchy
- alignment
- motion
- responsiveness

---

## Stage 6 — Artifact Judge

Run:

```text
hni-artifact-judge
```

Do not modify immediately.

First produce the evaluation.

Prioritize:

```text
CRITICAL
HIGH
MEDIUM
LOW
```

---

## Stage 7 — Functional QA

Run:

```text
hni-qa
```

and Playwright where appropriate.

---

## Stage 8 — Refinement

Fix:

```text
CRITICAL
HIGH
```

Then re-test.

Do not introduce unrelated features during refinement.

---

# 23. HNI PRODUCT ARCHITECTURE PRINCIPLE

The long-term experience should feel like **one operating platform**, not a collection of disconnected tools.

Target conceptual structure:

```text
HNI OPERATING PLATFORM
│
├── Command Center
│
├── Projects
│   ├── Overview
│   ├── Timeline
│   ├── Cohorts
│   ├── Participants
│   ├── Actions
│   ├── Risks
│   ├── Deliverables
│   ├── Financials
│   └── Impact
│
├── Clients
│
├── Programs
│
├── Resources
│
├── Analytics
│
└── Administration
```

Do not implement this structure blindly.

Compare it with the existing architecture first.

---

# 24. COMMAND CENTER PRINCIPLE

The future Command Center should aggregate meaningful information from modules.

Potential information:

```text
Portfolio Health
Revenue / GP
Project Risk
Upcoming Milestones
Overdue Actions
Cohort Status
Participant Progress
Invoices
Resource Conflicts
Client Decisions Required
```

Users should be able to take common actions directly from the Command Center where safe and appropriate.

---

# 25. GLOBAL INTERACTION PATTERNS

Investigate introducing consistent patterns for:

### Global Search

Search across:

- Projects
- Clients
- Participants
- Actions
- Programs

### Command Palette

Potential shortcut:

```text
CMD / CTRL + K
```

Potential actions:

```text
Create project
Add action
Find participant
Open project
Add cohort
Export report
```

Only implement if it materially improves usability.

---

# 26. ACTION TRACKER PRINCIPLE

Action tracking should eventually support:

```text
Action
Project
Owner
Due date
Status
Priority
Source
Created by
Created date
Updated date
Comments
Attachments
Dependencies
Overdue state
```

Useful views:

```text
My Actions
All Actions
Overdue
Due Soon
Completed
By Project
By Owner
```

Do not overload the default view.

---

# 27. PROJECT TIMELINE / GANTT PRINCIPLE

The Gantt should eventually support:

- Phases
- Activities
- milestones
- dependencies
- cohort schedules
- parallel groups
- baseline
- actual
- pinned milestones
- filters
- zoom
- Arabic
- English
- Hijri
- Gregorian
- exports

Complexity must be progressively disclosed.

Do not display every control permanently.

---

# 28. P&L PRINCIPLE

The P&L dashboard should help answer:

```text
Are we profitable?
Are we on budget?
Where is variance coming from?
What changed?
What requires intervention?
What is forecast?
```

Prioritize:

```text
Revenue
Cost
Gross Profit
GP %
Budget
Actual
Forecast
Variance
```

Then allow drill-down.

Avoid decorative financial dashboards.

---

# 29. CALENDAR PRINCIPLE

Calendar functionality must support:

- Cohorts
- Groups
- Parallel groups
- Sessions
- milestones
- trainers
- venues
- conflicts

The user must be able to understand schedule conflicts visually.

Editing dates should be simple and safe.

---

# 30. PRODUCT QUALITY TARGET

Target experience:

```text
Enterprise credibility
+
Consumer-level usability
+
HNI identity
+
Operational intelligence
```

Do not copy another SaaS product visually.

Learn from:

- Linear
- Notion
- Stripe
- Ramp
- Monday
- Asana
- Airtable
- Salesforce
- modern ERP systems

but create an HNI-specific experience.

---

# 31. FIRST PILOT

Do NOT redesign the entire platform initially.

Select ONE high-value existing screen.

Recommended priority:

```text
1. Project Command Center / Dashboard
OR
2. P&L Dashboard
```

Create:

```text
docs/design-pilot/
```

Document:

```text
BEFORE
CURRENT PROBLEMS
USER JOBS
PROPOSED UX
IMPLEMENTATION
ARTIFACT JUDGE SCORE
QA RESULTS
AFTER
LESSONS
```

Use the pilot to establish the design language before applying it globally.

---

# 32. INITIAL EXECUTION PLAN

Execute in this order:

```text
STEP 1
Inspect repository

STEP 2
Create CURRENT-ARCHITECTURE.md

STEP 3
Audit existing Claude configuration

STEP 4
Install/configure approved official Anthropic skills

STEP 5
Review third-party skills before installation

STEP 6
Create hni-product-design

STEP 7
Create hni-artifact-judge

STEP 8
Create hni-qa

STEP 9
Update CLAUDE.md

STEP 10
Audit existing design system

STEP 11
Create HNI design tokens if missing

STEP 12
Audit component duplication

STEP 13
Identify pilot screen

STEP 14
Run UX audit on pilot screen

STEP 15
Propose redesign

STEP 16
Implement

STEP 17
Run Artifact Judge

STEP 18
Run Playwright / QA

STEP 19
Fix Critical + High issues

STEP 20
Document lessons before expanding
```

---

# 33. IMPORTANT — DO NOT OVER-ENGINEER

Do NOT automatically introduce:

- Storybook
- Figma
- new state-management libraries
- new chart libraries
- new UI frameworks
- new databases
- microservices
- unnecessary MCP servers

First determine whether the existing project needs them.

Every new dependency must answer:

```text
What problem does this solve?
Why can't the current stack solve it?
What maintenance cost does it introduce?
```

---

# 34. SECURITY RULE FOR THIRD-PARTY SKILLS

Before using any community Claude skill:

```text
1. Inspect source.
2. Read SKILL.md.
3. Inspect scripts.
4. Inspect commands.
5. Check external network behavior.
6. Check filesystem behavior.
7. Check package installation.
8. Never expose secrets.
9. Never expose .env.
10. Never execute destructive commands blindly.
```

Official skills are preferred where equivalent functionality exists.

---

# 35. REPORT BACK BEFORE LARGE-SCALE REDESIGN

After completing the setup and audit, STOP before redesigning the entire application.

Report:

| Item | Result |
|---|---|
| Current architecture | |
| Claude configuration | |
| Skills installed | |
| Skills rejected | |
| Custom HNI skills created | |
| Testing setup | |
| Design system status | |
| Component system status | |
| RTL maturity | |
| Accessibility maturity | |
| Major UX problems | |
| Technical debt | |
| Recommended pilot screen | |
| Recommended next action | |

Also provide:

```text
CURRENT UX SCORE: X/10

TARGET UX SCORE: 9+/10
```

Explain the five highest-impact improvements.

Then begin the selected pilot unless a critical architecture or data-safety issue requires confirmation.

---

# 36. FINAL OPERATING MODEL

From this point forward use:

```text
                 HNI PRODUCT RULES
                        │
                        ▼
                  PRODUCT THINKING
                        │
              ┌─────────┴─────────┐
              ▼                   ▼
       UX ARCHITECTURE       FRONTEND DESIGN
              │                   │
              └─────────┬─────────┘
                        ▼
                 IMPLEMENTATION
                        │
                        ▼
                  HNI ARTIFACT
                     JUDGE
                        │
                        ▼
                 PLAYWRIGHT QA
                        │
                        ▼
                 ACCESSIBILITY
                        │
                        ▼
                    REFINE
                        │
                        ▼
                  PRODUCTION
```

Every major feature should move through this system.

---

# 37. START NOW

Begin with:

```text
1. Repository inspection
2. Architecture assessment
3. Claude configuration assessment
4. Skills setup
5. HNI custom skills creation
6. CLAUDE.md update
7. QA setup
8. Design-system audit
```

Do not ask for permission between ordinary safe setup steps.

Do not redesign the entire application yet.

When setup is complete, identify the best existing screen for the first **award-quality design pilot**, explain why it was selected, establish its baseline score, and begin the product-definition and UX-design stages.

The objective is not merely to make HNI's artifact look better.

The objective is to establish a **repeatable AI-powered product development system** that makes every future HNI artifact more useful, more consistent, more distinctive, and more production-ready.
