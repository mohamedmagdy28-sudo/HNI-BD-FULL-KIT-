# HNI RTL / Arabic Rules

Arabic is first-class. It is not a translated English interface. Design, build, and test RTL and LTR as two equal targets.

## Implementation foundations

- Set `dir="rtl"` and `lang="ar"` on the root element when Arabic is active. Switch the font stack to Tajawal (fallback IBM Plex Sans Arabic) via the `lang` attribute.
- Use CSS logical properties everywhere: `margin-inline-start`, `padding-inline-end`, `inset-inline-start`, `border-inline-start`, `text-align: start`. Never `margin-left` or `text-align: left` for layout that should mirror.
- Tailwind: use `ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`, `text-end`. Avoid `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-` unless the property must not mirror.
- Flex and grid mirror automatically under `dir="rtl"`. Absolute positioning does not; use logical insets.
- Do not maintain two component trees. One component, direction-aware.

## What mirrors

| Mirrors | Does not mirror |
|---|---|
| Layout flow, columns, sidebars, breadcrumbs order | Icons whose meaning is direction-independent (search, settings, user, calendar, warning) |
| Navigation direction (back / forward chevrons) | Logos and brand marks |
| Process and timeline flow (steps go right to left) | Media controls (play is still a right-pointing triangle) |
| Table column order and cell alignment | Clock and checkmark icons |
| Drawer side (detail drawers open from the end edge, navigation drawers from the start edge) | Numbers and their internal order |
| Pagination order | Charts' y-axis meaning (values still grow upward) |
| Progress bars fill direction | Phone numbers, codes, URLs (keep LTR, isolate with `dir="ltr"` or `unicode-bidi: isolate`) |
| Text alignment (start) | Photographs and faces |

Directional icons that must mirror: arrows, chevrons used for navigation, "send", "reply", undo/redo, indent/outdent, list bullets.

## Numbers, dates, currency

- Use Western Arabic numerals (1, 2, 3) in business interfaces unless the client requires Eastern Arabic numerals. Make it a locale setting, not a hard-coded choice.
- Currency: `SAR` in English, `ر.س` in Arabic, placed per locale convention. Keep the number and the symbol together with a non-breaking space.
- Dates: support Gregorian and Hijri where the module requires (Gantt, calendar, milestones). Show the calendar system explicitly when both are possible.
- Percentages and deltas keep their sign on the correct side of the number in both directions; isolate them with `unicode-bidi: isolate`.
- Tabular figures in both fonts so KPI columns align.

## Mixed Arabic and English content

- Product names, client names, codes, and emails often stay in English inside Arabic sentences. Wrap them with `<bdi>` or `unicode-bidi: isolate` so punctuation and parentheses do not jump.
- Long English strings in Arabic tables (emails, URLs) should truncate with an ellipsis at the end edge, not the start.

## Typography in Arabic

- Tajawal for product UI. Never fake-italic, never letter-space, never justify with stretched kashidas.
- Arabic glyphs sit lower and read smaller than Latin at the same size. Set Arabic body one step larger (for example 14px Latin, 15px Arabic) or use a font-size adjust so both feel equivalent.
- Line-height 1.6 for Arabic body.
- Do not uppercase Arabic (it has no case); do not apply `text-transform`.

## Components to check specifically

Alignment, icons, navigation, breadcrumbs, drawers, tables, charts, timelines, Gantt, date placement, form controls (labels, checkboxes, radio order), pagination, tooltips (position), toasts (slide from the end edge), dropdown menus (anchor to start), numbers, currency, mixed content, keyboard focus order (matches visual order), skeleton loaders (mirror).

## Charts and Gantt in RTL

- Time axes read right to left in Arabic. The Gantt today-marker and bars mirror accordingly.
- Legends sit at the start edge and list in reading order.
- Axis labels use logical alignment; y-axis stays on the start side.
- Tooltips anchor logically.

## Equivalent hierarchy

Arabic and English must present the same information hierarchy: same emphasis, same order of importance, same number of visible elements. A shorter or longer translation must not change what is prominent. If Arabic labels are longer, widen the column or wrap; do not truncate the Arabic and not the English.

## Copy

Arabic copy is formal business Arabic (فصحى). Never machine-translate silently; flag key terms for review. Keep terminology consistent across modules (one Arabic term for "cohort", one for "milestone", one for "action").

## Test both directions independently

Every QA pass (see `hni-qa`) runs the full checklist in Arabic RTL and again in English LTR. Passing one does not imply passing the other.
