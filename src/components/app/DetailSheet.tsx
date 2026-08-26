import type { ReactNode } from "react";
import { X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * App-level drawer. Opens from the inline-end edge in both directions and puts a
 * translated close control on that same end edge, which the primitive's physical
 * `right-4` does not do. Wraps the shadcn Sheet rather than editing it.
 */
export function DetailSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { t, dir } = useI18n();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={dir === "rtl" ? "left" : "right"}
        className="flex w-full flex-col overflow-y-auto sm:max-w-md [&>button]:hidden"
      >
        <SheetHeader className="text-start sm:text-start">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-[16px] leading-snug">{title}</SheetTitle>
              {description && <SheetDescription className="text-[13px]">{description}</SheetDescription>}
            </div>
            <SheetClose className="-me-2 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-md text-hni-grey-dark transition-colors hover:bg-surface-2">
              <X className="size-4" aria-hidden />
              <span className="sr-only">{t.close}</span>
            </SheetClose>
          </div>
        </SheetHeader>

        <div className="mt-6 flex-1">{children}</div>
        {footer && <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:justify-start">{footer}</div>}
      </SheetContent>
    </Sheet>
  );
}
