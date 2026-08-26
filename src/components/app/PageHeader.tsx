import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, controls, primary }: { title: string; subtitle?: string; controls?: ReactNode; primary?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3 border-b border-line-1 pb-4">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-hni-black">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-hni-grey-dark">{subtitle}</p>}
      </div>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        {controls}
        {primary}
      </div>
    </div>
  );
}
