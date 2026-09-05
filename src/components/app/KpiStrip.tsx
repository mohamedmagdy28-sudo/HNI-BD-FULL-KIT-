import { cn } from "@/lib/utils";

export type Kpi = {
  id: string;
  label: string;
  value: string;
  /** Signed delta already formatted, e.g. "+2.1 pts" */
  delta?: string;
  /** Which way is good: positive delta is good unless inverted (e.g. overdue actions) */
  invert?: boolean;
  deltaSign?: 1 | -1 | 0;
  comparison: string;
  /** Optional plain-language explainer shown as a label tooltip (judge J5). */
  hint?: string;
  /** When present the tile becomes a filter toggle for the list below it. */
  onToggle?: () => void;
  active?: boolean;
  /** Screen-reader description of what toggling does. Required when onToggle is set. */
  actionLabel?: string;
};

/**
 * One strip, no individual cards. Label, value, delta, comparison.
 * Values are bidi-isolated so signs and units keep their position in Arabic.
 */
// Wide-breakpoint column count follows the tile count so a short strip has no dead cells.
const LG_COLS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-5",
};

export function KpiStrip({ items, label }: { items: Kpi[]; label: string }) {
  return (
    <section
      aria-label={label}
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-1 bg-line-1",
        items.length % 3 === 0 && "md:grid-cols-3",
        LG_COLS[items.length] ?? "lg:grid-cols-6",
      )}
    >
      {items.map((k) => {
        const good = k.deltaSign === 0 ? null : k.invert ? k.deltaSign === -1 : k.deltaSign === 1;
        const body = (
          <>
            <div className="text-[12px] font-medium text-hni-grey-dark" title={k.hint}>{k.label}</div>
            <bdi className="tabular mt-1 block text-[22px] font-semibold leading-none text-hni-black">{k.value}</bdi>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 text-[12px]">
              {k.delta && (
                <bdi className={cn("tabular font-medium", good === null ? "text-hni-grey-dark" : good ? "text-[color:var(--status-success-fg)]" : "text-[color:var(--status-danger-fg)]")}>
                  {k.delta}
                </bdi>
              )}
              <bdi className="text-hni-grey-dark">{k.comparison}</bdi>
            </div>
          </>
        );

        if (!k.onToggle) {
          return (
            <div key={k.id} data-testid={`kpi-${k.id}`} className="bg-surface-0 px-4 py-3">
              {body}
            </div>
          );
        }

        return (
          <button
            key={k.id}
            type="button"
            data-testid={`kpi-${k.id}`}
            aria-pressed={k.active}
            onClick={k.onToggle}
            className={cn(
              "relative bg-surface-0 px-4 py-3 text-start transition-colors hover:bg-surface-1",
              k.active && "bg-surface-1",
            )}
          >
            {k.active && <span aria-hidden className="absolute inset-y-0 start-0 w-[3px] bg-hni-magenta" />}
            {body}
            <span className="sr-only">{k.actionLabel}</span>
          </button>
        );
      })}
    </section>
  );
}
