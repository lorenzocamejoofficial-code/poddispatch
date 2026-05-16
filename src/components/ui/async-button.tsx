import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { toast } from "sonner";

export interface AsyncButtonProps extends Omit<ButtonProps, "onClick"> {
  /**
   * Async click handler. AsyncButton automatically:
   *  - disables the button while the promise is pending (prevents double-clicks / duplicates)
   *  - shows a spinner + optional pendingLabel
   *  - catches thrown errors and shows a toast (override via onError)
   */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  pendingLabel?: React.ReactNode;
  /** Override the default error toast. Return true to suppress the default toast. */
  onError?: (err: unknown) => boolean | void;
  /** Hide the spinner when pending (label only). */
  hideSpinner?: boolean;
}

/**
 * Drop-in replacement for <Button> that prevents the #1 cause of duplicates &
 * "the app feels frozen" complaints: users mashing a submit button while the
 * request is still in flight.
 *
 * Usage:
 *   <AsyncButton onClick={handleSave}>Save</AsyncButton>
 *   <AsyncButton onClick={handleSave} pendingLabel="Saving...">Save</AsyncButton>
 */
export const AsyncButton = React.forwardRef<HTMLButtonElement, AsyncButtonProps>(
  ({ onClick, children, pendingLabel, hideSpinner, disabled, onError, ...rest }, ref) => {
    const [pending, setPending] = React.useState(false);
    const mountedRef = React.useRef(true);
    React.useEffect(() => () => { mountedRef.current = false; }, []);

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      if (pending || disabled) return;
      if (!onClick) return;
      let result: void | Promise<void>;
      try {
        result = onClick(e);
      } catch (err) {
        const suppressed = onError?.(err);
        if (!suppressed) toast.error(err instanceof Error ? err.message : "Something went wrong");
        return;
      }
      if (result && typeof (result as Promise<void>).then === "function") {
        setPending(true);
        try {
          await result;
        } catch (err) {
          const suppressed = onError?.(err);
          if (!suppressed) toast.error(err instanceof Error ? err.message : "Something went wrong");
        } finally {
          if (mountedRef.current) setPending(false);
        }
      }
    };

    return (
      <Button
        ref={ref}
        disabled={disabled || pending}
        onClick={handleClick}
        {...rest}
      >
        {pending && !hideSpinner && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {pending && pendingLabel ? pendingLabel : children}
      </Button>
    );
  },
);
AsyncButton.displayName = "AsyncButton";