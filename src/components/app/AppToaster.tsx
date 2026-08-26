import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

/**
 * App-level toaster. Anchors to the inline-end edge in both directions; the stock
 * viewport hard-codes `right-0`, which lands on the start edge in Arabic. Uses the
 * rtl variant rather than logical utilities, which the primitive would override.
 * Duration is long enough to reach an Undo action before the toast closes.
 */
export function AppToaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider duration={8000}>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} className="rtl:pl-10" {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose className="rtl:left-1 rtl:right-auto" />
        </Toast>
      ))}
      <ToastViewport className="sm:rtl:left-0 sm:rtl:right-auto" />
    </ToastProvider>
  );
}
