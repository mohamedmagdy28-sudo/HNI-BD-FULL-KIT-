---
name: hni-qa
description: Systematic functional QA for completed HNI features and screens, run by actually exercising the interface (Playwright or a browser tool) rather than reading source. Covers four breakpoints, English LTR and Arabic RTL independently, console errors, links, buttons, drawers, dialogs, forms, validation, filters, sorting, search, pagination, charts, tables, tooltips, navigation, permissions, loading, error, and empty states, long text, large numbers, keyboard navigation, and WCAG 2.2 AA checks. Use whenever the user asks to test, QA, verify, regression-check, or "make sure it works", when a feature reaches Stage 7 of the HNI workflow, after fixes from hni-artifact-judge, and before any Definition of Done sign-off. Also use to set up or extend Playwright in the repository.
user-invocable: true
---

# HNI QA

Assume nothing works until you have seen it work. Source code tells you what was intended; only a running interface tells you what happens.

## Setup

1. Check whether Playwright exists (`package.json` devDependencies, `playwright.config.*`, `tests/` or `e2e/`). If it exists, use it and its existing conventions.
2. If it does not exist, check compatibility (framework, package manager, CI) and propose adding `@playwright/test` as a devDependency. Add it only if compatible; explain the maintenance cost in one line. Do not add other testing frameworks.
3. Confirm a running instance (dev server URL) or start one. Never test against production data. Never commit secrets or `.env` contents into tests.
4. Read `references/test-matrix.md` for the full checklist and `references/playwright-patterns.md` for reusable snippets (viewport matrix, RTL switching, console capture, axe integration, network throttling).

## The matrix

Every feature is tested across all of these. Passing one cell says nothing about the others.

```text
Breakpoints:  1440 desktop, 1280 laptop, 768 to 1024 tablet, 375 to 414 mobile
Directions:   English LTR, Arabic RTL (run the full checklist in each, separately)
States:       loading, empty, error, validation, long text, large numbers, permissions
```

## Checklist (summary; full detail in `references/test-matrix.md`)

Console errors and warnings, broken links, every button, drawers, dialogs, forms, validation, filters, sorting, search, pagination, charts, tables, tooltips, navigation, permissions, loading, errors, empty states, long text, large numbers, keyboard navigation, focus states, responsive layout, reduced motion, screen-reader labels.

## Critical workflow tests

Write Playwright tests for the critical workflows of the feature under test. The canonical HNI examples:

```text
Dashboard:  open dashboard → filter to a project → open an action → change status → save → verify the row and KPI update
Calendar:   open cohort calendar → switch cohort → edit a group date → save → verify the calendar and any conflict indicator
RTL:        switch English → Arabic → verify dir="rtl" and font → open navigation → open a drawer → inspect a table → verify alignment and column order
```

Each critical workflow gets one test per direction (LTR and RTL) and runs at desktop and mobile at minimum. Tests assert on visible outcomes (text, aria state, row content), not on implementation details.

## Method

1. Baseline: run the existing test suite first. Record failures that pre-date this feature so they are not attributed to it.
2. Exercise: walk the checklist manually via the browser tool or scripted Playwright, one direction at a time, one breakpoint at a time. Capture screenshots at each breakpoint in each direction.
3. Automate: turn the critical workflows into Playwright tests. Add an axe accessibility scan to each page-level test.
4. Report: use the format below. Every failure has reproduction steps, environment (breakpoint, direction, state), expected, actual, and a severity using the same scale as `hni-artifact-judge` (CRITICAL, HIGH, MEDIUM, LOW).
5. Re-test: after fixes, re-run only the failed items plus the full critical workflows, and say what was re-verified.

## Severity

- CRITICAL: workflow blocked, data loss or corruption, security or permission leak, uncaught exception, Arabic unusable.
- HIGH: workflow completes with a wrong result, broken layout at a required breakpoint, missing required state, keyboard trap, control unreachable.
- MEDIUM: incorrect but non-blocking behavior, inconsistency, console warning with user-visible effect.
- LOW: cosmetic, wording, non-visible console noise.

## Report format

Save to `docs/design-pilot/<screen>/QA-<date>.md` when inside a repository, and print the summary in chat.

```markdown
# HNI QA: <feature / screen>
Date, build/commit, environment (URL, browser, Playwright version)

## Summary
PASS <n>  FAIL <n>  BLOCKED <n>  |  CRITICAL <n>  HIGH <n>  MEDIUM <n>  LOW <n>
Verdict: <PASS | FAIL>   (FAIL if any CRITICAL or HIGH remains)

## Coverage
| Check | 1440 EN | 1440 AR | 1280 EN | 1280 AR | Tablet EN | Tablet AR | Mobile EN | Mobile AR |
|---|---|---|---|---|---|---|---|---|
| Console clean | | | | | | | | |
| … one row per checklist item … |

## Failures
### Q1. <title>  [SEVERITY]
Environment: <breakpoint, direction, state>
Steps: 1. … 2. …
Expected: 
Actual: 
Evidence: <screenshot path / console excerpt / test name>
Suggested fix: 

## Automated tests added
<file paths and test names>

## Pre-existing failures (not attributed to this feature)
<list>
```

## Definition of Done gate

QA passes only when: no CRITICAL, no HIGH (or each HIGH explicitly accepted by the owner in writing), all four breakpoints and both directions covered, all states exercised, critical workflow tests committed and green, no new console errors, existing suite still green.

## Do not

- Do not mark a check as passed because the code looks right.
- Do not test only in English and extrapolate to Arabic.
- Do not skip mobile because "internal users are on desktop"; clients and participants are not.
- Do not silence console errors to make a run green.
- Do not fix unrelated issues during QA; log them as pre-existing.
