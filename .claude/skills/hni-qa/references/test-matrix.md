# QA Test Matrix

Run each check at every breakpoint and in each direction. Record PASS, FAIL (with Q-id), or N/A with the reason.

## 1. Environment integrity

| Check | Pass criteria |
|---|---|
| Console errors | Zero uncaught errors during load and during every interaction in the checklist |
| Console warnings | No React key warnings, no hydration mismatches, no deprecated API warnings introduced by this feature |
| Network | No failed requests (4xx/5xx) other than intentionally tested error cases; no requests leaking secrets in URLs |
| Broken links | Every `<a>` and router link resolves; no 404 routes; external links open safely |

## 2. Controls

| Check | Pass criteria |
|---|---|
| Buttons | Every button does something visible or is disabled with a reason; disabled state is announced; loading state prevents double submit |
| Drawers | Detail drawers open from the end edge (right in LTR, left in RTL), navigation drawers from the start edge, trap focus, close on Escape and on backdrop click where safe, return focus to the trigger, scroll internally on mobile |
| Dialogs | Same as drawers; primary action last in tab order; destructive dialogs require explicit confirm |
| Tooltips | Appear on hover and on keyboard focus; positioned inside the viewport; mirrored in RTL; never carry data that is not available elsewhere |
| Dropdowns and menus | Keyboard navigable (arrows, Enter, Escape), anchored to the logical start side, close on outside click |

## 3. Forms

| Check | Pass criteria |
|---|---|
| Labels | Every input has a visible label associated programmatically; placeholders are not labels |
| Validation | Inline, adjacent to the field, on blur or submit; message states what to do; field gets `aria-invalid` and `aria-describedby` |
| Required fields | Marked; submit blocked with a summary of errors and focus moved to the first error |
| Save and cancel | Save gives feedback (toast or inline) within the same view; cancel restores state; unsaved-changes guard on navigation |
| Date inputs | Gregorian and Hijri where applicable; locale-correct format; keyboard entry possible |
| Numeric inputs | Thousands separators, currency unit, negative handling, paste handling |

## 4. Data views

| Check | Pass criteria |
|---|---|
| Filters | Apply, combine, clear, persist across pagination; URL or saved-view reflects state; result count shown |
| Sorting | Every sortable column sorts both directions; indicator visible; numeric and date columns sort numerically |
| Search | Debounced; matches across expected fields; empty-result state; clears cleanly |
| Pagination | Correct counts; keyboard accessible; mirrored order in RTL; page size change resets to page 1 |
| Tables | Sticky header; end-aligned numbers; row actions reachable by keyboard; mobile strategy exists (card list or pinned column with horizontal scroll) |
| Charts | Render with data, with one data point, with zero data; tooltips reachable; text alternative or table toggle; colors follow HNI order; axes labeled; RTL mirrored |
| Totals | Totals row reconciles with the KPI strip and with filtered results |

## 5. Navigation and permissions

| Check | Pass criteria |
|---|---|
| Primary navigation | Reachable, current item indicated, works at mobile (no hidden nav without a visible trigger) |
| Breadcrumbs | Correct trail, mirrored in RTL, each level clickable |
| Deep links | Direct URL to a drawer or tab restores that state |
| Permissions | Each role sees only what it should; hidden actions are also blocked server-side (verify with a direct request where possible); no client-side-only gating for sensitive data |

## 6. States

| Check | How to trigger | Pass criteria |
|---|---|---|
| Loading | Throttle network to slow 3G | Skeletons in place; no layout shift; actions disabled during load |
| Empty | Filter to no results; new account; empty module | Explains why; offers the relevant next action; no celebratory illustration on operational screens |
| Error | Block the API route; return 500; go offline | Specific message; retry; rest of the page still usable; no white screen |
| Validation | Submit invalid data | See Forms |
| Long text | 120-character English title; 80-character Arabic name; long email | No overflow; truncation with tooltip or wrap; alignment intact |
| Large numbers | 9-digit SAR value; 100% and 0%; negative variance | No wrapping in KPI; separators correct; sign correct in RTL |
| Stale data | Simulate old timestamp | "As of" shown |

## 7. Accessibility (WCAG 2.2 AA)

| Check | Pass criteria |
|---|---|
| Keyboard | Every interactive element reachable and operable by keyboard; order matches visual order; no trap |
| Focus | Visible indicator, 2px minimum, 3:1 contrast; not removed |
| Contrast | Text 4.5:1; large text and UI components 3:1; verify badges, chart labels, placeholder text, disabled text (disabled is exempt but must be recognisable) |
| Names and roles | Icon buttons named; landmarks present; headings in order; tables with `<th>`; live regions for toasts |
| Touch targets | 24×24 CSS px minimum everywhere; 40px for primary actions on mobile |
| Reduced motion | With `prefers-reduced-motion: reduce`, no non-essential animation |
| Zoom | 200% browser zoom: no loss of content or function |
| Screen reader | Spot-check the primary job with VoiceOver or NVDA: status changes announced, drawer announced |
| Automated scan | axe-core reports zero serious or critical violations |

## 8. Responsive

| Breakpoint | Pass criteria |
|---|---|
| 1440 | Reference layout |
| 1280 | No horizontal scroll; KPI strip intact; sidebars and tables still readable |
| 1024 / 768 | Navigation collapses correctly; drawers full-height; tables adopt their tablet strategy |
| 414 / 375 | Single column; KPI strip 2-column; tables adopt mobile strategy; primary action reachable; no element clipped |

## 9. RTL (run the entire matrix above in Arabic, then add these)

| Check | Pass criteria |
|---|---|
| Root | `dir="rtl"`, `lang="ar"`, Tajawal or approved fallback applied |
| Layout | Sidebar, breadcrumbs, page header actions, KPI strip order, table columns mirrored |
| Icons | Directional icons mirrored; non-directional icons not mirrored |
| Text | Start-aligned; no letter-spacing, no fake italics, no uppercase transform |
| Numbers | Currency symbol placement; negative sign; percentages; phone and codes isolated LTR |
| Mixed content | English terms inside Arabic sentences keep correct punctuation order |
| Components | Detail drawers from the end edge, navigation drawer from the start edge; toasts from the end edge; menus anchored to start; tooltips mirrored |
| Charts and Gantt | Time axis right to left; legend at start; today marker correct; tooltips correct |
| Hierarchy parity | Same elements visible, same emphasis, no Arabic-only truncation |
| Physical CSS | Grep for `margin-left|margin-right|padding-left|padding-right|left:|right:|text-align: left|text-align: right|\bml-|\bmr-|\bpl-|\bpr-|\bleft-|\bright-` in changed files; each hit justified or replaced with a logical property |
