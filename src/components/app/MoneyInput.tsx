import { forwardRef } from "react";
import { Input } from "@/components/ui/input";

/**
 * Whole-number money entry with live thousands separators: the user sees
 * "8,000,000", the app stores 8000000. A text input on purpose — number
 * inputs cannot render grouping. Commas re-render on every keystroke;
 * digits are the only accepted characters (Latin grouping app-wide, per
 * the money-display convention).
 */
type Props = {
  value: number | null;
  onValue: (value: number | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  "aria-label"?: string;
  "data-testid"?: string;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
};

export const MoneyInput = forwardRef<HTMLInputElement, Props>(function MoneyInput(
  { value, onValue, ...rest },
  ref,
) {
  const display = value == null ? "" : value.toLocaleString("en-US");
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={display}
      onChange={(e) => {
        const digits = e.target.value.replace(/[^0-9]/g, "");
        onValue(digits === "" ? null : Number(digits));
      }}
      {...rest}
    />
  );
});
