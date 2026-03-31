import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const KICKBACK_REASONS = [
  "Missing or incorrect odometer readings",
  "Incomplete vitals",
  "Medical necessity criteria not selected",
  "Times out of sequence",
  "Missing patient signature",
  "Incorrect transport information",
  "Other",
] as const;

interface KickbackDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  patientName?: string;
  onKickedBack: () => void;
}

export function KickbackDialog({ open, onOpenChange, tripId, patientName, onKickedBack }: KickbackDialogProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    );
  };

  const handleSubmit = async () => {
    if (selectedReasons.length === 0) {
      toast.error("Select at least one reason");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("trip_records")
        .update({
          pcr_status: "kicked_back",
          kickback_reasons: selectedReasons,
          kickback_note: note.trim() || null,
          kicked_back_by: user?.id ?? null,
          kicked_back_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", tripId);

      if (error) throw error;

      toast.success("PCR kicked back to crew for corrections");
      setSelectedReasons([]);
      setNote("");
      onOpenChange(false);
      onKickedBack();
    } catch (err: any) {
      toast.error(`Failed to kick back PCR: ${err.message}`);
    }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setSelectedReasons([]); setNote(""); } onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-destructive" />
            Kick Back to Crew
          </DialogTitle>
          <DialogDescription>
            {patientName ? `Return ${patientName}'s PCR for corrections.` : "Return this PCR to the crew for corrections."} Select the reasons and optionally add a note.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reasons (select all that apply)
            </Label>
            {KICKBACK_REASONS.map(reason => (
              <label key={reason} className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  checked={selectedReasons.includes(reason)}
                  onCheckedChange={() => toggleReason(reason)}
                  className="mt-0.5"
                />
                <span className="text-sm text-foreground">{reason}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Additional Note (optional)</Label>
            <Textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Add any additional context for the crew…"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={selectedReasons.length === 0 || submitting}
            onClick={handleSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
            Kick Back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
