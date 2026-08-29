# CLAUDE.md
## Product

TODO: describe this application before building anything.

```text
Who uses it:
What problem it solves:
Core entities and data:
What "good" looks like for its users:
```

This is an HNI (Human Network International) application. It is not a marketing website. Optimize for operational work, decision-making, and credible evidence. Arabic RTL and English LTR are equal, first-class targets.

## Design principles

Always prioritize, in this order: clarity, task completion, decision usefulness, operational efficiency, consistency, accessibility (WCAG 2.2 AA), premium quality, visual distinction. Never prioritize visual novelty over usability.

## Skills and precedence

Project skills live in `.claude/skills/`. When guidance conflicts, resolve top-down and say which rule won:

```text
1. HNI product requirements (feature brief, existing business logic, data, routes, backend)
2. hni-product-design        (design authority: brand, UX principles, dashboards, RTL, data viz)
3. frontend-design           (official Anthropic; craft and anti-generic guidance)
4. Existing component system in this repository
5. impeccable-polish         (final refinement only)
```

Evaluation skills: `hni-artifact-judge` (scorecard, findings, verdict), `hni-qa` (functional, responsive, RTL, accessibility testing), `design-review` (fast heuristic critique with citations). `web-artifacts-builder` is available for standalone React/Vite/Tailwind/shadcn artifacts; do not migrate this repository to its stack unless there is a clear benefit.

## Development rule

Before implementing a significant feature: UNDERSTAND → DESIGN → IMPLEMENT → REVIEW → TEST → REFINE. Do not jump from request to code for complex functionality.

## UX rule

For every feature, write the brief first:

```text
USER / JOB TO BE DONE / INFORMATION REQUIRED / DECISION / ACTION / SUCCESS STATE
```

If any of these is unclear, investigate before implementing.

## Component rule

Before creating a component: search for an existing equivalent, reuse it, extend it, and only then create. No duplicate buttons, badges, tables, drawers, page headers, empty states.

## Design token rule

Do not hard-code colors, spacing, radii, shadows, or typography when a token exists. If a token is missing, add it to the token file first. Brand tokens: Magenta `#91195A` (primary, selection, emphasis), Gold `#F1BD19` (highlight, milestones), plus the full palette in `.claude/skills/hni-product-design/references/brand.md`. Arabic font: Tajawal.

## Safety rules

- Inspect before changing. Do not delete or rewrite working functionality unnecessarily.
- Preserve business logic, data, routes, Supabase/database integrations, and deployment configuration.
- Create a Git commit or checkpoint before major refactoring.
- Never expose secrets, API keys, `.env` contents, credentials, or production data. Never commit them into tests or docs.
- Never execute untrusted scripts blindly. Review third-party skills before use (see `docs/SKILLS-SETUP.md`).
- After every significant change, verify existing functionality still works.
- Do not introduce Storybook, Figma dependencies, new state-management or chart libraries, new UI frameworks, new databases, or new MCP servers without first answering: what problem does it solve, why can't the current stack solve it, what maintenance cost does it add.

## Feature workflow

1. Product definition (no code): user, problem, job, friction, information, decisions, actions, success criteria, edge cases
2. Information architecture: page / inline / drawer / modal / route
3. UX design: `hni-product-design` + `frontend-design`; consider two or three concepts, choose on usability
4. Implementation: existing design system, components, React, TypeScript, existing backend and state
5. Visual polish: `impeccable-polish`, only after core UX is correct
6. Artifact judge: `hni-artifact-judge`; produce the evaluation before changing anything
7. Functional QA: `hni-qa` and Playwright
8. Refinement: fix CRITICAL and HIGH, re-test; no unrelated features during refinement

## Definition of Done

A feature is complete only when every applicable item passes:

```text
[ ] Functional requirement works
[ ] Existing functionality still works
[ ] Desktop 1440, laptop 1280, tablet, mobile tested
[ ] Arabic RTL tested        [ ] English LTR tested
[ ] Empty, loading, error states exist   [ ] Validation exists
[ ] Keyboard navigation and focus states checked
[ ] No relevant console errors
[ ] Design tokens respected  [ ] Existing components reused
[ ] Information hierarchy reviewed; user can identify the next action
[ ] hni-artifact-judge completed: CRITICAL = 0, HIGH = 0 or explicitly accepted, weighted score ≥ 8/10
[ ] hni-qa report saved
```

## Documentation locations

```text
docs/CURRENT-ARCHITECTURE.md      repository inspection findings (create before restructuring)
docs/SKILLS-SETUP.md              which skills are installed, rejected, and why
docs/design-pilot/<screen>/       BEFORE, CURRENT PROBLEMS, USER JOBS, PROPOSED UX, IMPLEMENTATION, ARTIFACT JUDGE, QA, AFTER, LESSONS
docs/HNI-SETUP-BRIEF.md           the full setup brief this configuration implements
```

## Writing style

No em dashes in any generated content, copy, or documentation; use commas, periods, or colons. Direct, expert tone. No filler.

## Repository specifics

```text
Stack:        Vite 8 + React 19 + TypeScript 6 + Tailwind 3.4 + shadcn/ui (Radix) + lucide-react
Package mgr:  npm
Dev server:   npm run dev            (http://localhost:5173)
Build:        npm run build          (tsc -b && vite build; must pass before any commit)
Lint:         npm run lint           (oxlint)
E2E:          npm run test:e2e:install once, then npm run test:e2e   (Playwright, 4 viewports x EN/AR)
State:        React state only. No global store yet; add one only with the three-question justification.
Backend:      none yet. .env.example lists the expected variables.
i18n:         src/lib/i18n.tsx. One dictionary, EN and AR, shell strings only so far. Language persists in localStorage key "hni.lang". Document dir/lang switch automatically. Add feature strings under a short namespace per screen.
Tokens:       src/index.css (CSS variables) and tailwind.config.js (hni.*, surface.*, line.* colors). Use these, never raw hex in components.
Routing:      none yet. Navigation items are placeholders. Add a router only when a second screen exists.
Direction:    use Tailwind logical utilities only (ms-, me-, ps-, pe-, start-, end-, text-start, text-end, border-s, border-e, rounded-s, rounded-e).
```

Screens: none yet. `src/App.tsx` renders the shell with a placeholder screen; build the first real screen under `src/features/<screen>/` and swap it in. Shared UI lives in `src/components/app/`; shadcn primitives in `src/components/ui/` (do not edit primitives, wrap them).

## GBrain Configuration (configured by /setup-gbrain)
- Mode: local-stdio
- Engine: pglite
- Config file: ~/.gbrain/config.json (mode 0600)
- Setup date: 2026-08-29
- MCP registered: yes (user scope)
- Artifacts sync: off
- Current repo policy: read-write

## GBrain Search Guidance (configured by /sync-gbrain)
<!-- gstack-gbrain-search-guidance:start -->

GBrain is set up and synced on this machine. The agent should prefer gbrain
over Grep when the question is semantic or when you don't know the exact
identifier yet. Two indexed corpora available via the `gbrain` CLI:
- This repo's code (registered as `gstack-code-<repo>` source).
- `~/.gstack/` curated memory (registered as `gstack-brain-<user>` source via
  the existing federation pipeline).

Prefer gbrain when:
- "Where is X handled?" / semantic intent, no exact string yet:
    `gbrain search "<terms>"` or `gbrain query "<question>"`
- "Where is symbol Y defined?" / symbol-based code questions:
    `gbrain code-def <symbol>` or `gbrain code-refs <symbol>`
- "What calls Y?" / "What does Y depend on?":
    `gbrain code-callers <symbol>` / `gbrain code-callees <symbol>`
- "What did we decide last time?" / past plans, retros, learnings:
    `gbrain search "<terms>" --source gstack-brain-<user>`

Grep is still right for known exact strings, regex, multiline patterns, and
file globs. The brain auto-syncs incrementally on every gstack skill start.
Run `/sync-gbrain` to force-refresh, `/sync-gbrain --full` for full reindex.

<!-- gstack-gbrain-search-guidance:end -->
