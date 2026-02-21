import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ConfirmActionDialogProps {
  trigger: React.ReactNode;
  title: string;
  description: string;
  summary?: React.ReactNode;
  confirmWord?: string; // e.g. "CONFIRM" or "OVERRIDE"
  requireReason?: boolean;
  onConfirm: (reason?: string) => void | Promise<void>;
  destructive?: boolean;
}

export function ConfirmActionDialog({
  trigger,
  title,
  description,
  summary,
  confirmWord = "CONFIRM",
  requireReason = false,
  onConfirm,
  destructive = true,
}: ConfirmActionDialogProps) {
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const isValid =
    typed === confirmWord && (!requireReason || reason.trim().length > 0);

  const handleConfirm = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      await onConfirm(reason.trim() || undefined);
    } finally {
      setLoading(false);
      setTyped("");
      setReason("");
      setOpen(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setTyped(""); setReason(""); } }}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>

        {summary && <div className="text-sm">{summary}</div>}

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Type <span className="font-mono font-bold text-foreground">{confirmWord}</span> to proceed
            </Label>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmWord}
              className="font-mono"
              autoComplete="off"
            />
          </div>

          {requireReason && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Reason (required)
              </Label>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this action being taken?"
                rows={2}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!isValid || loading}
            onClick={(e) => { e.preventDefault(); handleConfirm(); }}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {loading ? "Processing..." : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
