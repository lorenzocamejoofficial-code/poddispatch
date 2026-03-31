import { useState, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight, Check, Clock, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { LegDisplay, TruckOption } from "@/hooks/useSchedulingStore";

const MIN_GAP_MINUTES = 45;

function timeToMinutes(t: string | null): number | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

interface RunReassignmentDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  leg: LegDisplay | null;
  sourceTruckId: string | null;
  targetTruckId: string;
  targetTruckName: string;
  /** All legs currently on the target truck */
  targetTruckLegs: LegDisplay[];
  selectedDate: string;
  onComplete: () => void;
  onLogChange?: (params: {
    change_type: string;
    change_summary: string;
    old_value?: string | null;
    new_value?: string | null;
    truck_id?: string | null;
    leg_id?: string | null;
  }) => Promise<void>;
}

export function RunReassignmentDialog({
  open, onOpenChange, leg, sourceTruckId, targetTruckId, targetTruckName,
  targetTruckLegs, selectedDate, onComplete, onLogChange,
}: RunReassignmentDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pickupTime, setPickupTime] = useState("");
  const [processing, setProcessing] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open && leg) {
      setStep(1);
      setPickupTime(leg.pickup_time ?? "");
    }
  }, [open, leg]);

  const conflicts = useMemo(() => {
    if (!leg) return [];
    const movingMins = timeToMinutes(step >= 2 ? pickupTime : leg.pickup_time);
    if (movingMins === null) return [];
    return targetTruckLegs
      .filter(tl => tl.id !== leg.id)
      .filter(tl => {
        const tlMins = timeToMinutes(tl.pickup_time);
        if (tlMins === null) return false;
        return Math.abs(tlMins - movingMins) < MIN_GAP_MINUTES;
      });
  }, [leg, targetTruckLegs, pickupTime, step]);

  const handleConfirm = async () => {
    if (!leg) return;
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: companyId } = await supabase.rpc("get_my_company_id");

      // 1. Stop any active hold timer on this run
      const { data: activeTimers } = await supabase
        .from("hold_timers")
        .select("id")
        .eq("is_active", true)
        .in("trip_id", await (async () => {
          const { data: trips } = await supabase
            .from("trip_records")
            .select("id")
            .eq("leg_id", leg.id)
            .eq("run_date", selectedDate);
          return (trips ?? []).map(t => t.id);
        })());

      if (activeTimers && activeTimers.length > 0) {
        await supabase
          .from("hold_timers")
          .update({ is_active: false, resolved_at: new Date().toISOString() } as any)
          .in("id", activeTimers.map(t => t.id));
      }

      // 2. Move the slot to the new truck
      if (sourceTruckId) {
        await supabase
          .from("truck_run_slots")
          .update({
            truck_id: targetTruckId,
            slot_order: targetTruckLegs.length,
          } as any)
          .eq("leg_id", leg.id)
          .eq("run_date", selectedDate);
      } else {
        await supabase.from("truck_run_slots").insert({
          truck_id: targetTruckId,
          leg_id: leg.id,
          run_date: selectedDate,
          slot_order: targetTruckLegs.length,
          company_id: companyId,
        } as any);
      }

      // 3. Update trip_records truck_id if exists
      await supabase
        .from("trip_records")
        .update({ truck_id: targetTruckId, updated_at: new Date().toISOString() } as any)
        .eq("leg_id", leg.id)
        .eq("run_date", selectedDate);

      // 4. Update pickup time if changed
      const timeChanged = pickupTime !== (leg.pickup_time ?? "");
      if (timeChanged && pickupTime) {
        // Update on scheduling_leg or leg_exception
        const { data: existing } = await supabase
          .from("leg_exceptions")
          .select("id")
          .eq("scheduling_leg_id", leg.id)
          .eq("run_date", selectedDate)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("leg_exceptions")
            .update({ pickup_time: pickupTime } as any)
            .eq("id", existing.id);
        } else {
          await supabase
            .from("leg_exceptions")
            .insert({
              scheduling_leg_id: leg.id,
              run_date: selectedDate,
              pickup_time: pickupTime,
            } as any);
        }

        // Also update trip_records scheduled_pickup_time
        await supabase
          .from("trip_records")
          .update({ scheduled_pickup_time: pickupTime, updated_at: new Date().toISOString() } as any)
          .eq("leg_id", leg.id)
          .eq("run_date", selectedDate);
      }

      // 5. Audit log
      await supabase.from("audit_logs").insert({
        action: "run_reassigned",
        actor_user_id: user?.id,
        actor_email: user?.email,
        table_name: "truck_run_slots",
        record_id: leg.id,
        notes: `Reassigned ${leg.patient_name} from ${sourceTruckId ? "another truck" : "pool"} to ${targetTruckName}${timeChanged ? ` (pickup time changed to ${pickupTime})` : ""}`,
        old_data: { source_truck_id: sourceTruckId, pickup_time: leg.pickup_time },
        new_data: { target_truck_id: targetTruckId, pickup_time: timeChanged ? pickupTime : leg.pickup_time },
      } as any);

      // 6. Log schedule change for crew notifications
      if (onLogChange) {
        if (sourceTruckId) {
          await onLogChange({
            change_type: "run_removed",
            change_summary: `${leg.patient_name} (${leg.pickup_time ?? "TBD"}) reassigned away from this truck`,
            truck_id: sourceTruckId,
            leg_id: leg.id,
          });
        }
        await onLogChange({
          change_type: "run_added",
          change_summary: `${leg.patient_name} (${pickupTime || leg.pickup_time || "TBD"}) reassigned to ${targetTruckName}`,
          truck_id: targetTruckId,
          leg_id: leg.id,
        });
        if (timeChanged) {
          await onLogChange({
            change_type: "time_changed",
            change_summary: `Pickup time changed from ${leg.pickup_time ?? "none"} to ${pickupTime} for ${leg.patient_name}`,
            old_value: leg.pickup_time ?? null,
            new_value: pickupTime,
            truck_id: targetTruckId,
            leg_id: leg.id,
          });
        }
      }

      toast.success(`${leg.patient_name} reassigned to ${targetTruckName}`);
      onOpenChange(false);
      onComplete();
    } catch (err) {
      console.error("Reassignment error:", err);
      toast.error("Reassignment failed");
    } finally {
      setProcessing(false);
    }
  };

  if (!leg) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Reassign Run
          </DialogTitle>
          <DialogDescription>
            Moving <span className="font-semibold text-foreground">{leg.patient_name}</span> to{" "}
            <span className="font-semibold text-foreground">{targetTruckName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {[1, 2, 3].map(s => (
            <div key={s} className={`flex items-center gap-1 ${step >= s ? "text-primary font-semibold" : ""}`}>
              <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                step > s ? "bg-primary text-primary-foreground border-primary" :
                step === s ? "border-primary text-primary" :
                "border-muted-foreground/30"
              }`}>
                {step > s ? <Check className="h-3 w-3" /> : s}
              </span>
              <span className="hidden sm:inline">
                {s === 1 ? "Conflict Check" : s === 2 ? "Pickup Time" : "Confirm"}
              </span>
            </div>
          ))}
        </div>

        {/* Step 1: Conflict check */}
        {step === 1 && (
          <div className="space-y-3 py-2">
            <p className="text-sm font-medium">Runs on {targetTruckName} for today:</p>
            {targetTruckLegs.filter(tl => tl.id !== leg.id).length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No existing runs — no conflicts.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {targetTruckLegs.filter(tl => tl.id !== leg.id).map(tl => {
                  const isConflict = conflicts.some(c => c.id === tl.id);
                  return (
                    <div key={tl.id} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                      isConflict ? "border-[hsl(var(--status-yellow))]/50 bg-[hsl(var(--status-yellow-bg))]" : ""
                    }`}>
                      <span className="font-mono text-xs text-muted-foreground w-12 shrink-0">{tl.pickup_time ?? "—"}</span>
                      <span className="truncate">{tl.patient_name}</span>
                      <span className="text-xs text-muted-foreground capitalize">{tl.trip_type}</span>
                      {isConflict && (
                        <Badge variant="outline" className="ml-auto shrink-0 text-[hsl(var(--status-yellow))] border-[hsl(var(--status-yellow))]/40 text-[9px]">
                          <AlertTriangle className="h-2.5 w-2.5 mr-0.5" /> &lt;45min
                        </Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {conflicts.length > 0 && (
              <div className="rounded-md border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-3 text-sm text-foreground flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-yellow))] shrink-0 mt-0.5" />
                <span>
                  <strong>{conflicts.length} run{conflicts.length > 1 ? "s" : ""}</strong> scheduled within 45 minutes of this run.
                  You can proceed or adjust the pickup time in the next step.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Pickup time */}
        {step === 2 && (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Pickup Time</Label>
              <Input
                type="time"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-40"
              />
            </div>
            {pickupTime && conflicts.length > 0 && (
              <div className="rounded-md border border-[hsl(var(--status-yellow))]/40 bg-[hsl(var(--status-yellow-bg))] p-3 text-sm flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-[hsl(var(--status-yellow))] shrink-0 mt-0.5" />
                <span>This time still conflicts with {conflicts.length} other run{conflicts.length > 1 ? "s" : ""} on {targetTruckName}.</span>
              </div>
            )}
            {pickupTime !== (leg.pickup_time ?? "") && (
              <p className="text-xs text-muted-foreground">
                Original time: <span className="font-mono">{leg.pickup_time ?? "not set"}</span>{" "}
                <ArrowRight className="inline h-3 w-3" />{" "}
                <span className="font-mono font-semibold text-foreground">{pickupTime || "not set"}</span>
              </p>
            )}
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-3 py-2">
            <div className="rounded-md border bg-muted/50 p-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Patient</span>
                <span className="font-medium">{leg.patient_name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Target Truck</span>
                <span className="font-medium">{targetTruckName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pickup Time</span>
                <span className="font-mono font-medium">{pickupTime || "not set"}</span>
              </div>
              {pickupTime !== (leg.pickup_time ?? "") && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Time changed</span>
                  <span className="text-primary font-medium">
                    {leg.pickup_time ?? "none"} → {pickupTime || "none"}
                  </span>
                </div>
              )}
              {conflicts.length > 0 && (
                <div className="flex items-center gap-1.5 text-[hsl(var(--status-yellow))] text-xs mt-1">
                  <AlertTriangle className="h-3 w-3" />
                  {conflicts.length} time conflict{conflicts.length > 1 ? "s" : ""} acknowledged
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep((s) => (s - 1) as 1 | 2)}>
              Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep((s) => (s + 1) as 2 | 3)}>
              Continue
            </Button>
          ) : (
            <Button onClick={handleConfirm} disabled={processing}>
              {processing ? "Reassigning…" : "Confirm Reassignment"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
