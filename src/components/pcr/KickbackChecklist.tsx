import { useState, useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PCRTripData } from "@/hooks/usePCRData";
import { getTimeSequenceWarnings } from "@/components/pcr/TimesCard";

/**
 * Maps each known kickback reason to an auto-detection function.
 * Returns true when the issue has been resolved.
 */
function isReasonResolved(reason: string, trip: PCRTripData): boolean | null {
  switch (reason) {
    case "Missing or incorrect odometer readings":
      return (
        trip.odometer_at_scene != null &&
        trip.odometer_at_destination != null &&
        trip.odometer_in_service != null &&
        trip.odometer_at_destination > trip.odometer_at_scene
      );

    case "Incomplete vitals": {
      const vitals = trip.vitals_json || [];
      if (vitals.length === 0) return false;
      const v = vitals[0];
      return !!(v?.bp_systolic && v?.pulse && v?.respiration);
    }

    case "Medical necessity criteria not selected":
      return !!(trip.medical_necessity_reason);

    case "Times out of sequence":
      return getTimeSequenceWarnings(trip).size === 0;

    case "Missing patient signature": {
      const sigs = trip.signatures_json || [];
      return sigs.some((s: any) => s?.type === "patient" && s?.data);
    }

    case "Incorrect transport information":
      return !!(trip.pickup_location && trip.destination_location);

    default:
      // "Other" or any unknown reason → manual checkbox
      return null;
  }
}

interface KickbackChecklistProps {
  trip: PCRTripData;
}

export function KickbackChecklist({ trip }: KickbackChecklistProps) {
  const reasons: string[] = useMemo(
    () => Array.isArray(trip.kickback_reasons) ? trip.kickback_reasons : [],
    [trip.kickback_reasons]
  );
  const note: string | null = trip.kickback_note ?? null;

  // Manual overrides for items that can't be auto-detected
  const [manualChecks, setManualChecks] = useState<Record<string, boolean>>({});

  const items = useMemo(() => {
    return reasons.map(reason => {
      const autoResult = isReasonResolved(reason, trip);
      const isManual = autoResult === null;
      const resolved = isManual ? (manualChecks[reason] ?? false) : autoResult;
      return { reason, resolved, isManual };
    });
  }, [reasons, trip, manualChecks]);

  const resolvedCount = items.filter(i => i.resolved).length;
  const totalCount = items.length;
  const allResolved = totalCount > 0 && resolvedCount === totalCount;

  if (reasons.length === 0 && !note) return null;

  return (
    <div className={cn(
      "mb-4 rounded-lg border-2 p-4 transition-colors",
      allResolved
        ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-900/10"
        : "border-destructive bg-destructive/10"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "h-10 w-10 rounded-full flex items-center justify-center",
          allResolved
            ? "bg-emerald-100 dark:bg-emerald-800/30"
            : "bg-destructive/20"
        )}>
          {allResolved
            ? <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            : <AlertTriangle className="h-6 w-6 text-destructive" />
          }
        </div>
        <div>
          <p className={cn(
            "text-sm font-bold",
            allResolved ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"
          )}>
            {allResolved
              ? "All issues resolved — ready to resubmit"
              : "Returned for Correction"
            }
          </p>
          <p className={cn(
            "text-xs",
            allResolved ? "text-emerald-600/80 dark:text-emerald-400/80" : "text-destructive/80"
          )}>
            {allResolved
              ? "Tap Submit PCR below to resubmit"
              : totalCount > 0
                ? `${resolvedCount} of ${totalCount} issue${totalCount !== 1 ? "s" : ""} resolved`
                : ""
            }
            {!allResolved && trip.kicked_back_at && (
              <> · {new Date(trip.kicked_back_at).toLocaleString()}</>
            )}
          </p>
        </div>
      </div>

      {/* Checklist items */}
      {items.length > 0 && (
        <div className="mt-3 space-y-2">
          {items.map(({ reason, resolved, isManual }) => (
            <div
              key={reason}
              className={cn(
                "flex items-start gap-3 rounded-md px-2 py-1.5 transition-colors",
                resolved ? "bg-emerald-50/50 dark:bg-emerald-900/5" : ""
              )}
            >
              {isManual ? (
                <Checkbox
                  checked={resolved}
                  onCheckedChange={(checked) =>
                    setManualChecks(prev => ({ ...prev, [reason]: !!checked }))
                  }
                  className="mt-0.5"
                />
              ) : resolved ? (
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Circle className="h-4 w-4 mt-0.5 shrink-0 text-destructive/60" />
              )}
              <span className={cn(
                "text-sm",
                resolved
                  ? "text-emerald-700 dark:text-emerald-400 line-through"
                  : "text-foreground"
              )}>
                {reason}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Biller note */}
      {note && (
        <div className="mt-3 rounded-md border border-border bg-background p-2">
          <p className="text-xs font-semibold text-muted-foreground mb-0.5">Biller Note:</p>
          <p className="text-sm text-foreground">{note}</p>
        </div>
      )}
    </div>
  );
}
