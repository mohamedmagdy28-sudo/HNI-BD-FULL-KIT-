# HNI Data Visualization Rules

Never add a chart because data exists. Every chart answers a business question and supports a decision.

## The chain

Write this before building any visualization. If any link is missing, do not build the chart.

```text
QUESTION       what does the user need to know
DATA           which fields, over which period, at which grain
COMPARISON     against what: target, budget, prior period, other projects, baseline
VISUALIZATION  the one form that makes the comparison obvious
DECISION       what the user will do differently after seeing it
```

Put the question in the chart title. "GP% by project versus 35% target" is a title. "Gross Profit" is a label.

## Choosing the form

| Need | Use | Avoid |
|---|---|---|
| Trend over time | Line chart (one to four series) | Area stacks that hide the individual lines |
| Category comparison | Horizontal bar chart, sorted by value | Radar, 3D, donut for comparison |
| Progress toward a target | Progress bar or bullet chart with the target marked | Gauge, ring, speedometer |
| Composition | Stacked bar, only when composition is the question | Pie and donut, except a single two-part split |
| Distribution | Histogram or dot plot | Box plots for non-technical audiences |
| Schedule | Gantt or timeline | Calendar heat maps for schedules |
| Detailed operational analysis | Table with conditional indicators, sorting, filtering | Any chart |
| Variance (budget vs actual) | Variance table with signed deltas and indicators; optional bullet chart | Two side-by-side pies |
| Small trend inside a KPI | Sparkline (no axes, one series) | Full chart in a KPI tile |

Tables are often better than charts in operational applications. Default to the table when the user must read exact values, compare more than eight items, or act on a row.

## Rules for every chart

- One question per chart. Two questions means two charts or one table.
- Start bar and column axes at zero. Line charts may truncate but must label the axis.
- Sort categories by value unless the natural order (time, phase) matters.
- Label directly where possible; legends are a fallback.
- Show the comparison (target line, budget line, prior period) on the chart itself.
- Include the period and the "as of" date.
- Use the HNI chart color order: Magenta, Majorelle Blue, Summit Gold, Emerald Green, Dark Grey. Semantic colors only for semantic meaning (positive, negative, at risk).
- Baseline in Midway Grey, actual in Magenta, forecast in Magenta at 40% or dashed.
- Maximum four series on a line chart. More than four becomes a small-multiples grid or a table.
- No 3D, no gradients on data, no drop shadows, no decorative animation. Entrance animation of 200ms or none.
- Accessible: text alternative (a summary sentence or a data table toggle), color is never the only encoding, contrast 3:1 for marks, keyboard-reachable tooltips if tooltips carry needed data.

## KPI and delta formatting

- Tabular figures. Thousands separators per locale. Currency with SAR or ر.س.
- Deltas: sign, magnitude, unit, period ("+4.2 pts vs last month", "−SAR 120k vs budget").
- Large numbers: abbreviate above 1 million (SAR 2.4M) but keep the exact value in a tooltip or on hover.
- Percentages: one decimal for GP% and completion, none for attendance and counts.

## Tables as visualization

A table with conditional indicators is the preferred instrument for Level 2 and Level 3:

- Sticky header, 40 to 44px rows, right-aligned (end-aligned) numbers, start-aligned text.
- Conditional indicators: a small colored dot or a tinted badge in the status column, a signed delta with semantic color in the variance column. Do not color entire rows.
- Sort, filter, column picker, saved views. Totals row that reconciles with the KPI strip above it.
- Row actions in the last column or on hover; primary row click opens a drawer, not a new route.

## Misleading chart checklist

Reject the chart if any is true:

- Axis does not start at zero on a bar chart
- Two axes with different scales on one chart without clear labeling
- Cumulative and period values mixed
- Percent of a tiny base shown next to percent of a large base with no counts
- Category colors change between charts on the same screen
- Chart shows a trend the user cannot act on

## RTL

Time axes and legends mirror; see `rtl-rules.md`. Verify the today marker, tooltips, and bar labels in Arabic before shipping.
