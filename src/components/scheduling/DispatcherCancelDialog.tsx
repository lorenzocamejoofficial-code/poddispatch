import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit-logger";
import { toast } from "sonner";

const CANCEL_REASONS = [
  "Facility Cancelled",
  "Patient Cancelled",
  "Duplicate Run",
  "No Show",
  "Operational Reason",
  "Other",
];

interface DispatcherCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  legId: string;
  patientName: string;
  truckId: string;
  truckName: string;
  selectedDate: string;
  companyId: string | null;
  tripId?: string | null;
  onCancelled: () => void;
}

export function DispatcherCancelDialog({
  open, onOpenChange, legId, patientName, truckId, truckName,
  selectedDate, companyId, tripId, onCancelled,
}: DispatcherCancelDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [crewNotified, setCrewNotified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) { toast.error("Select a cancellation reason"); return; }
    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      const now = new Date().toISOString();

      // Determine pcr_status to set
      let newPcrStatus = "not_started";
      let existingTripId = tripId;

      if (existingTripId) {
        // Check if PCR was started
        const { data: trip } = await supabase
          .from("trip_records" as any)
          .select("pcr_status")
          .eq("id", existingTripId)
          .maybeSingle();
        const pcrStatus = (trip as any)?.pcr_status;
        if (pcrStatus === "in_progress" || pcrStatus === "submitted") {
          newPcrStatus = "cancelled_with_pcr";
        }

        // Update the trip record
        await supabase.from("trip_records" as any).update({
          status: "cancelled",
          cancellation_reason: `${reason}${notes ? ` — ${notes}` : ""}`,
          cancelled_by: userId,
          cancelled_at: now,
          cancellation_source: "dispatcher",
          pcr_status: newPcrStatus,
        } as any).eq("id", existingTripId);
      } else {
        // Create a trip record in cancelled state
        const { data: newTrip } = await supabase.from("trip_records" as any).insert({
          leg_id: legId,
          truck_id: truckId,
          company_id: companyId,
          run_date: selectedDate,
          status: "cancelled",
          cancellation_reason: `${reason}${notes ? ` — ${notes}` : ""}`,
          cancelled_by: userId,
          cancelled_at: now,
          cancellation_source: "dispatcher",
          pcr_status: "not_started",
          trip_type: "dialysis",
        } as any).select("id").single();
        existingTripId = (newTrip as any)?.id;
      }

      // Update truck_run_slots status to cancelled
      await supabase.from("truck_run_slots" as any)
        .update({ status: "cancelled" } as any)
        .eq("leg_id", legId)
        .eq("run_date", selectedDate);

      // Send notifications to crew members on this truck
      if (companyId) {
        const { data: crewRow } = await supabase
          .from("crews")
          .select("member1_id, member2_id, member3_id")
          .eq("truck_id", truckId)
          .eq("active_date", selectedDate)
          .maybeSingle();

        if (crewRow) {
          // Get user_ids from profile_ids
          const profileIds = [crewRow.member1_id, crewRow.member2_id, (crewRow as any).member3_id].filter(Boolean);
          if (profileIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles" as any)
              .select("user_id")
              .in("id", profileIds);
            const crewUserIds = (profiles ?? []).map((p: any) => p.user_id).filter(Boolean);
            if (crewUserIds.length > 0) {
              await supabase.from("notifications").insert(
                crewUserIds.map((uid: string) => ({
                  user_id: uid,
                  message: `Run cancelled by dispatch — ${patientName} — ${reason}`,
                  notification_type: "cancellation",
                }))
              );
            }
          }
        }

        // Notify other dispatchers and owners
        const { data: admins } = await supabase
          .from("company_memberships")
          .select("user_id")
          .eq("company_id", companyId)
          .in("role", ["dispatcher", "owner"] as any);
        const adminUserIds = (admins ?? [])
          .map((a: any) => a.user_id)
          .filter((uid: string) => uid !== userId);
        if (adminUserIds.length > 0) {
          await supabase.from("notifications").insert(
            adminUserIds.map((uid: string) => ({
              user_id: uid,
              message: `Run cancelled by dispatch — ${patientName} on ${truckName} — ${reason}${notes ? ` — ${notes}` : ""}`,
              notification_type: "cancellation",
            }))
          );
        }

        // Insert alert for dispatch board
        await supabase.from("alerts").insert({
          message: `Run cancelled by dispatch: ${patientName} — ${reason}`,
          severity: "yellow",
          truck_id: truckId,
          run_id: existingTripId,
          company_id: companyId,
          dismissed: false,
        });
      }

      // Audit log
      logAuditEvent({
        action: "dispatcher_cancellation",
        tableName: "trip_records",
        recordId: existingTripId ?? legId,
        notes: `Dispatcher cancelled run for ${patientName} — Reason: ${reason}${notes ? ` — Notes: ${notes}` : ""}${crewNotified ? " — Crew notified externally" : ""}`,
      });

      toast.success(`Run cancelled — ${patientName}`);
      onOpenChange(false);
      setReason("");
      setNotes("");
      setCrewNotified(false);
      onCancelled();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel run");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel Run — {patientName}</DialogTitle>
          <DialogDescription>This will immediately cancel this run and notify the crew.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Cancellation Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select reason…" /></SelectTrigger>
              <SelectContent>
                {CANCEL_REASONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Additional Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional additional details…"
              rows={3}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="crew-notified"
              checked={crewNotified}
              onCheckedChange={(v) => setCrewNotified(v === true)}
            />
            <Label htmlFor="crew-notified" className="text-sm text-muted-foreground cursor-pointer">
              Crew has been notified (via phone/radio)
            </Label>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Back</Button>
          <Button variant="destructive" disabled={!reason || submitting} onClick={handleSubmit}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
            Cancel Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
