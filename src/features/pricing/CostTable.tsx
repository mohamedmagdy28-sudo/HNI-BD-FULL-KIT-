import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, useI18n } from "@/lib/i18n";
import { lineSubtotal, programCost } from "./calc";
import { newCostLine, newProgram, type CostLine, type Program } from "./types";

type Props = {
  programs: Program[];
  locked: boolean;
  /** Fixed cost items pre-created in every new program (from the proposal's project type). */
  seedLabels: readonly string[];
  onChange: (programs: Program[]) => void;
};

/** Parses a numeric input; empty or invalid becomes 0, negatives clamp to 0. */
function num(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function CostTable({ programs, locked, seedLabels, onChange }: Props) {
  const { t, locale } = useI18n();
  const p = t.pricing;

  const updateProgram = (id: string, patch: Partial<Program>) =>
    onChange(programs.map((pr) => (pr.id === id ? { ...pr, ...patch } : pr)));

  const updateLine = (programId: string, lineId: string, patch: Partial<CostLine>) =>
    onChange(
      programs.map((pr) =>
        pr.id === programId
          ? { ...pr, costLines: pr.costLines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
          : pr,
      ),
    );

  return (
    <div className="space-y-4">
      {programs.map((program, index) => (
        <section
          key={program.id}
          aria-label={`${p.program} ${index + 1}`}
          className="overflow-hidden rounded-lg border border-line-1 bg-surface-0"
        >
          <div className="flex flex-wrap items-end gap-2 border-b border-line-1 bg-surface-1 px-3 py-2.5">
            <label className="min-w-0 flex-1 basis-48">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.program}</span>
              <Input
                value={program.name}
                disabled={locked}
                data-testid={`program-name-${index}`}
                onChange={(e) => updateProgram(program.id, { name: e.target.value })}
                className="mt-1 h-8 bg-surface-0"
              />
            </label>
            <label className="w-20">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.days}</span>
              <Input
                type="number"
                min={0}
                value={program.days}
                disabled={locked}
                data-testid={`program-days-${index}`}
                onChange={(e) => updateProgram(program.id, { days: num(e.target.value) })}
                className="tabular mt-1 h-8 bg-surface-0"
              />
            </label>
            <label className="w-28">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.participants}</span>
              <Input
                type="number"
                min={0}
                value={program.participants}
                disabled={locked}
                data-testid={`program-participants-${index}`}
                onChange={(e) => updateProgram(program.id, { participants: num(e.target.value) })}
                className="tabular mt-1 h-8 bg-surface-0"
              />
            </label>
            <label className="w-32">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-hni-grey-dark">{p.city}</span>
              <Input
                value={program.city}
                disabled={locked}
                onChange={(e) => updateProgram(program.id, { city: e.target.value })}
                className="mt-1 h-8 bg-surface-0"
              />
            </label>
            {!locked && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
                aria-label={p.removeProgram}
                onClick={() => onChange(programs.filter((pr) => pr.id !== program.id))}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            )}
          </div>

          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line-1 text-[11px] uppercase tracking-wide text-hni-grey-dark">
                <th className="px-3 py-2 text-start font-medium">{p.lineLabel}</th>
                <th className="w-24 px-2 py-2 text-end font-medium">{p.qty}</th>
                <th className="w-32 px-2 py-2 text-end font-medium">{p.unitRate}</th>
                <th className="w-32 px-3 py-2 text-end font-medium">{p.subtotal}</th>
                <th className="w-10 px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {program.costLines.map((line, lineIndex) => (
                <tr key={line.id} className="border-b border-line-1 last:border-b-0">
                  <td className="px-3 py-1.5">
                    <Input
                      value={line.label}
                      disabled={locked}
                      data-testid={`line-label-${index}-${lineIndex}`}
                      onChange={(e) => updateLine(program.id, line.id, { label: e.target.value })}
                      className="h-8 border-transparent bg-transparent px-1 shadow-none focus-visible:border-input"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={line.qty}
                      disabled={locked}
                      data-testid={`line-qty-${index}-${lineIndex}`}
                      onChange={(e) => updateLine(program.id, line.id, { qty: num(e.target.value) })}
                      className="tabular h-8 border-transparent bg-transparent px-1 text-end shadow-none focus-visible:border-input"
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={line.unitRate}
                      disabled={locked}
                      data-testid={`line-rate-${index}-${lineIndex}`}
                      onChange={(e) => updateLine(program.id, line.id, { unitRate: num(e.target.value) })}
                      className="tabular h-8 border-transparent bg-transparent px-1 text-end shadow-none focus-visible:border-input"
                    />
                  </td>
                  <td className="tabular px-3 py-1.5 text-end font-medium text-hni-black">
                    <bdi>{formatCurrency(lineSubtotal(line.qty, line.unitRate), locale)}</bdi>
                  </td>
                  <td className="px-1 py-1.5">
                    {!locked && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-hni-grey-mid hover:text-[color:var(--status-danger-fg)]"
                        aria-label={p.removeLine}
                        onClick={() =>
                          updateProgram(program.id, { costLines: program.costLines.filter((l) => l.id !== line.id) })
                        }
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface-1/60">
                <td className="px-3 py-1.5">
                  {!locked && (
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`add-line-${index}`}
                      className="h-7 px-2 text-[12.5px] text-hni-magenta hover:text-hni-magenta"
                      onClick={() => updateProgram(program.id, { costLines: [...program.costLines, newCostLine()] })}
                    >
                      <Plus className="size-3.5" aria-hidden />
                      {p.addLine}
                    </Button>
                  )}
                </td>
                <td colSpan={2} className="px-2 py-1.5 text-end text-[12px] text-hni-grey-dark" />
                <td className="tabular px-3 py-1.5 text-end font-semibold text-hni-black" data-testid={`program-cost-${index}`}>
                  <bdi>{formatCurrency(programCost(program), locale)}</bdi>
                </td>
                <td className="px-1 py-1.5" />
              </tr>
            </tbody>
          </table>
        </section>
      ))}

      {!locked && (
        <Button
          variant="outline"
          size="sm"
          data-testid="add-program"
          onClick={() => onChange([...programs, newProgram(`${t.pricing.program} ${programs.length + 1}`, seedLabels)])}
        >
          <Plus className="size-4" aria-hidden />
          {p.addProgram}
        </Button>
      )}
    </div>
  );
}
