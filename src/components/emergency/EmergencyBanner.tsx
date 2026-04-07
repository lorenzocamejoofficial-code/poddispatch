import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Undo2 } from "lucide-react";

interface EmergencyBannerProps {
  patientName: string;
  truckName: string;
  upgradeAt: string;
  canUndo: boolean;
  secondsRemaining: number;
  loading: boolean;
  onUndo: () => Promise<string | null>;
  onResolve: () => void;
}

export function EmergencyBanner({
  patientName, truckName, upgradeAt, canUndo, secondsRemaining,
  loading, onUndo, onResolve,
}: EmergencyBannerProps) {
  const [undoOpen, setUndoOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const elapsed = upgradeAt
    ? Math.floor((Date.now() - new Date(upgradeAt).getTime()) / 1000)
    : 0;
  const elapsedMin = Math.floor(elapsed / 60);
  const elapsedSec = elapsed % 60;

  const handleUndoConfirm = async () => {
    const result = await onUndo();
    if (result) {
      setUndoOpen(false);
      setTyped("");
    }
  };

  return (
    <>
      <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive animate-pulse shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-destructive">
              EMERGENCY ACTIVE — {patientName} — {truckName}
            </p>
            <p className="text-xs text-destructive/80">
              {elapsedMin}:{String(elapsedSec).padStart(2, "0")} since upgrade
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canUndo && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive text-xs gap-1.5"
              onClick={() => { setUndoOpen(true); setTyped(""); }}
              disabled={loading}
            >
              <Undo2 className="h-3.5 w-3.5" />
              Was this accidental? Undo ({secondsRemaining}s)
            </Button>
          )}
          <Button
            size="sm"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs gap-1.5"
            onClick={onResolve}
            disabled={loading}
          >
            Resolve Emergency
          </Button>
        </div>
      </div>

      {/* Undo confirmation dialog */}
      <Dialog open={undoOpen} onOpenChange={setUndoOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">Confirm Undo — Type CANCEL</DialogTitle>
          </DialogHeader>
          <Input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder="Type CANCEL"
            className="font-mono"
            autoComplete="off"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setUndoOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={typed !== "CANCEL" || loading}
              onClick={handleUndoConfirm}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Confirm Undo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
