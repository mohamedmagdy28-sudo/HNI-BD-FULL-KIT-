# HNI Brand Reference (product UI)

Source of truth: `Brand.md` in https://github.com/mohamedmagdy28-sudo/hni-design-system, together with the HNI Guidelines 2025 PDF in the same repository. Every value below must match that file exactly; if they ever disagree, `Brand.md` wins and this file must be updated. If the repository already defines tokens, use those names.

## Palette

| Token | Name | Hex | Product usage |
|---|---|---|---|
| `--hni-magenta` | Magenta Purple | `#91195A` | Primary. Brand, primary buttons, selected nav item, active tab, focus ring, key data series 1. Punctuates, never floods. |
| `--hni-gold` | Summit Gold | `#F1BD19` | Highlight. Milestones, premium markers, secondary selected indicators, data series 3. Small doses. |
| `--hni-black` | Rich Black | `#231F20` | Body text on light surfaces, dark section backgrounds |
| `--hni-grey-dark` | Dark Grey | `#393C3C` | Subheads, labels, secondary UI, data series 5 |
| `--hni-grey-mid` | Midway Grey | `#999999` | Captions, placeholders, dividers, disabled |
| `--hni-white` | Flat White | `#FFFFFF` | Surfaces |
| `--hni-violet` | Violet Blue | `#3A37C4` | Links, data series 2 |
| `--hni-majorelle` | Majorelle Blue | `#5B58E0` | Hover states, tertiary data series |
| `--hni-emerald` | Emerald Green | `#0C6E3A` | Positive deltas, success, data series 4 |
| `--hni-apple` | Dusty Apple Green | `#28A456` | Secondary positive series |

Recommended neutral scale for surfaces and borders (add as tokens if the repo lacks them):

```text
--surface-0: #FFFFFF     page and card surface
--surface-1: #F7F7F8     app background, table header, muted panels
--surface-2: #EFEFF1     hover rows, drawer backdrop panels
--border-1:  #E8E8EA     default border
--border-2:  #D6D6DA     emphasised border, input border
```

## Semantic status colors

Operational meaning must never be carried by brand colors. Use a semantic set and keep it consistent in every module:

```text
success: Emerald Green #0C6E3A   (text) / #E6F4EC (background)
warning: #B35C00                 (text) / #FFF4E5 (background)
danger:  #B3261E                 (text) / #FCEBEA (background)
info:    Violet Blue #3A37C4     (text) / #ECEBFB (background)
neutral: Dark Grey #393C3C       (text) / #F1F1F3 (background)
```

Status badges: small text, medium weight, tinted background, no icon required. Do not use red, amber, green as fills for large areas.

## Chart color order

Magenta, Majorelle Blue, Summit Gold, Emerald Green, Dark Grey. Never random palette colors. Baseline versus actual: baseline in Midway Grey, actual in Magenta. Forecast: Magenta at 40% opacity or dashed.

## Typography

- English: Myriad Pro for titles, in regular or bold weight only (never semibold files, never italic titles). Body text in Century Gothic or Myriad Pro, never bold or italic. Font files live in the design-system repository and are served from `public/brand/fonts/`.
- Arabic: Tajawal, available in 7 weights. IBM Plex Sans Arabic is the fallback. Never fake-italicise Arabic, never letter-space Arabic, never justify with stretched kashidas.
- Load both fonts; switch the font stack with the `dir`/`lang` attribute, not by duplicating components.
- Operational scale (desktop): page title 22 to 24px, section title 16 to 18px, body and table 13 to 14px, captions 12px. One display size per screen at most. Do not use hero sizes (40px+) inside the app.
- Numbers in KPIs: tabular figures (`font-variant-numeric: tabular-nums`) so columns align.

## Spacing, radius, elevation

```text
Spacing scale: 4, 8, 12, 16, 24, 32, 48 (px)
Radius: 6px controls, 8px buttons and inputs, 10 to 12px panels. Never pill-shaped containers.
Border: 1px --border-1 is the default separator. Prefer borders over shadows.
Shadow: only for floating layers (drawer, popover, menu): 0 2px 12px rgba(35,31,32,0.06)
```

Dense-but-readable is the target: table rows 40 to 44px, compact 36px. Operational screens should show more in one viewport than a marketing page would.

## Buttons and actions

- Primary: magenta fill, white text, 8px radius. One primary per view region.
- Secondary: white fill, `--border-2` border, dark text.
- Tertiary/ghost: text only, magenta or dark grey.
- Destructive: danger text, confirm before executing.
- Icon buttons need an accessible label. Minimum touch target 40px on tablet and mobile.

## Logo

- Use the white logo on magenta, dark, or colored backgrounds; the color logo only on white or light solid backgrounds. Never recolor, stretch, or crop it, and never add shadows, textures, or effects.
- Clear space: at least 1x the height of the logo on all sides (HNI Guidelines 2025, Logo Dimensions).
- Files in this repo: `public/brand/logo-primary.svg`, `logo-white.svg`, `logo-medium(-white).svg`, `icon.svg`, `icon-white.svg`, `favicon.svg`. Brand icon set in `public/brand/icons/`, arc and circle patterns in `public/brand/patterns/`.
- In the app shell the logo lives in the navigation, small. It does not appear on every screen.

## Photography

Real HNI people photography is a brand asset for covers, client reports, and program pages. Inside operational screens (dashboards, tables, trackers) do not use photography. Never use photos in negative contexts (risk, overdue, problem states).

## Contrast rules

- Body text on white: Rich Black or Dark Grey only. Midway Grey is for captions and disabled text and does not pass AA for body copy.
- Never magenta text on gold, gold text on white, or white text on gold.
- Check every status badge and every chart label against WCAG 2.2 AA (4.5:1 text, 3:1 large text and UI components).

## Never do

- Generic corporate blue or purple-gradient "AI startup" aesthetics
- More than two accent colors on one screen
- Emoji as icons
- Center-aligned body paragraphs
- Brand colors used to mean success or failure
- A magenta-and-gold poster: if the screen reads as branded before it reads as useful, reduce the brand color
