import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

/** Semantic status only. Never brand colors. Text carries the meaning; color reinforces it. */
export function StatusBadge({ tone, children, className }: { tone: Tone; children: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded px-1.5 py-0.5 text-[12px] font-medium", className)}
      style={{ color: `var(--status-${tone}-fg)`, backgroundColor: `var(--status-${tone}-bg)` }}
    >
      {children}
    </span>
  );
}
