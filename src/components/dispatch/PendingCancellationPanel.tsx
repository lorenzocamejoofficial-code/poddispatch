import { useState } from "react";
import { AlertTriangle, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export interface PendingCancellation {
  tripId: string;
  patientName: string;
  cancellationReason: string;
  cancelledAt: string;
  cancelledByName: string;
  truckName: string;
  truckId: string;
  legId: string | null;
  slotId: string | null;
  companyId: string | null;
  crewMemberIds: string[]; // profile IDs for notification
}

interface PendingCancellationPanelProps {
  cancellations: PendingCancellation[];
  onResolved: () => void;
}

export function PendingCancellationPanel({ cancellations, onResolved }: PendingCancellationPanelProps) {
  const { profileId } = useAuth();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);

  if (cancellations.length === 0) return null;

  const handleConfirm = async (c: PendingCancellation) => {
    const note = (notes[c.tripId] ?? "").trim();
    if (!note) return;
    setLoading(`confirm-${c.tripId}`);
    try {
      // Update trip_records
      await supabase.from("trip_records").update({
        status: "cancelled" as any,
        cancellation_verified_by: profileId,
        cancellation_verified_at: new Date().toISOString(),
        cancellation_dispatcher_note: note,
        cancellation_disputed: false,
      } as any).eq("id", c.tripId);

      // Update truck_run_slots status
      if (c.legId) {
        await supabase.from("truck_run_slots")
          .update({ status: "cancelled" } as any)
          .eq("leg_id", c.legId)
          .eq("truck_id", c.truckId);
      }

      // Notify crew members
      for (const crewId of c.crewMemberIds) {
        // Get user_id from profile
        const { data: profile } = await supabase.from("profiles").select("user_id").eq("id", crewId).maybeSingle();
        if (profile?.user_id) {
          await supabase.from("notifications").insert({
            user_id: profile.user_id,
            message: `Your cancellation for ${c.patientName} has been confirmed`,
            acknowledged: false,
          });
        }
      }

      // Insert billing_overrides record
      await supabase.from("billing_overrides").insert({
        trip_id: c.tripId,
        override_reason: `Dispatcher confirmed crew cancellation: ${note}`,
        overridden_by: profileId,
        overridden_at: new Date().toISOString(),
        snapshot: {
          action: "cancellation_confirmed",
          crew_reason: c.cancellationReason,
          dispatcher_note: note,
        },
        is_active: false,
        user_id: profileId,
        reason: `Dispatcher confirmed crew cancellation: ${note}`,
        previous_blockers: [],
      });

      // Dismiss related alert
      await supabase.from("alerts")
        .update({ dismissed: true })
        .eq("run_id", c.tripId)
        .eq("dismissed", false);

      toast.success("Cancellation confirmed");
      onResolved();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to confirm cancellation");
    }
    setLoading(null);
  };

  const handleDispute = async (c: PendingCancellation) => {
    const note = (notes[c.tripId] ?? "").trim();
    if (!note) return;
    setLoading(`dispute-${c.tripId}`);
    try {
      // Restore trip to assigned
      await supabase.from("trip_records").update({
        status: "assigned" as any,
        cancellation_disputed: true,
        cancellation_dispatcher_note: note,
      } as any).eq("id", c.tripId);

      // Notify crew members
      for (const crewId of c.crewMemberIds) {
        const { data: profile } = await supabase.from("profiles").select("user_id").eq("id", crewId).maybeSingle();
        if (profile?.user_id) {
          await supabase.from("notifications").insert({
            user_id: profile.user_id,
            message: `Cancellation disputed by dispatch — run is still active: ${note}`,
            acknowledged: false,
          });
        }
      }

      // Insert billing_overrides record
      await supabase.from("billing_overrides").insert({
        trip_id: c.tripId,
        override_reason: `Dispatcher disputed crew cancellation: ${note}`,
        overridden_by: profileId,
        overridden_at: new Date().toISOString(),
        snapshot: {
          action: "cancellation_disputed",
          crew_reason: c.cancellationReason,
          dispatcher_note: note,
        },
        is_active: false,
        user_id: profileId,
        reason: `Dispatcher disputed crew cancellation: ${note}`,
        previous_blockers: [],
      });

      // Dismiss related alert
      await supabase.from("alerts")
        .update({ dismissed: true })
        .eq("run_id", c.tripId)
        .eq("dismissed", false);

      toast.success("Cancellation disputed — run restored");
      onResolved();
    } catch (err: any) {
      toast.error(err.message ?? "Failed to dispute cancellation");
    }
    setLoading(null);
  };

  return (
    <div className="space-y-2">
      {cancellations.map((c) => {
        const note = notes[c.tripId] ?? "";
        const hasNote = note.trim().length > 0;
        const isLoading = loading?.includes(c.tripId);
        const timeAgo = (() => {
          const diff = Math.floor((Date.now() - new Date(c.cancelledAt).getTime()) / 60000);
          if (diff < 1) return "just now";
          if (diff < 60) return `${diff}m ago`;
          return `${Math.floor(diff / 60)}h ${diff % 60}m ago`;
        })();

        return (
          <div key={c.tripId} className="rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700/50 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Crew Cancellation Pending — {c.patientName}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {c.truckName} · Requested by {c.cancelledByName} · {timeAgo}
                </p>
                <p className="text-xs text-foreground mt-1 italic">
                  "{c.cancellationReason}"
                </p>
              </div>
            </div>

            <Textarea
              placeholder="Dispatcher verification note (required)…"
              value={note}
              onChange={(e) => setNotes(prev => ({ ...prev, [c.tripId]: e.target.value }))}
              className="min-h-[60px] text-xs"
            />

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 border-emerald-400 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950"
                disabled={!hasNote || !!isLoading}
                onClick={() => handleConfirm(c)}
              >
                {loading === `confirm-${c.tripId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Confirm Cancel
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/5"
                disabled={!hasNote || !!isLoading}
                onClick={() => handleDispute(c)}
              >
                {loading === `dispute-${c.tripId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                Dispute
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
