import { cn } from "@/lib/utils";

interface PCRFieldIndicatorProps {
  filled: boolean;
  required?: boolean;
  className?: string;
}

/**
 * Small dot indicator for PCR field completion status.
 * Red dot = required & empty, Green dot = filled, no dot = optional & empty.
 */
export function PCRFieldDot({ filled, required = true, className }: PCRFieldIndicatorProps) {
  if (!required && !filled) return null;
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full shrink-0 ml-1",
        filled ? "bg-emerald-500" : "bg-destructive",
        className
      )}
      aria-label={filled ? "Complete" : "Required"}
    />
  );
}

interface SectionCompletionProps {
  completed: number;
  total: number;
  className?: string;
}

/** Compact "X of Y complete" badge for section headers */
export function SectionCompletionBadge({ completed, total, className }: SectionCompletionProps) {
  if (total === 0) return null;
  const allDone = completed === total;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
      allDone
        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
        : "bg-destructive/10 text-destructive",
      className
    )}>
      {completed}/{total}
    </span>
  );
}
