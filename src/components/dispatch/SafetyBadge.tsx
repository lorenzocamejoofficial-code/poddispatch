import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import type { SafetyStatus } from "@/lib/safety-rules";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SafetyBadgeProps {
  status: SafetyStatus;
  reasons: string[];
  slotId?: string;
  legId?: string;
  tripRecordId?: string;
  onOverrideComplete?: () => void;
}

const CONFIG: Record<SafetyStatus, { icon: typeof ShieldCheck; color: string; label: string }> = {
  OK: { icon: ShieldCheck, color: "text-[hsl(var(--status-green))]", label: "Safe" },
  WARNING: { icon: ShieldAlert, color: "text-[hsl(var(--status-yellow))]", label: "Caution" },
  BLOCKED: { icon: ShieldX, color: "text-destructive", label: "Blocked" },
};

export function SafetyBadge({ status, reasons, slotId, legId, tripRecordId, onOverrideComplete }: SafetyBadgeProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);

  if (status === "OK") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={CONFIG.OK.color}>
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Safe — no handling concerns</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const { icon: Icon, color, label } = CONFIG[status];

  const handleOverride = async () => {
    if (!overrideReason.trim() || !confirmed) return;
    setSaving(true);
    try {
      const { data: companyId } = await supabase.rpc("get_my_company_id");
      const { data: { user } } = await supabase.auth.getUser();

      await supabase.from("safety_overrides" as any).insert({
        override_status: status,
        reasons,
        override_reason: overrideReason.trim(),
        overridden_by: user?.id,
        company_id: companyId,
        slot_id: slotId || null,
        leg_id: legId || null,
        trip_record_id: tripRecordId || null,
      });

      // Log to audit_logs
      await supabase.from("audit_logs" as any).insert({
        action: "safety_override",
        actor_user_id: user?.id,
        actor_email: user?.email,
        table_name: "safety_overrides",
        notes: `Override ${status}: ${overrideReason.trim()}`,
        new_data: { status, reasons, override_reason: overrideReason.trim() },
      });

      toast.success("Safety override recorded");
      setDialogOpen(false);
      setOverrideReason("");
      setConfirmed(false);
      onOverrideComplete?.();
    } catch (e: any) {
      toast.error(e.message || "Failed to save override");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={() => setDialogOpen(true)} className={`${color} hover:opacity-80 transition-opacity`}>
              <Icon className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-xs">
            <p className="text-xs font-semibold mb-0.5">{label}</p>
            <ul className="text-[10px] space-y-0.5">
              {reasons.map((r, i) => <li key={i}>• {r}</li>)}
            </ul>
            <p className="text-[10px] mt-1 opacity-70">Click for details</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon className={`h-5 w-5 ${color}`} />
              Safety {label}
            </DialogTitle>
            <DialogDescription>Review handling concerns before proceeding.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className={`rounded-md border p-3 space-y-1 ${
              status === "BLOCKED" ? "border-destructive/30 bg-destructive/5" : "border-[hsl(var(--status-yellow))]/30 bg-[hsl(var(--status-yellow-bg))]"
            }`}>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Concerns</p>
              {reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${color}`} />
                  <span>{r}</span>
                </div>
              ))}
            </div>

            <div className="border-t pt-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Dispatcher Override
              </p>
              <div>
                <Label>Override Reason *</Label>
                <Input
                  value={overrideReason}
                  onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Why is this safe to proceed?"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="confirm-override"
                  checked={confirmed}
                  onCheckedChange={v => setConfirmed(!!v)}
                />
                <label htmlFor="confirm-override" className="text-sm">
                  I confirm this override is appropriate and I accept responsibility
                </label>
              </div>
              <Button
                onClick={handleOverride}
                disabled={!overrideReason.trim() || !confirmed || saving}
                variant={status === "BLOCKED" ? "destructive" : "default"}
                className="w-full"
              >
                {saving ? "Saving..." : `Override ${label}`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// Inline "Patient Needs Unknown" warning component
export function PatientNeedsWarning({ missing }: { missing: string[] }) {
  if (missing.length === 0) return null;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="text-[hsl(var(--status-yellow))]">
            <AlertTriangle className="h-3.5 w-3.5" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          <p className="text-xs font-semibold mb-0.5">Patient Needs Unknown</p>
          <ul className="text-[10px] space-y-0.5">
            {missing.map((m, i) => <li key={i}>• Missing: {m}</li>)}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
