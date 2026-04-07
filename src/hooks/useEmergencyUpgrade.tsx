import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface EmergencyState {
  isActive: boolean;
  originalTripId: string | null;
  emergencyTripId: string | null;
  upgradeAt: string | null;
  canUndo: boolean;
  secondsRemaining: number;
  isVoided: boolean;
  resolution: string | null;
}

const UNDO_WINDOW_SECONDS = 120;

export function useEmergencyUpgrade(companyId: string | null) {
  const { user } = useAuth();
  const [state, setState] = useState<EmergencyState>({
    isActive: false,
    originalTripId: null,
    emergencyTripId: null,
    upgradeAt: null,
    canUndo: false,
    secondsRemaining: 0,
    isVoided: false,
    resolution: null,
  });
  const [loading, setLoading] = useState(false);

  // Check for active emergency on mount
  const checkActiveEmergency = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from("trip_records" as any)
      .select("id, emergency_upgrade_at, emergency_pcr_trip_id, emergency_upgrade_voided, emergency_upgrade_resolution")
      .eq("company_id", companyId)
      .not("emergency_upgrade_at", "is", null)
      .is("emergency_upgrade_resolved_at", null)
      .eq("emergency_upgrade_voided", false)
      .eq("run_date", new Date().toISOString().split("T")[0])
      .limit(1);

    if (data && data.length > 0) {
      const trip = data[0] as any;
      const upgradeAt = trip.emergency_upgrade_at;
      const elapsed = (Date.now() - new Date(upgradeAt).getTime()) / 1000;
      const remaining = Math.max(0, UNDO_WINDOW_SECONDS - elapsed);
      setState({
        isActive: true,
        originalTripId: trip.id,
        emergencyTripId: trip.emergency_pcr_trip_id,
        upgradeAt,
        canUndo: remaining > 0,
        secondsRemaining: Math.ceil(remaining),
        isVoided: false,
        resolution: null,
      });
    }
  }, [companyId]);

  useEffect(() => {
    checkActiveEmergency();
  }, [checkActiveEmergency]);

  // Countdown timer
  useEffect(() => {
    if (!state.isActive || !state.canUndo) return;
    const iv = setInterval(() => {
      setState(prev => {
        if (!prev.upgradeAt) return prev;
        const elapsed = (Date.now() - new Date(prev.upgradeAt).getTime()) / 1000;
        const remaining = Math.max(0, UNDO_WINDOW_SECONDS - elapsed);
        if (remaining <= 0) return { ...prev, canUndo: false, secondsRemaining: 0 };
        return { ...prev, secondsRemaining: Math.ceil(remaining) };
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [state.isActive, state.canUndo]);

  const triggerUpgrade = useCallback(async (tripId: string, patientName: string, truckName: string, truckId: string) => {
    if (!user?.id || !companyId) return null;
    setLoading(true);

    try {
      // Step 1: Get original trip data
      const { data: originalTrip, error: fetchErr } = await supabase
        .from("trip_records" as any)
        .select("*")
        .eq("id", tripId)
        .single();

      if (fetchErr || !originalTrip) throw new Error("Could not load trip");
      const t = originalTrip as any;

      // Step 2: Mark original trip
      const upgradeTime = new Date().toISOString();
      await supabase.from("trip_records" as any).update({
        emergency_upgrade_at: upgradeTime,
        status: "emergency_upgraded",
        pcr_status: t.pcr_status === "in_progress" ? "interrupted" : t.pcr_status,
      } as any).eq("id", tripId);

      // Step 3: Create emergency PCR trip
      const { data: newTrip, error: insertErr } = await supabase
        .from("trip_records" as any)
        .insert({
          is_emergency_pcr: true,
          original_trip_id: tripId,
          pcr_type: "emergency",
          status: "in_progress",
          pcr_status: "in_progress",
          company_id: t.company_id,
          truck_id: t.truck_id,
          crew_id: t.crew_id,
          leg_id: t.leg_id,
          slot_id: t.slot_id,
          patient_id: t.patient_id,
          run_date: t.run_date,
          trip_type: "emergency",
          pickup_location: t.pickup_location,
          destination_location: t.destination_location,
          scheduled_pickup_time: t.scheduled_pickup_time,
          origin_type: t.origin_type,
          destination_type: t.destination_type,
          // Copy already-entered timestamps
          dispatch_time: t.dispatch_time,
          at_scene_time: t.at_scene_time,
          patient_contact_time: t.patient_contact_time,
          arrived_pickup_at: t.arrived_pickup_at,
          // Copy clinical data
          vitals_json: t.vitals_json,
          assessment_json: t.assessment_json,
          narrative: t.narrative,
          // Copy patient info
          attending_medic_id: t.attending_medic_id,
          attending_medic_name: t.attending_medic_name,
          attending_medic_cert: t.attending_medic_cert,
          odometer_at_scene: t.odometer_at_scene,
        } as any)
        .select("id")
        .single();

      if (insertErr || !newTrip) throw new Error("Failed to create emergency trip");
      const emergencyTripId = (newTrip as any).id;

      // Link emergency PCR back to original
      await supabase.from("trip_records" as any).update({
        emergency_pcr_trip_id: emergencyTripId,
      } as any).eq("id", tripId);

      // Step 4: Fire dispatch alerts
      const timeLabel = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const alertMsg = `🚨 EMERGENCY UPGRADE — Unit ${truckName} — Patient ${patientName} — Upgraded at ${timeLabel} — Emergency PCR in progress`;

      await Promise.all([
        supabase.from("alerts").insert({
          severity: "red",
          message: alertMsg,
          dismissed: false,
          company_id: companyId,
          truck_id: truckId,
        }),
        supabase.from("operational_alerts" as any).insert({
          alert_type: "EMERGENCY_UPGRADE",
          status: "open",
          company_id: companyId,
          truck_id: truckId,
          leg_id: t.leg_id,
          run_date: t.run_date,
          note: alertMsg,
        }),
      ]);

      // Step 5: Notify dispatchers and owners
      const { data: recipients } = await supabase
        .from("company_memberships")
        .select("user_id")
        .eq("company_id", companyId)
        .in("role", ["dispatcher", "owner"] as any);

      if (recipients?.length) {
        await supabase.from("notifications").insert(
          recipients.map(r => ({
            user_id: r.user_id,
            message: alertMsg,
            notification_type: "emergency",
          }))
        );
      }

      setState({
        isActive: true,
        originalTripId: tripId,
        emergencyTripId: emergencyTripId,
        upgradeAt: upgradeTime,
        canUndo: true,
        secondsRemaining: UNDO_WINDOW_SECONDS,
        isVoided: false,
        resolution: null,
      });

      toast.success("Emergency upgrade confirmed — opening emergency PCR");
      return emergencyTripId;
    } catch (err: any) {
      toast.error(err.message || "Emergency upgrade failed");
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id, companyId]);

  const undoUpgrade = useCallback(async () => {
    if (!state.originalTripId || !state.emergencyTripId || !user?.id || !state.canUndo) return;
    setLoading(true);

    try {
      const timeLabel = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      // Get truck info for alert
      const { data: origTrip } = await supabase
        .from("trip_records" as any)
        .select("truck_id, trucks:trucks!trip_records_truck_id_fkey(name)")
        .eq("id", state.originalTripId)
        .single();
      const truckName = (origTrip as any)?.trucks?.name ?? "Unknown";

      // Void the emergency PCR
      await supabase.from("trip_records" as any).update({
        status: "voided",
        pcr_status: "voided",
      } as any).eq("id", state.emergencyTripId);

      // Restore original trip
      await supabase.from("trip_records" as any).update({
        emergency_upgrade_voided: true,
        emergency_upgrade_voided_at: new Date().toISOString(),
        emergency_upgrade_voided_by: user.id,
        status: "in_progress",
        pcr_status: "in_progress",
      } as any).eq("id", state.originalTripId);

      // Update dispatch alert
      const voidMsg = `⚠️ FALSE TRIGGER VOIDED — Unit ${truckName} — Voided by crew at ${timeLabel} — No emergency`;
      await supabase.from("alerts")
        .update({ message: voidMsg, severity: "yellow", dismissed: false })
        .eq("truck_id", (origTrip as any)?.truck_id)
        .eq("severity", "red")
        .ilike("message", "%EMERGENCY UPGRADE%");

      setState(prev => ({
        ...prev,
        isActive: false,
        canUndo: false,
        isVoided: true,
      }));

      toast.success("Emergency upgrade voided — returning to original PCR");
      return state.originalTripId;
    } catch (err: any) {
      toast.error(err.message || "Failed to void emergency upgrade");
      return null;
    } finally {
      setLoading(false);
    }
  }, [state, user?.id]);

  const resolveEmergency = useCallback(async (
    resolutionType: string,
    details: Record<string, any>
  ) => {
    if (!state.originalTripId || !state.emergencyTripId || !user?.id || !companyId) return;
    setLoading(true);

    try {
      const resolutionData = JSON.stringify({ type: resolutionType, ...details });
      const now = new Date().toISOString();

      // Get truck info
      const { data: origTrip } = await supabase
        .from("trip_records" as any)
        .select("truck_id, trucks:trucks!trip_records_truck_id_fkey(name)")
        .eq("id", state.originalTripId)
        .single();
      const truckName = (origTrip as any)?.trucks?.name ?? "Unknown";
      const timeLabel = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

      // Determine billing recommendation
      let billingRec = "";
      let alertSeverity = "green";
      let reactivateOriginal = false;

      switch (resolutionType) {
        case "transfer_of_care":
          billingRec = "Medicare may allow billing for emergency response without completed transport — biller must review Chapter 15 Section 10.3 — flagged for manual review";
          alertSeverity = "yellow";
          break;
        case "patient_stabilized":
          billingRec = "Two billing events on one transport — Medicare generally does not allow billing for both — biller must determine which event to bill — flagged for manual review";
          reactivateOriginal = true;
          break;
        case "no_emergency":
        case "accidental_after_window":
          billingRec = "Emergency assessed and downgraded — bill as standard non-emergency transport — no emergency claim should be generated";
          reactivateOriginal = true;
          break;
      }

      // Update original trip
      await supabase.from("trip_records" as any).update({
        emergency_upgrade_resolved_at: now,
        emergency_upgrade_resolution: resolutionData,
        emergency_billing_recommendation: billingRec,
        ...(reactivateOriginal ? { status: "in_progress", pcr_status: "in_progress" } : {}),
      } as any).eq("id", state.originalTripId);

      // Close emergency PCR
      const emergencyNote = resolutionType === "no_emergency" || resolutionType === "accidental_after_window"
        ? "Clinical assessment found no emergency"
        : undefined;
      await supabase.from("trip_records" as any).update({
        pcr_status: "completed",
        status: "completed",
        emergency_billing_recommendation: billingRec,
        ...(emergencyNote ? { necessity_notes: emergencyNote } : {}),
      } as any).eq("id", state.emergencyTripId);

      // Update dispatch alert
      const resolveMsg = `✅ EMERGENCY RESOLVED — ${resolutionType.replace(/_/g, " ")} — Unit ${truckName} — ${timeLabel}`;
      await supabase.from("alerts")
        .update({ message: resolveMsg, severity: alertSeverity, dismissed: false })
        .eq("truck_id", (origTrip as any)?.truck_id)
        .eq("severity", "red")
        .ilike("message", "%EMERGENCY%");

      setState(prev => ({
        ...prev,
        isActive: false,
        canUndo: false,
        resolution: resolutionType,
      }));

      toast.success("Emergency resolved");
      return reactivateOriginal ? state.originalTripId : null;
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve emergency");
      return null;
    } finally {
      setLoading(false);
    }
  }, [state, user?.id, companyId]);

  return {
    ...state,
    loading,
    triggerUpgrade,
    undoUpgrade,
    resolveEmergency,
    checkActiveEmergency,
  };
}
