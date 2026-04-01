import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface FlagOverrideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flagReason: string;
  onOverride: (reason: string) => Promise<void>;
}

export function FlagOverrideDialog({ open, onOpenChange, flagReason, onOverride }: FlagOverrideDialogProps) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    setSaving(true);
    await onOverride(reason.trim());
    setReason("");
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) setReason(""); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override QA Flag</DialogTitle>
          <DialogDescription className="text-xs">{flagReason}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Override Reason (required)</Label>
            <Textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain why this flag is being overridden…" />
          </div>
          <Button className="w-full" onClick={handleSubmit} disabled={saving || !reason.trim()}>
            {saving ? "Saving…" : "Confirm Override"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
