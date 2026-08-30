import type { ReactNode } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, useI18n } from "@/lib/i18n";
import type { CalcResult } from "./calc";
import { sectionKindLabel, type Proposal } from "./types";
import { BANK_DETAILS, TERMS_PAGE_1, TERMS_PAGE_2, type TermsSection } from "./template";
import "./print.css";

type Props = {
  proposal: Proposal;
  result: CalcResult;
  onBack: () => void;
};

/**
 * Faithful rebuild of the official HNI Financial Proposal template
 * (6 pages, 13.33in x 7.5in). Page geometry uses physical (not logical)
 * positioning on purpose: the template's art direction does not mirror in
 * Arabic; only text content localizes. Legal terms stay English (template.ts).
 * Printing waits for document.fonts.ready so Tajawal/brand faces reach the PDF.
 */

/** Quarter-ring motif from the template's content-page corner (image2.svg). */
function QuarterRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 605.75 605.73" className={className} aria-hidden>
      <path
        d="M605.75 0 605.75 0C271.19 0 0 271.19 0 605.73L222.48 605.73C222.48 394.1 394.09 222.56 605.75 222.56"
        fill="var(--hni-magenta)"
      />
    </svg>
  );
}

/** Ring motif from the template's back cover (image23.svg). */
function Ring({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 313.65 313.65" className={className} aria-hidden>
      <path
        d="M156.83 62.79C208.68 62.79 250.87 104.97 250.87 156.83 250.87 208.69 208.69 250.87 156.83 250.87 104.97 250.87 62.79 208.69 62.79 156.83 62.79 104.97 104.97 62.79 156.83 62.79M156.83 0C70.21 0 0 70.21 0 156.83 0 243.45 70.21 313.66 156.83 313.66 243.45 313.66 313.66 243.45 313.66 156.83 313.66 70.21 243.44 0 156.83 0L156.83 0Z"
        fill="var(--hni-magenta)"
      />
    </svg>
  );
}

function DocPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`doc-page relative overflow-hidden bg-white text-[#404040] ${className}`}>{children}</section>;
}

/** Footer of every content page: logo bottom-left, quarter-ring bottom-right. */
function PageChrome() {
  return (
    <>
      <img src="/brand/logo-primary.svg" alt="" className="absolute bottom-[0.35in] left-[0.36in] h-[0.55in] w-auto" aria-hidden />
      <QuarterRing className="absolute bottom-0 right-0 h-[1.36in] w-[1.36in]" />
    </>
  );
}

/** Signature strip as on template slides 3-5: intentionally blank lines, no images. */
function SignatureBlock({ clientName }: { clientName: string }) {
  const { t } = useI18n();
  const p = t.pricing;
  return (
    <div className="absolute bottom-[0.35in] left-[2.89in] right-[1.6in] flex gap-[0.8in] text-[11pt]">
      <div className="flex-1">
        <div className="mb-[0.45in] border-b border-[#404040]" />
        <span>{p.docSignedHni}</span>
      </div>
      <div className="flex-1">
        <div className="mb-[0.45in] border-b border-[#404040]" />
        <span>
          {p.docSignedClientPre} <b>{clientName || "…………………"}</b> {p.docSignedClientPost}
        </span>
      </div>
    </div>
  );
}

function TermsPage({ title, sections, note, clientName }: { title: string; sections: TermsSection[]; note: string; clientName: string }) {
  return (
    <DocPage>
      <h2 className="absolute left-[0.36in] top-[0.17in] text-[26pt] font-bold text-hni-black">{title}</h2>
      <div dir="ltr" className="absolute left-[0.36in] right-[0.4in] top-[1.1in] text-left text-[10.5pt] leading-[1.45]">
        {note && <p className="mb-2 text-[9.5pt] italic text-hni-grey-mid">{note}</p>}
        {sections.map((s) => (
          <div key={s.heading} className="mb-3">
            <p className="mb-1 text-[11.5pt] font-bold">{s.heading}</p>
            <ul className="list-disc space-y-0.5 ps-5">
              {s.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <SignatureBlock clientName={clientName} />
      <PageChrome />
    </DocPage>
  );
}

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

  const money = (v: number) => formatCurrency(v, locale);
  const groupLabel = sectionKindLabel(proposal.sectionLabel, p);
  const hasDescriptions = proposal.programs.some((x) => x.description.trim() !== "");
  const proposedIn = proposal.date
    ? new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(`${proposal.date}T00:00:00`))
    : "";

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

      <div className="overflow-x-auto">
        <div id="client-document" data-testid="client-document" className="doc-pages mx-auto w-fit space-y-4">
          {/* Page 1 — Cover: full-bleed skyline art, title block on the light sky area. */}
          <DocPage>
            <img src="/brand/proposal-cover.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" aria-hidden />
            <img src="/brand/logo-primary.svg" alt={p.docFooter} className="absolute left-[0.95in] top-[1.25in] h-[0.75in] w-auto" />
            <div dir="ltr" className="absolute left-[0.46in] top-[2.85in] w-[7.6in] text-left">
              <h1 className="text-[34pt] font-bold leading-tight text-hni-black">{proposal.title}</h1>
              <p className="mt-[0.2in] text-[24pt] font-bold text-hni-magenta">{p.docTitle}</p>
              <p className="mt-[0.08in] text-[15pt] font-bold text-[#404040]">
                {p.docProposedIn} {proposedIn}
              </p>
              {proposal.clientName && (
                <p className="mt-[0.08in] text-[13pt] text-[#404040]">
                  {p.docFor} <b data-testid="doc-client">{proposal.clientName}</b>
                </p>
              )}
            </div>
          </DocPage>

          {/* Page 2 — Financial Breakdown: the generated pricing content. */}
          <DocPage>
            <h2 className="absolute left-[0.36in] top-[0.3in] text-[26pt] font-bold text-hni-black">{p.docBreakdown}</h2>
            <div className="absolute left-[0.36in] right-[0.5in] top-[1.25in]">
              <table className="w-full border-collapse text-[11pt]">
                <thead>
                  <tr className="border-b-2 border-hni-black text-[8.5pt] uppercase tracking-wide text-hni-grey-dark">
                    <th className="py-[0.08in] text-start font-semibold">{groupLabel}</th>
                    {hasDescriptions && (
                      <th className="w-[3.6in] py-[0.08in] text-start font-semibold">{p.description}</th>
                    )}
                    <th className="w-[1in] py-[0.08in] text-end font-semibold">{p.docDays}</th>
                    <th className="w-[1.4in] py-[0.08in] text-end font-semibold">{p.docParticipants}</th>
                    <th className="w-[1.8in] py-[0.08in] text-end font-semibold">{p.docInvestment}</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.programs.map((program) => {
                    const totals = result.programs.find((x) => x.programId === program.id);
                    return (
                      <tr key={program.id} className="border-b border-line-1 align-top">
                        <td className="py-[0.07in]">
                          <span className="font-bold text-hni-black">{program.name}</span>
                          {program.city && <span className="text-hni-grey-dark"> · {program.city}</span>}
                        </td>
                        {hasDescriptions && (
                          <td className="py-[0.07in] pe-[0.15in] text-[9.5pt] leading-[1.4] text-hni-grey-dark">
                            {program.description || "—"}
                          </td>
                        )}
                        <td className="tabular py-[0.07in] text-end">{program.days}</td>
                        <td className="tabular py-[0.07in] text-end">{program.participants || "—"}</td>
                        <td className="tabular py-[0.07in] text-end">
                          <bdi>{money(totals?.netShare ?? 0)}</bdi>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Ledger: the table closes on its own subtotal, like a financial instrument. */}
                  <tr>
                    <td colSpan={hasDescriptions ? 4 : 3} className="py-[0.07in] pe-[0.25in] text-end font-bold text-hni-black">
                      {p.docSubtotal}
                    </td>
                    <td className="tabular py-[0.07in] text-end font-bold text-hni-black">
                      <bdi>{money(result.listPrice)}</bdi>
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-[0.35in] flex items-start justify-between gap-[0.6in]">
                {result.scheduleValid && proposal.schedule.length > 0 ? (
                  <div className="w-[5.2in]">
                    <h3 className="border-b-2 border-hni-black pb-[0.06in] text-[10pt] font-bold uppercase tracking-wide text-hni-black">
                      {p.docScheduleTitle}
                    </h3>
                    <table className="w-full border-collapse text-[10.5pt]">
                      <tbody>
                        {proposal.schedule.map((item, i) => {
                          const inst = result.installments.find((x) => x.itemId === item.id);
                          return (
                            <tr key={item.id} className="border-b border-line-1 last:border-b-0">
                              <td className="tabular w-[0.35in] py-[0.07in] text-hni-grey-dark">{i + 1}</td>
                              <td className="py-[0.07in]">{item.label || "—"}</td>
                              <td className="tabular w-[0.7in] py-[0.07in] text-end text-hni-grey-dark">{item.percent}%</td>
                              <td className="tabular w-[1.5in] py-[0.07in] text-end font-bold text-hni-black">
                                <bdi>{money(inst?.amount ?? 0)}</bdi>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1" />
                )}

                <div className="w-[4.3in] text-[11pt]">
                  {result.discountAmount > 0 && (
                    <div className="flex justify-between border-b border-line-1 py-[0.05in]">
                      <span className="text-hni-grey-dark">{p.docDiscount}</span>
                      <bdi className="tabular">−{money(result.discountAmount)}</bdi>
                    </div>
                  )}
                  <div className="flex justify-between border-b border-line-1 py-[0.05in] font-bold text-hni-black">
                    <span>{p.docNet}</span>
                    <bdi className="tabular" data-testid="doc-net">{money(result.netPrice)}</bdi>
                  </div>
                  <div className="flex justify-between py-[0.05in]">
                    <span className="text-hni-grey-dark">
                      {p.docVat} {proposal.vatPct}%
                    </span>
                    <bdi className="tabular" data-testid="doc-vat">{money(result.vatAmount)}</bdi>
                  </div>
                  {/* The page's single brand moment: the total in a solid magenta band. */}
                  <div className="mt-[0.08in] flex justify-between bg-hni-magenta px-[0.16in] py-[0.1in] text-[12.5pt] font-bold text-white">
                    <span>{p.docTotal}</span>
                    <bdi className="tabular" data-testid="doc-total">{money(result.totalIncVat)}</bdi>
                  </div>
                </div>
              </div>
            </div>
            <PageChrome />
          </DocPage>

          {/* Pages 3-4 — Terms (verbatim, English) with blank signature strips. */}
          <TermsPage title={p.docTerms1} sections={TERMS_PAGE_1} note={p.docLegalEnNote} clientName={proposal.clientName} />
          <TermsPage title={p.docTerms2} sections={TERMS_PAGE_2} note={p.docLegalEnNote} clientName={proposal.clientName} />

          {/* Page 5 — Bank details. */}
          <DocPage>
            <h2 className="absolute left-[0.36in] top-[0.49in] text-[26pt] font-bold text-hni-black">{p.docBank}</h2>
            <table dir="ltr" className="absolute left-[0.59in] top-[1.7in] w-[7.5in] border-collapse text-left text-[12pt]" data-testid="doc-bank">
              <tbody>
                {BANK_DETAILS.map((row) => (
                  <tr key={row.label} className="border-b border-line-1">
                    <td className="w-[2.4in] py-[0.09in] text-[9.5pt] font-bold uppercase tracking-wide text-hni-grey-dark">{row.label}</td>
                    <td className="tabular py-[0.09in] text-hni-black">{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <SignatureBlock clientName={proposal.clientName} />
            <PageChrome />
          </DocPage>

          {/* Page 6 — Back cover. */}
          <DocPage>
            <Ring className="absolute -left-[0.4in] -top-[0.4in] h-[3.2in] w-[3.2in]" />
            <img src="/brand/logo-primary.svg" alt="" className="absolute right-[0.6in] top-[0.85in] h-[0.8in] w-auto" aria-hidden />
            <p className="absolute left-1/2 top-[2.9in] -translate-x-1/2 text-[52pt] font-bold tracking-wide text-hni-black">
              {p.docThankYou}
            </p>
            <div className="absolute bottom-[0.6in] left-[0.57in]">
              <p className="text-[20pt] font-bold text-[#201D1F]">{p.docGetInTouch}</p>
              <p className="mt-[0.15in] text-[12pt] text-[#201D1F]">{p.docCountries}</p>
            </div>
            <QuarterRing className="absolute bottom-0 right-0 h-[1.36in] w-[1.36in]" />
          </DocPage>
        </div>
      </div>
    </div>
  );
}
