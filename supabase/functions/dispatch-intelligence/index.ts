import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ── Escalation thresholds (minutes) ──
const YELLOW_MIN = 15;
const ORANGE_MIN = 25;
const RED_MIN = 35;

function computeLevel(elapsedMinutes: number): string {
  if (elapsedMinutes >= RED_MIN) return "red";
  if (elapsedMinutes >= ORANGE_MIN) return "orange";
  if (elapsedMinutes >= YELLOW_MIN) return "yellow";
  return "green";
}

// ── Escalate all active hold timers for a company ──
async function escalateTimers(companyId: string) {
  const { data: timers } = await admin
    .from("hold_timers")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true);

  if (!timers || timers.length === 0) return { escalated: 0, alerts_created: 0 };

  let escalated = 0;
  let alertsCreated = 0;
  const now = new Date();

  for (const timer of timers) {
    const startedAt = new Date(timer.started_at);
    const elapsedMs = now.getTime() - startedAt.getTime();
    const elapsedMin = elapsedMs / 60000;
    const newLevel = computeLevel(elapsedMin);

    if (newLevel !== timer.current_level) {
      await admin
        .from("hold_timers")
        .update({ current_level: newLevel, last_escalated_at: now.toISOString() })
        .eq("id", timer.id);
      escalated++;

      // On transition to red, create operational alert (only once)
      if (newLevel === "red" && timer.current_level !== "red") {
        // Check if we already created an alert for this timer
        const { data: existing } = await admin
          .from("operational_alerts")
          .select("id")
          .eq("leg_id", timer.trip_id) // using trip_id as reference
          .eq("alert_type", "wait_red")
          .eq("status", "open")
          .maybeSingle();

        if (!existing) {
          // Get trip info for the alert
          const { data: trip } = await admin
            .from("trip_records")
            .select("truck_id, leg_id")
            .eq("id", timer.trip_id)
            .maybeSingle();

          if (trip) {
            const runDate = new Date().toISOString().split("T")[0];
            await admin.from("operational_alerts").insert({
              company_id: companyId,
              run_date: runDate,
              truck_id: trip.truck_id,
              leg_id: trip.leg_id || timer.trip_id,
              alert_type: "wait_red",
              note: `${timer.hold_type} wait exceeded ${RED_MIN} min (${Math.round(elapsedMin)} min elapsed)`,
              status: "open",
              created_by: "system",
            });
            alertsCreated++;
          }
        }
      }

      // Generate comms_events at thresholds
      if (newLevel === "yellow" && timer.current_level === "green") {
        await createCommsEvent(companyId, timer, "facility_patient_not_ready", elapsedMin);
      }
    }
  }

  return { escalated, alerts_created: alertsCreated };
}

async function createCommsEvent(companyId: string, timer: any, eventType: string, elapsedMin: number) {
  const { data: trip } = await admin
    .from("trip_records")
    .select("truck_id, simulation_run_id")
    .eq("id", timer.trip_id)
    .maybeSingle();

  if (!trip) return;

  // Throttle: no more than 1 of same type per trip every 15 minutes
  const { data: recent } = await admin
    .from("comms_events")
    .select("id")
    .eq("trip_id", timer.trip_id)
    .eq("event_type", eventType)
    .gte("created_at", new Date(Date.now() - 15 * 60000).toISOString())
    .maybeSingle();

  if (recent) return;

  await admin.from("comms_events").insert({
    company_id: companyId,
    simulation_run_id: timer.simulation_run_id,
    trip_id: timer.trip_id,
    truck_id: trip.truck_id,
    event_type: eventType,
    payload: {
      hold_type: timer.hold_type,
      elapsed_minutes: Math.round(elapsedMin),
      message: `${timer.hold_type === "wait_patient" ? "Patient not ready" : "Offload delay"} — ${Math.round(elapsedMin)} min elapsed`,
    },
    status: "queued",
  });
}

// ── Projection engine: compute trip projections for a truck ──
async function computeProjections(companyId: string, truckId: string, runDate: string) {
  // Get all slots for this truck today, ordered
  const { data: slots } = await admin
    .from("truck_run_slots")
    .select("id, leg_id, slot_order, status")
    .eq("truck_id", truckId)
    .eq("run_date", runDate)
    .order("slot_order");

  if (!slots || slots.length === 0) return;

  const legIds = slots.map(s => s.leg_id);
  const [{ data: legs }, { data: trips }, { data: activeTimers }] = await Promise.all([
    admin.from("scheduling_legs")
      .select("id, pickup_time, estimated_duration_minutes")
      .in("id", legIds),
    admin.from("trip_records")
      .select("id, leg_id, status, simulation_run_id")
      .eq("truck_id", truckId)
      .eq("run_date", runDate)
      .in("leg_id", legIds),
    admin.from("hold_timers")
      .select("trip_id, hold_type, started_at, current_level")
      .eq("is_active", true)
      .in("trip_id", legIds.map(() => "").length > 0 ? [] : []),
  ]);

  // Get active timers for trips on this truck
  const tripIds = (trips ?? []).map(t => t.id);
  const { data: timers } = tripIds.length > 0
    ? await admin.from("hold_timers").select("*").eq("is_active", true).in("trip_id", tripIds)
    : { data: [] };

  const legMap = new Map((legs ?? []).map(l => [l.id, l]));
  const tripMap = new Map((trips ?? []).map(t => [t.leg_id, t]));
  const timerMap = new Map((timers ?? []).map(t => [t.trip_id, t]));

  const now = new Date();
  let projectedTime = now;
  let totalLateProbability = 0;
  const reasonCodes: string[] = [];
  let simulationRunId: string | null = null;

  for (const slot of slots) {
    const leg = legMap.get(slot.leg_id);
    const trip = tripMap.get(slot.leg_id);
    if (trip?.simulation_run_id) simulationRunId = trip.simulation_run_id;

    if (slot.status === "completed") continue;

    const timer = trip ? timerMap.get(trip.id) : null;
    let baseRemaining = 15; // default service time

    if (timer) {
      const elapsed = (now.getTime() - new Date(timer.started_at).getTime()) / 60000;
      baseRemaining = elapsed + 10;

      if (elapsed >= YELLOW_MIN) {
        reasonCodes.push(`WAIT_${timer.hold_type.toUpperCase()}_${Math.round(elapsed)}`);
      }
    }

    const travelTime = leg?.estimated_duration_minutes ?? 10;
    const totalTime = baseRemaining + travelTime;

    const projectedComplete = new Date(projectedTime.getTime() + totalTime * 60000);

    // Calculate late probability
    let lateProbability = 0;
    if (leg?.pickup_time) {
      const [h, m] = leg.pickup_time.split(":").map(Number);
      const scheduledPickup = new Date(now);
      scheduledPickup.setHours(h, m, 0, 0);
      const diffMin = (projectedTime.getTime() - scheduledPickup.getTime()) / 60000;

      if (diffMin > 10) {
        lateProbability = Math.min(1, 0.2 + (diffMin - 10) * 0.03);
      }
    }

    totalLateProbability = Math.max(totalLateProbability, lateProbability);

    const riskColor = lateProbability > 0.35 ? "red" : lateProbability > 0.20 ? "yellow" : "green";

    // Upsert trip_projection_state
    if (trip) {
      await admin.from("trip_projection_state").upsert({
        trip_id: trip.id,
        company_id: companyId,
        simulation_run_id: simulationRunId,
        projected_complete_at: projectedComplete.toISOString(),
        projected_next_arrival_at: new Date(projectedComplete.getTime() + 15 * 60000).toISOString(),
        late_probability: lateProbability,
        risk_color: riskColor,
        confidence: timer ? 0.3 : 0.5,
        reason_codes: reasonCodes,
        updated_at: now.toISOString(),
      }, { onConflict: "trip_id" });

      // Generate comms for ETA shifts
      if (lateProbability > 0.30) {
        await createCommsEvent(companyId, { trip_id: trip.id, hold_type: "eta_shift", simulation_run_id: simulationRunId }, "eta_shift", 0);
      }
    }

    projectedTime = projectedComplete;
  }

  // Compute truck-level risk
  const truckRiskColor = totalLateProbability > 0.35 ? "red" : totalLateProbability > 0.20 ? "yellow" : "green";

  // Check for stack infeasibility
  const completedCount = slots.filter(s => s.status === "completed").length;
  const remainingCount = slots.length - completedCount;
  const collapseIndex = remainingCount > 6 && totalLateProbability > 0.3 ? 0.7 : totalLateProbability;

  if (remainingCount > 6 && totalLateProbability > 0.2) {
    reasonCodes.push("STACK_INFEASIBLE");
  }

  await admin.from("truck_risk_state").upsert({
    truck_id: truckId,
    company_id: companyId,
    simulation_run_id: simulationRunId,
    late_probability: totalLateProbability,
    risk_color: truckRiskColor,
    collapse_index: collapseIndex,
    updated_at: now.toISOString(),
  }, { onConflict: "truck_id" });
}

// ── Billing hygiene check ──
async function billingHygieneCheck(tripId: string) {
  const { data: trip } = await admin
    .from("trip_records")
    .select("*, patient:patients!trip_records_patient_id_fkey(auth_required, auth_expiration, member_id, weight_lbs, oxygen_required)")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return { checked: false };

  // Get payer rules for the patient's payer
  const { data: patient } = await admin
    .from("patients")
    .select("primary_payer")
    .eq("id", trip.patient_id)
    .maybeSingle();

  const payerType = patient?.primary_payer ?? "default";
  const { data: rules } = await admin
    .from("payer_billing_rules")
    .select("*")
    .eq("payer_type", payerType)
    .eq("company_id", trip.company_id)
    .maybeSingle();

  const blockers: string[] = [];

  // Origin/destination type
  if (!trip.origin_type) blockers.push("missing_origin_type");
  if (!trip.destination_type) blockers.push("missing_destination_type");

  // PCS
  if (rules?.requires_pcs && !trip.pcs_attached) blockers.push("missing_pcs");

  // Signature
  if (rules?.requires_signature && !trip.signature_obtained) blockers.push("missing_signature");

  // Miles
  if (rules?.requires_miles && (!trip.loaded_miles || trip.loaded_miles <= 0)) blockers.push("missing_miles");

  // Auth
  if ((trip.patient?.auth_required || rules?.requires_auth) && !trip.patient?.member_id) {
    blockers.push("missing_auth_number");
  }

  // Weight
  if (!trip.patient?.weight_lbs) blockers.push("missing_patient_weight");

  // Oxygen
  if (trip.patient?.oxygen_required && !trip.oxygen_during_transport) {
    blockers.push("missing_oxygen_capture");
  }

  // Check for existing active override
  const { data: override } = await admin
    .from("billing_overrides")
    .select("id")
    .eq("trip_id", tripId)
    .eq("is_active", true)
    .maybeSingle();

  const hasOverride = !!override;
  const claimReady = hasOverride || blockers.length === 0;

  await admin.from("trip_records").update({
    blockers: blockers,
    billing_blocked_reason: blockers.length > 0 ? blockers.join(", ") : null,
    claim_ready: claimReady,
  }).eq("id", tripId);

  return { checked: true, blockers, claim_ready: claimReady, has_override: hasOverride };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: callerUser } = await callerClient.auth.getUser();
    if (!callerUser?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Get user's company
    const { data: membership } = await admin
      .from("company_memberships")
      .select("company_id")
      .eq("user_id", callerUser.user.id)
      .maybeSingle();

    const companyId = membership?.company_id;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "No company found" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;

    switch (action) {
      case "escalate_timers":
        result = await escalateTimers(companyId);
        break;

      case "compute_projections": {
        const { truck_id, run_date } = body;
        if (!truck_id || !run_date) {
          return new Response(JSON.stringify({ error: "truck_id and run_date required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        await computeProjections(companyId, truck_id, run_date);
        result = { computed: true };
        break;
      }

      case "compute_all_projections": {
        const runDate = body.run_date || new Date().toISOString().split("T")[0];
        const { data: trucks } = await admin
          .from("trucks")
          .select("id")
          .eq("company_id", companyId)
          .eq("active", true);

        for (const truck of trucks ?? []) {
          await computeProjections(companyId, truck.id, runDate);
        }
        result = { computed: true, truck_count: trucks?.length ?? 0 };
        break;
      }

      case "billing_hygiene_check": {
        const { trip_id } = body;
        if (!trip_id) {
          return new Response(JSON.stringify({ error: "trip_id required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await billingHygieneCheck(trip_id);
        break;
      }

      case "full_cycle": {
        // Escalate + project — used as a periodic refresh
        const runDate = body.run_date || new Date().toISOString().split("T")[0];
        const escalation = await escalateTimers(companyId);
        const { data: trucks } = await admin
          .from("trucks")
          .select("id")
          .eq("company_id", companyId)
          .eq("active", true);

        for (const truck of trucks ?? []) {
          await computeProjections(companyId, truck.id, runDate);
        }
        result = { ...escalation, projections_computed: trucks?.length ?? 0 };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Dispatch intelligence error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
