# Failure Catalog

Work through every item. For each one, either record a finding with evidence or record "checked, not observed" with where you checked. Skipping an item is not allowed.

## A. Task and navigation

| # | Failure | How to detect |
|---|---|---|
| A1 | Confusing navigation | Try to reach the three most common destinations from this screen. More than one wrong turn, or a label that does not match the destination, is a finding. |
| A2 | Excessive clicks | Count clicks and route transitions for the primary job. Compare with the minimum reasonable path. Each avoidable transition is a finding. |
| A3 | Hidden functionality | List every action available on the screen. Any action only reachable via hover, right-click, an unlabeled icon, or a nested menu with no hint is a finding. |
| A4 | Dashboard as navigation | Measure the share of the viewport occupied by tiles whose only behavior is to navigate. Above roughly a third is HIGH. |
| A5 | Unnecessary modals | Any modal that could be a drawer, inline edit, or page section. Any modal stacked on a modal is HIGH. |
| A6 | Weak call-to-action hierarchy | More than one primary button in a region, or a primary action visually equal to secondary actions, or the primary action below the fold. |
| A7 | Dead ends | A state with no next action (detail with no edit, empty with no create, error with no retry). |

## B. Information and decisions

| # | Failure | How to detect |
|---|---|---|
| B1 | Redundant information | Same value shown more than once without a different comparison or context. Same status expressed as text, color, and icon that disagree. |
| B2 | Missing comparison | KPI without target, budget, prior period, or baseline. |
| B3 | Inconsistent terminology | Collect every noun for the same entity across the screen (cohort/group/batch, action/task/to-do, milestone/deliverable). More than one term is a finding. Check Arabic terms too. |
| B4 | Misleading charts | Bar axis not at zero, dual axes unlabeled, cumulative mixed with period, categories recolored between charts, chart with no question in its title, chart that should be a table. |
| B5 | Data credibility | Totals that do not reconcile with the KPI strip, missing "as of" date, currency without unit, percentages without base. |
| B6 | No exception surfacing | Overdue, blocked, unassigned, over budget, or conflicting items exist in the data but are not surfaced on the summary level. |

## C. Hierarchy and load

| # | Failure | How to detect |
|---|---|---|
| C1 | Weak hierarchy | Squint test: the most important element is not the first thing seen. Type sizes more than four steps, or two elements competing for primary emphasis. |
| C2 | Excessive visual noise | Count borders, shadows, colored fills, icons, and pills in one viewport. Card-inside-card, glassmorphism, gradients, and decorative animation each count. |
| C3 | Generic AI UI patterns | Every KPI in its own card; icon + title + number tiles repeated; hero headings; landing-page sections; excessive rounding; huge empty areas. |
| C4 | Brand overuse or misuse | Magenta or gold used for success, warning, or danger; brand color covering large areas; more than two accents on screen. |
| C5 | Density | Operational screen shows fewer than ten rows or items above the fold at 1440 without justification; or table rows taller than 48px. |

## D. States and errors

| # | Failure | How to detect |
|---|---|---|
| D1 | Poor empty state | Trigger the empty state. Missing, illustrated without explanation, no next action, or a celebratory tone on an operational screen. |
| D2 | Poor loading state | Throttle the network. Full-page spinner, layout shift when content arrives, or no indication at all. |
| D3 | Poor error handling | Force an error (offline, 500, invalid input). Silent failure, generic message, whole screen replaced, no retry, error text only in red with no text meaning. |
| D4 | Missing validation | Submit invalid or empty required fields. No inline message, message far from the field, or message only after submit with no field highlight. |
| D5 | Long text and large numbers | Insert a 120-character title, a long Arabic name, a 9-digit currency value. Overflow, truncation without tooltip, broken alignment, wrapped KPI. |
| D6 | Destructive without confirmation or undo | Delete or irreversible status change executes on one click. |

## E. Accessibility (WCAG 2.2 AA)

| # | Failure | How to detect |
|---|---|---|
| E1 | Inaccessible controls | Tab through the whole screen. Any control not reachable, any focus order that differs from visual order, any focus trap. |
| E2 | Missing focus indicator | Focus outline removed with no visible replacement (needs 3:1 contrast, 2px minimum). |
| E3 | Contrast | Measure text and control contrast. Body 4.5:1, large text and UI components 3:1. Check Midway Grey usage, badges, chart labels, placeholder text. |
| E4 | Labels and semantics | Icon buttons without accessible names, inputs without associated labels, tables without headers, headings out of order, status conveyed by color alone. |
| E5 | Touch targets | Anything below 24×24 CSS px (WCAG 2.5.8) is a finding; below 40px on mobile is HIGH for primary actions. |
| E6 | Reduced motion | Enable `prefers-reduced-motion`. Any non-essential animation still runs. |
| E7 | Chart accessibility | No text alternative or data table for charts; tooltips carry required data but are mouse-only. |

## F. Responsiveness

| # | Failure | How to detect |
|---|---|---|
| F1 | Broken layout at a breakpoint | Render at 1440, 1280, 1024, 768, 414, 375. Horizontal scroll, overlapping elements, clipped content, unreachable actions. |
| F2 | Mobile reflow | Tables with no mobile strategy (card list, priority columns, or horizontal scroll with pinned first column). KPI strip that stacks into a long column. |
| F3 | Drawer and modal on mobile | Drawer narrower than the viewport with content clipped, or modal not scrollable. |

## G. RTL / Arabic

| # | Failure | How to detect |
|---|---|---|
| G1 | Untested RTL | Switch to Arabic. If it cannot be switched, score RTL ≤ 4. |
| G2 | Physical CSS properties | Search source for `margin-left`, `padding-right`, `left:`, `text-align: left`, `ml-`, `pl-`, `left-`. Each in a component that should mirror is a finding. |
| G3 | Wrong icon mirroring | Direction icons (arrows, chevrons, send, undo) not mirrored; non-directional icons (search, settings) mirrored. |
| G4 | Numbers and mixed content | Broken parentheses around English in Arabic text, currency symbol on the wrong side, negative sign displaced, phone numbers reversed. |
| G5 | Tables, charts, Gantt | Column order, cell alignment, time-axis direction, legend position, today marker, tooltips not mirrored. |
| G6 | Hierarchy inequality | Arabic version shows different emphasis, missing elements, or truncation that English does not. |
| G7 | Typography | Arabic font not Tajawal or approved fallback, fake italics, letter-spacing, uppercase transform applied, line-height too tight. |
| G8 | Drawers, toasts, menus | Detail drawer not on the end edge, navigation drawer not on the start edge, toasts or menus anchored to the wrong side. |

## H. Consistency and system

| # | Failure | How to detect |
|---|---|---|
| H1 | Hard-coded values | Colors, spacing, radii, shadows, or type sizes in code where a token exists. |
| H2 | Duplicate components | A new button, badge, table, or drawer implemented when an equivalent exists in the repository. |
| H3 | Cross-module inconsistency | Same pattern (status badge, page header, filter bar, empty state) styled or behaving differently from another module. |
| H4 | Performance felt by the user | Interaction feedback slower than roughly 100ms, list of 200 rows that stutters, chart re-render on every keystroke. |
