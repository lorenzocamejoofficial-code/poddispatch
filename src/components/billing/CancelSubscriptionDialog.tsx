import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const REASONS: Array<{ value: string; label: string }> = [
  { value: "too_expensive", label: "Too expensive" },
  { value: "switched_competitor", label: "Switching to another platform" },
  { value: "going_out_of_business", label: "Closing or pausing the business" },
  { value: "missing_feature", label: "Missing a feature we need" },
  { value: "too_complex", label: "Too complex for our team" },
  { value: "other", label: "Other" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyId: string;
  status: string;
  onCanceled: () => void;
}

export function CancelSubscriptionDialog({ open, onOpenChange, companyId, status, onCanceled }: Props) {
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isTrial = status === "trial" || status === "pending";
  const requiredConfirm = "CANCEL";

  const reset = () => {
    setReason(""); setFeedback(""); setConfirmText("");
  };

  const submit = async () => {
    if (!reason) { toast.error("Please pick a reason"); return; }
    if (confirmText.trim().toUpperCase() !== requiredConfirm) {
      toast.error(`Type ${requiredConfirm} to confirm`); return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("cancel-subscription", {
      body: { company_id: companyId, reason, feedback: feedback.trim() || null },
    });
    setSubmitting(false);
    if (error || !data?.ok) {
      toast.error("Cancellation failed", { description: error?.message ?? data?.error ?? "Unknown error" });
      return;
    }
    toast.success(isTrial ? "Trial cancelled" : "Cancellation scheduled", {
      description: data.message ?? undefined,
    });
    reset();
    onOpenChange(false);
    onCanceled();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel subscription</DialogTitle>
          <DialogDescription>
            {isTrial
              ? "Your trial will end immediately. No charges have been made and none will be."
              : "Your subscription will stay active through the end of the current billing period. You will not be charged again. Read-only access continues for 90 days afterward so you can export records."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Why are you cancelling?</Label>
            <RadioGroup value={reason} onValueChange={setReason}>
              {REASONS.map((r) => (
                <div key={r.value} className="flex items-center gap-2">
                  <RadioGroupItem value={r.value} id={`r-${r.value}`} />
                  <Label htmlFor={`r-${r.value}`} className="text-sm font-normal cursor-pointer">{r.label}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback">Anything else? (optional)</Label>
            <Textarea
              id="feedback"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              maxLength={2000}
              placeholder="What could we have done better?"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">Type <span className="font-mono font-bold">CANCEL</span> to confirm</Label>
            <Input
              id="confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Keep subscription
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? "Cancelling…" : isTrial ? "Cancel trial" : "Cancel at period end"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}