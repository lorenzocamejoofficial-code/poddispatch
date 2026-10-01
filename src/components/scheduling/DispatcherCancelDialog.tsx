import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { cancelTrip, describeCancelResult, type CancelSource } from "@/lib/cancel-trip";
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
  /** Which screen opened the dialog — recorded as cancellation_source. */
  source?: CancelSource;
  /** Paired return leg to auto-cancel with the same reason (pickup-leg cancels). */
  linkedLegId?: string | null;
  onCancelled: () => void;
}

export function DispatcherCancelDialog({
  open, onOpenChange, legId, patientName, truckId, truckName,
  selectedDate, companyId, tripId, source = "dispatcher", linkedLegId, onCancelled,
}: DispatcherCancelDialogProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [crewNotified, setCrewNotified] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!reason) { toast.error("Select a cancellation reason"); return; }
    setSubmitting(true);
    try {
      const result = await cancelTrip({
        source, reason, notes, patientName, companyId, runDate: selectedDate,
        tripId: tripId ?? null, legId: legId || null, truckId: truckId || null, truckName,
        crewNotifiedExternally: crewNotified,
      });
      let msg = describeCancelResult(patientName, result);
      if (linkedLegId) {
        const linked = await cancelTrip({
          source, reason, notes: `${notes ? `${notes} — ` : ""}auto-cancelled with linked pickup leg`,
          patientName, companyId, runDate: selectedDate, legId: linkedLegId, truckName,
        });
        msg += " · linked return leg also cancelled";
        if (linked.documentationRequired) msg += " (return leg needs cancellation form)";
      }
      toast.success(msg);
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
