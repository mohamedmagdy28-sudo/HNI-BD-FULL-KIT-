import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function EmptyState({ title, body, cta, onCta }: { title: string; body: string; cta?: string; onCta?: () => void }) {
  return (
    <div className="rounded-lg border border-dashed border-line-2 bg-surface-0 px-6 py-10 text-center">
      <p className="text-[14px] font-medium text-hni-black">{title}</p>
      <p className="mt-1 text-[13px] text-hni-grey-dark">{body}</p>
      {cta && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onCta}>
          {cta}
        </Button>
      )}
    </div>
  );
}

export function ErrorState({ title, body, retry, onRetry }: { title: string; body: string; retry: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-[color:var(--status-danger-fg)]/30 bg-[color:var(--status-danger-bg)] px-4 py-3">
      <p className="text-[14px] font-medium text-[color:var(--status-danger-fg)]">{title}</p>
      <p className="mt-0.5 text-[13px] text-hni-grey-dark">{body}</p>
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        {retry}
      </Button>
    </div>
  );
}

export function LoadingState({ label }: { label: string }) {
  return (
    <div aria-busy="true" aria-label={label} className="space-y-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-1 bg-line-1 md:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-surface-0 px-4 py-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-6 w-16" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-line-1 bg-surface-0 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="mb-3 h-5 w-full last:mb-0" />
        ))}
      </div>
    </div>
  );
}
