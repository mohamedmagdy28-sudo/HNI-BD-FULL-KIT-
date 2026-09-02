import { FileText, Calculator, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/States";
import { StatusBadge } from "@/components/app/StatusBadge";
import { formatCurrency, useI18n } from "@/lib/i18n";
import { calc } from "./calc";
import { hasCustomTerms } from "./customTerms";
import type { Proposal } from "./types";

type Props = {
  /** Sent proposals only; drafts are not documents. */
  documents: Proposal[];
  onOpenDocument: (id: string) => void;
  onOpenCosting: (id: string) => void;
  /** Downloads the internal costing workbook for one sent proposal. */
  onDownloadCosting: (id: string) => void;
};

/**
 * The archive of sent proposals. A sent proposal is locked, so re-rendering
 * it from data reproduces the exact document that was quoted; no file bytes
 * are stored. Newest first by sentAt.
 */
export function DocumentsList({ documents, onOpenDocument, onOpenCosting, onDownloadCosting }: Props) {
  const { t, locale } = useI18n();
  const p = t.pricing;

  if (documents.length === 0) {
    return <EmptyState title={p.docsEmptyTitle} body={p.docsEmptyBody} />;
  }

  const sorted = [...documents].sort((a, b) => (b.sentAt ?? "").localeCompare(a.sentAt ?? ""));
  const sentOn = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso)) : "—";

  return (
    <div className="overflow-hidden rounded-lg border border-line-1 bg-surface-0">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line-1 bg-surface-1 text-[11px] uppercase tracking-wide text-hni-grey-dark">
            <th className="px-3 py-2 text-start font-medium">{p.proposalTitle}</th>
            <th className="px-3 py-2 text-start font-medium">{p.client}</th>
            <th className="w-32 px-3 py-2 text-start font-medium">{p.docsSentOn}</th>
            <th className="w-36 px-3 py-2 text-end font-medium">{p.totalIncVat}</th>
            <th className="w-72 px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((proposal) => {
            const result = calc(proposal);
            return (
              <tr key={proposal.id} className="border-b border-line-1 last:border-b-0" data-testid={`document-row-${proposal.id}`}>
                <td className="px-3 py-2.5 font-medium text-hni-black">
                  <span className="flex items-center gap-1.5">
                    {proposal.title || p.untitled}
                    {hasCustomTerms(proposal) && (
                      <span data-testid={`doc-custom-terms-${proposal.id}`}>
                        <StatusBadge tone="neutral">{p.customTermsBadge}</StatusBadge>
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-hni-grey-dark">{proposal.clientName || "—"}</td>
                <td className="tabular px-3 py-2.5 text-hni-grey-dark">{sentOn(proposal.sentAt)}</td>
                <td className="tabular px-3 py-2.5 text-end font-semibold text-hni-black">
                  <bdi>{formatCurrency(result.totalIncVat, locale)}</bdi>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[12.5px]" onClick={() => onOpenCosting(proposal.id)}>
                      <Calculator className="size-3.5" aria-hidden />
                      {p.docsViewCosting}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-[12.5px]"
                      data-testid={`download-costing-${proposal.id}`}
                      onClick={() => onDownloadCosting(proposal.id)}
                    >
                      <FileSpreadsheet className="size-3.5" aria-hidden />
                      {p.downloadCosting}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[12.5px]"
                      data-testid={`open-document-${proposal.id}`}
                      onClick={() => onOpenDocument(proposal.id)}
                    >
                      <FileText className="size-3.5" aria-hidden />
                      {p.docsOpenDocument}
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
