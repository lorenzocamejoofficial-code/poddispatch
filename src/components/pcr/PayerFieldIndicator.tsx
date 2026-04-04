import { cn } from "@/lib/utils";

interface PayerFieldIndicatorProps {
  /** Patient's primary payer string */
  payer: string | null;
  /** Show for all payers (red asterisk) */
  allPayers?: boolean;
  /** Show for Medicare */
  medicare?: boolean;
  /** Show for Medicaid */
  medicaid?: boolean;
  className?: string;
}

function normalizePayer(payer: string | null): "medicare" | "medicaid" | "unknown" | "other" {
  if (!payer) return "unknown"; // no payer linked — only show universal indicators
  const p = payer.toLowerCase();
  if (p.includes("medicaid")) return "medicaid";
  if (p.includes("medicare")) return "medicare";
  return "other";
}

/**
 * Payer-specific field indicator:
 * - Blue "M" = required by Medicare
 * - Green "MC" = required by Medicaid
 * - Red "*" = required by all payers
 */
export function PayerFieldIndicator({ payer, allPayers, medicare, medicaid, className }: PayerFieldIndicatorProps) {
  const normalized = normalizePayer(payer);

  // All-payer required fields always show red asterisk
  if (allPayers) {
    return (
      <span className={cn("ml-1 text-[10px] font-bold text-destructive", className)} title="Required for all payers">
        *
      </span>
    );
  }

  // Medicare-specific
  if (medicare && normalized === "medicare") {
    return (
      <span className={cn("ml-1 text-[10px] font-bold text-blue-600 dark:text-blue-400", className)} title="Required for Medicare">
        M
      </span>
    );
  }

  // Medicaid-specific
  if (medicaid && normalized === "medicaid") {
    return (
      <span className={cn("ml-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400", className)} title="Required for Medicaid">
        MC
      </span>
    );
  }

  // Show Medicare indicator if both medicare and medicaid flags are set and payer is medicare
  if (medicare && medicaid) {
    if (normalized === "medicare") {
      return (
        <span className={cn("ml-1 text-[10px] font-bold text-blue-600 dark:text-blue-400", className)} title="Required for Medicare">
          M
        </span>
      );
    }
    if (normalized === "medicaid") {
      return (
        <span className={cn("ml-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400", className)} title="Required for Medicaid">
          MC
        </span>
      );
    }
  }

  return null;
}
