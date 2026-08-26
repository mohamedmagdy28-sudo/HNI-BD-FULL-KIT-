---
name: impeccable-polish
description: Final visual refinement pass for an HNI interface whose core UX has already passed hni-artifact-judge. Use when the user asks to polish, refine, tighten, align, typeset, improve spacing, improve typography, improve motion, or make a screen feel more finished, and only after the judge verdict is SHIP or the remaining findings are LOW. Covers typography, spacing, layout, alignment, density, color and contrast, interaction feel, motion, responsive refinement, UX copy, and edge cases. Not a design authority: hni-product-design and frontend-design outrank it.
user-invocable: true
---

# Impeccable Polish (HNI adaptation)

This is a polishing skill, not the primary design authority. It refines surfaces that already work. The reference documents are vendored from the `impeccable` skill in the `taste` collection (MIT, see `LICENSE-taste`), which in turn builds on Anthropic's `frontend-design` skill. The upstream scripts, live-browser mode, and PRODUCT.md gates are intentionally not included; HNI's product context lives in `hni-product-design`.

## When to run

Only after:

1. `hni-product-design` brief and information architecture are settled
2. Implementation is complete with all states in both directions
3. `hni-artifact-judge` has run and no CRITICAL or HIGH findings remain

Polishing before those steps hides structural problems under good typography.

## Precedence

```text
HNI product requirements
  > hni-product-design (and its references/brand.md)
    > frontend-design
      > existing component system
        > this skill
```

If a reference here suggests something that conflicts with HNI rules (for example a bolder palette, larger type, more motion, glass effects), the HNI rule wins. Do not introduce new dependencies, fonts other than Inter and Tajawal, or new tokens without adding them to the token file.

## Pass order

Work through these in order; each reference is short. Load only the ones the screen needs.

| Pass | Reference | Focus |
|---|---|---|
| 1 | `references/typography.md`, `references/typeset.md` | Scale discipline, line length, weights, tabular numbers, Arabic sizing parity |
| 2 | `references/spatial-design.md`, `references/layout.md` | Spacing rhythm on the 4/8 scale, alignment, grid, density |
| 3 | `references/color-and-contrast.md` | Restraint with magenta and gold, semantic colors, AA contrast |
| 4 | `references/interaction-design.md` | Hover, active, focus, disabled, loading feedback |
| 5 | `references/motion-design.md` | 150 to 250ms functional motion only; reduced-motion respected |
| 6 | `references/responsive-design.md` | Breakpoint refinement at 1440, 1280, tablet, mobile |
| 7 | `references/ux-writing.md` | Labels, empty and error copy, terminology consistency (English and Arabic) |
| 8 | `references/cognitive-load.md`, `references/polish.md` | Final noise reduction and edge cases (long text, large numbers, zero states) |

## Output

List every change as a one-line diff description grouped by pass. Then re-run `hni-qa` on the affected breakpoints and directions. Polish must not change behavior, data, routes, or the judge's task-effectiveness score; if it does, revert.
