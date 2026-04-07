import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";

interface EmergencyUpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientName: string;
  truckName: string;
  loading: boolean;
  onConfirm: () => void;
}

export function EmergencyUpgradeDialog({
  open, onOpenChange, patientName, truckName, loading, onConfirm,
}: EmergencyUpgradeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Upgrade this run to emergency?
          </DialogTitle>
          <DialogDescription className="text-sm">
            This will immediately alert dispatch and open an emergency PCR.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 space-y-1">
          <p className="text-sm font-medium text-foreground">Patient: {patientName}</p>
          <p className="text-sm text-muted-foreground">Truck: {truckName}</p>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading} className="gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Emergency
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
