import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, useI18n } from "@/lib/i18n";
import type { CalcResult } from "./calc";
import type { Proposal } from "./types";
import "./print.css";

type Props = {
  proposal: Proposal;
  result: CalcResult;
  onBack: () => void;
};

/**
 * Dedicated render mode (eng review 2A): only the client document is on
 * screen, so the printed PDF is exactly what the user sees. Internal figures
 * (costs, margin) never render here. Printing waits for document.fonts.ready
 * so Tajawal and the brand faces are guaranteed in the PDF.
 */
export function ClientView({ proposal, result, onBack }: Props) {
  const { t, locale } = useI18n();
  const p = t.pricing;

  const print = async () => {
    try {
      await document.fonts.ready;
    } catch {
      /* fonts API unavailable: print anyway */
    }
    window.print();
  };

  const dateLabel = proposal.date
    ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "long", day: "numeric" }).format(
        new Date(`${proposal.date}T00:00:00`),
      )
    : "";

  const money = (v: number) => formatCurrency(v, locale);

  return (
    <div>
      <div className="mb-4 flex items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" data-testid="client-view-back" onClick={onBack}>
          <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
          {p.back}
        </Button>
        <Button size="sm" data-testid="client-view-print" className="ms-auto" onClick={print}>
          <Printer className="size-4" aria-hidden />
          {p.print}
        </Button>
      </div>

      <div
        id="client-document"
        data-testid="client-document"
        className="mx-auto max-w-[210mm] rounded-lg border border-line-1 bg-surface-0 p-10 shadow-sm"
      >
        {/* Letterhead: logo, magenta rule, document identity. */}
        <header className="flex items-start justify-between gap-4">
          <img src="/brand/logo-primary.svg" alt={p.docFooter} className="h-7 w-auto" />
          <div className="text-end">
            <h1 className="text-[22px] font-bold leading-tight text-hni-black">{p.docTitle}</h1>
            <p className="mt-0.5 text-[12.5px] text-hni-grey-dark">{dateLabel}</p>
          </div>
        </header>
        <div className="mt-4 h-[3px] w-full bg-hni-magenta" aria-hidden />

        <div className="mt-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-hni-grey-mid">{p.docFor}</p>
          <p className="mt-0.5 text-[16px] font-semibold text-hni-black" data-testid="doc-client">
            {proposal.clientName || "—"}
          </p>
          <p className="text-[13.5px] text-hni-grey-dark">{proposal.title}</p>
        </div>

        <table className="mt-6 w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b-2 border-hni-black text-[11px] uppercase tracking-wide text-hni-grey-dark">
              <th className="py-2 text-start font-semibold">{p.docProgram}</th>
              <th className="w-20 py-2 text-end font-semibold">{p.docDays}</th>
              <th className="w-28 py-2 text-end font-semibold">{p.docParticipants}</th>
              <th className="w-36 py-2 text-end font-semibold">{p.docInvestment}</th>
            </tr>
          </thead>
          <tbody>
            {proposal.programs.map((program) => {
              const totals = result.programs.find((x) => x.programId === program.id);
              return (
                <tr key={program.id} className="border-b border-line-1">
                  <td className="py-2.5">
                    <span className="font-medium text-hni-black">{program.name}</span>
                    {program.city && <span className="text-hni-grey-dark"> · {program.city}</span>}
                  </td>
                  <td className="tabular py-2.5 text-end">{program.days}</td>
                  <td className="tabular py-2.5 text-end">{program.participants || "—"}</td>
                  <td className="tabular py-2.5 text-end font-medium text-hni-black">
                    <bdi>{money(totals?.netShare ?? 0)}</bdi>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mt-4 ms-auto w-full max-w-72 space-y-1 text-[13px]">
          {result.discountAmount > 0 && (
            <>
              <div className="flex justify-between">
                <span className="text-hni-grey-dark">{p.docSubtotal}</span>
                <bdi className="tabular">{money(result.listPrice)}</bdi>
              </div>
              <div className="flex justify-between">
                <span className="text-hni-grey-dark">{p.docDiscount}</span>
                <bdi className="tabular">−{money(result.discountAmount)}</bdi>
              </div>
            </>
          )}
          <div className="flex justify-between font-medium text-hni-black">
            <span>{p.docNet}</span>
            <bdi className="tabular" data-testid="doc-net">{money(result.netPrice)}</bdi>
          </div>
          <div className="flex justify-between">
            <span className="text-hni-grey-dark">
              {p.docVat} {proposal.vatPct}%
            </span>
            <bdi className="tabular" data-testid="doc-vat">{money(result.vatAmount)}</bdi>
          </div>
          <div className="flex justify-between border-t-2 border-hni-black pt-1.5 text-[14.5px] font-bold text-hni-black">
            <span>{p.docTotal}</span>
            <bdi className="tabular" data-testid="doc-total">{money(result.totalIncVat)}</bdi>
          </div>
        </div>

        {result.scheduleValid && proposal.schedule.length > 0 && (
          <div className="mt-7">
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-hni-black">{p.docScheduleTitle}</h2>
            <table className="mt-2 w-full border-collapse text-[13px]">
              <tbody>
                {proposal.schedule.map((item) => {
                  const installment = result.installments.find((x) => x.itemId === item.id);
                  return (
                    <tr key={item.id} className="border-b border-line-1 last:border-b-0">
                      <td className="py-1.5">{item.label || "—"}</td>
                      <td className="tabular w-16 py-1.5 text-end text-hni-grey-dark">{item.percent}%</td>
                      <td className="tabular w-36 py-1.5 text-end font-medium text-hni-black">
                        <bdi>{money(installment?.amount ?? 0)}</bdi>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="mt-10 border-t border-line-1 pt-3 text-center text-[11px] text-hni-grey-mid">
          {p.docFooter}
        </footer>
      </div>
    </div>
  );
}
