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

// ── Valid origin/destination modifier combos ──
const VALID_MODIFIER_COMBOS: Record<string, string[]> = {
  R: ["D", "E", "G", "H", "I", "J", "N", "P", "S"], // Residence
  D: ["R", "E", "G", "H", "I", "J", "N", "P", "S"], // Dialysis
  E: ["R", "D", "G", "H", "I", "J", "N", "P", "S"], // SNF
  G: ["R", "D", "E", "H", "I", "J", "N", "P", "S"], // Hospital
  H: ["R", "D", "E", "G", "I", "J", "N", "P", "S"], // Hospital (inpatient)
  I: ["R", "D", "E", "G", "H", "J", "N", "P", "S"], // Intermediate
  J: ["R", "D", "E", "G", "H", "I", "N", "P", "S"], // Non-hospital
  N: ["R", "D", "E", "G", "H", "I", "J", "P", "S"], // SNF
  P: ["R", "D", "E", "G", "H", "I", "J", "N", "S"], // Physician
  S: ["R", "D", "E", "G", "H", "I", "J", "N", "P"], // Scene
};

const ORIGIN_TYPE_TO_MODIFIER: Record<string, string> = {
  home: "R", residence: "R",
  dialysis_center: "D", dialysis: "D",
  hospital_inpatient: "H", hospital_outpatient: "G", hospital: "G",
  er: "G", emergency: "G",
  snf: "E", skilled_nursing: "E", nursing_facility: "N",
  assisted_living: "E", rehab: "I",
  physician_office: "P", doctor: "P",
  scene: "S", other: "J",
};

function getModifierCode(locType: string | null): string | null {
  if (!locType) return null;
  return ORIGIN_TYPE_TO_MODIFIER[locType.toLowerCase()] ?? null;
}

// ── Billing hygiene check ──
async function billingHygieneCheck(tripId: string) {
  const { data: trip } = await admin
    .from("trip_records")
    .select("*, patient:patients!trip_records_patient_id_fkey(auth_required, auth_expiration, member_id, weight_lbs, oxygen_required, primary_payer, secondary_payer, bariatric)")
    .eq("id", tripId)
    .maybeSingle();

  if (!trip) return { checked: false };

  const payerType = trip.patient?.primary_payer ?? "default";
  const { data: rules } = await admin
    .from("payer_billing_rules")
    .select("*")
    .eq("payer_type", payerType)
    .eq("company_id", trip.company_id)
    .maybeSingle();

  const blockers: string[] = [];
  let riskScore = 0; // 0-100 scale

  // 1. Origin/destination type
  if (!trip.origin_type) { blockers.push("missing_origin_type"); riskScore += 15; }
  if (!trip.destination_type) { blockers.push("missing_destination_type"); riskScore += 15; }

  // 2. Origin/destination modifier validation
  const originMod = getModifierCode(trip.origin_type);
  const destMod = getModifierCode(trip.destination_type);
  if (originMod && destMod) {
    const allowed = VALID_MODIFIER_COMBOS[originMod];
    if (allowed && !allowed.includes(destMod)) {
      blockers.push("invalid_origin_destination_combo");
      riskScore += 10;
    }
    // Same origin and dest is suspicious (not always invalid but flagged)
    if (originMod === destMod && originMod !== "R") {
      blockers.push("same_origin_destination_type");
      riskScore += 5;
    }
  }

  // 3. PCS
  if (rules?.requires_pcs && !trip.pcs_attached) { blockers.push("missing_pcs"); riskScore += 15; }

  // 4. Signature
  if (rules?.requires_signature && !trip.signature_obtained) { blockers.push("missing_signature"); riskScore += 10; }

  // 5. Miles
  if (rules?.requires_miles && (!trip.loaded_miles || trip.loaded_miles <= 0)) { blockers.push("missing_miles"); riskScore += 10; }

  // 6. Auth / prior authorization
  const authRequired = trip.patient?.auth_required || rules?.requires_auth;
  if (authRequired && !trip.patient?.member_id) {
    blockers.push("missing_auth_number");
    riskScore += 20;
  }
  // Auth expiration check
  if (authRequired && trip.patient?.auth_expiration) {
    const expDate = new Date(trip.patient.auth_expiration);
    const runDate = new Date(trip.run_date);
    if (expDate < runDate) {
      blockers.push("auth_expired");
      riskScore += 20;
    } else {
      const daysUntilExpiry = (expDate.getTime() - runDate.getTime()) / 86400000;
      if (daysUntilExpiry <= 7) {
        blockers.push("auth_expiring_soon");
        riskScore += 5;
      }
    }
  }

  // 7. Weight
  if (!trip.patient?.weight_lbs) { blockers.push("missing_patient_weight"); riskScore += 5; }

  // 8. Oxygen
  if (trip.patient?.oxygen_required && !trip.oxygen_during_transport) {
    blockers.push("missing_oxygen_capture");
    riskScore += 5;
  }

  // 9. Secondary payer detection
  const hasSecondaryPayer = !!trip.patient?.secondary_payer;
  if (hasSecondaryPayer) {
    // Flag for review, not a hard block
    blockers.push("secondary_payer_present_needs_review");
    riskScore += 3;
  }

  // 10. Level of service validation
  const serviceLevel = trip.service_level ?? "BLS";
  if (!serviceLevel || !["BLS", "ALS", "SCT", "BLS-E"].includes(serviceLevel.toUpperCase())) {
    blockers.push("invalid_service_level");
    riskScore += 10;
  }
  // Bariatric patient on BLS without proper flags
  if (trip.patient?.bariatric && serviceLevel === "BLS" && !trip.stretcher_required) {
    blockers.push("bariatric_service_level_mismatch");
    riskScore += 5;
  }

  // 11. Trip close prevention: required timestamps
  if (rules?.requires_timestamps) {
    if (!trip.arrived_pickup_at) { blockers.push("missing_arrived_pickup_time"); riskScore += 5; }
    if (!trip.arrived_dropoff_at) { blockers.push("missing_arrived_dropoff_time"); riskScore += 5; }
  }

  // Cap risk score
  riskScore = Math.min(100, riskScore);

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
    blockers,
    billing_blocked_reason: blockers.length > 0 ? blockers.join(", ") : null,
    claim_ready: claimReady,
    revenue_risk_score: riskScore,
  }).eq("id", tripId);

  return { checked: true, blockers, claim_ready: claimReady, has_override: hasOverride, revenue_risk_score: riskScore };
}

// ── On-time performance computation ──
async function computeOnTimeMetrics(companyId: string, truckId: string, runDate: string) {
  // Get all trips for this truck on this date
  const { data: trips } = await admin
    .from("trip_records")
    .select("id, scheduled_pickup_time, arrived_pickup_at, wait_time_minutes, status, leg_id")
    .eq("truck_id", truckId)
    .eq("run_date", runDate)
    .eq("company_id", companyId);

  if (!trips || trips.length === 0) return;

  // Get projections for these trips
  const tripIds = trips.map(t => t.id);
  const { data: projections } = await admin
    .from("trip_projection_state")
    .select("trip_id, projected_complete_at, late_probability, reason_codes")
    .in("trip_id", tripIds);

  // Get active hold timers for wait classification
  const { data: timers } = await admin
    .from("hold_timers")
    .select("trip_id, hold_type, started_at, resolved_at")
    .in("trip_id", tripIds);

  const projMap = new Map((projections ?? []).map(p => [p.trip_id, p]));
  const timerMap = new Map<string, any[]>();
  for (const t of timers ?? []) {
    if (!timerMap.has(t.trip_id)) timerMap.set(t.trip_id, []);
    timerMap.get(t.trip_id)!.push(t);
  }

  const ON_TIME_THRESHOLD_MIN = 10;
  let onTimeCount = 0;
  let lateCount = 0;
  let totalWaitMin = 0;
  const lateCauses: Record<string, number> = {};

  for (const trip of trips) {
    if (!trip.scheduled_pickup_time || !trip.arrived_pickup_at) continue;

    // Parse scheduled time
    const [sh, sm] = trip.scheduled_pickup_time.split(":").map(Number);
    const scheduledDate = new Date(trip.arrived_pickup_at);
    scheduledDate.setHours(sh, sm, 0, 0);
    const actualArrival = new Date(trip.arrived_pickup_at);

    const diffMin = (actualArrival.getTime() - scheduledDate.getTime()) / 60000;
    const isOnTime = diffMin <= ON_TIME_THRESHOLD_MIN;

    // Determine late root cause
    let rootCause: string | null = null;
    if (!isOnTime) {
      lateCount++;
      const tripTimers = timerMap.get(trip.id) ?? [];
      const projection = projMap.get(trip.id);
      const reasons = projection?.reason_codes ?? [];

      if (tripTimers.some((t: any) => {
        const elapsed = ((t.resolved_at ? new Date(t.resolved_at) : new Date()).getTime() - new Date(t.started_at).getTime()) / 60000;
        return elapsed >= 15;
      })) {
        rootCause = "wait_over_threshold";
      } else if (reasons.includes("STACK_INFEASIBLE")) {
        rootCause = "overstacking";
      } else if (diffMin > 20) {
        rootCause = "travel_underestimation";
      } else {
        rootCause = "other";
      }

      lateCauses[rootCause] = (lateCauses[rootCause] ?? 0) + 1;
    } else {
      onTimeCount++;
    }

    // Accumulate wait time
    totalWaitMin += trip.wait_time_minutes ?? 0;

    // Update trip_projection_state with on-time data
    await admin.from("trip_projection_state").upsert({
      trip_id: trip.id,
      company_id: companyId,
      on_time_status: isOnTime ? "on_time" : "late",
      late_root_cause: rootCause,
      actual_arrival_at: trip.arrived_pickup_at,
      scheduled_pickup_time: trip.scheduled_pickup_time,
      updated_at: new Date().toISOString(),
    }, { onConflict: "trip_id" });
  }

  const completedTrips = onTimeCount + lateCount;
  const onTimePct = completedTrips > 0 ? Math.round((onTimeCount / completedTrips) * 100) : 100;
  const avgFacilityWait = completedTrips > 0 ? Math.round((totalWaitMin / completedTrips) * 10) / 10 : 0;

  // Operational risk score: weighted combination
  // Low on-time% increases risk, high avg wait increases risk, collapse from truck_risk_state
  const { data: truckRisk } = await admin
    .from("truck_risk_state")
    .select("collapse_index, late_probability")
    .eq("truck_id", truckId)
    .maybeSingle();

  const collapseIdx = truckRisk?.collapse_index ?? 0;
  const operationalRiskScore = Math.min(100, Math.round(
    (100 - onTimePct) * 0.4 +
    Math.min(avgFacilityWait, 30) * 1.0 +
    collapseIdx * 30
  ));

  // Upsert daily_truck_metrics
  await admin.from("daily_truck_metrics").upsert({
    truck_id: truckId,
    company_id: companyId,
    run_date: runDate,
    total_trips: trips.length,
    on_time_count: onTimeCount,
    late_count: lateCount,
    on_time_pct: onTimePct,
    avg_facility_wait_min: avgFacilityWait,
    total_wait_min: totalWaitMin,
    operational_risk_score: operationalRiskScore,
    late_causes: lateCauses,
    updated_at: new Date().toISOString(),
  }, { onConflict: "truck_id,run_date" });

  return { on_time_pct: onTimePct, operational_risk_score: operationalRiskScore, late_causes: lateCauses };
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

    const body = await req.json();
    const { action } = body;

    // Resolve company_id: try user auth first, fall back to service-role with body.company_id
    let companyId: string | null = null;

    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: callerUser } = await callerClient.auth.getUser();
    if (callerUser?.user) {
      const { data: membership } = await admin
        .from("company_memberships")
        .select("company_id")
        .eq("user_id", callerUser.user.id)
        .maybeSingle();
      companyId = membership?.company_id ?? null;
    }

    // Service-role fallback: accept company_id from body (only when no user resolved)
    if (!companyId && body.company_id) {
      // Verify it's actually the service role calling (token matches service role key)
      const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (authHeader === `Bearer ${svcKey}`) {
        companyId = body.company_id;
      }
    }

    // Fix 8: If caller provided a company_id in the body that differs from their
    // actual membership, reject the request to prevent cross-company data access.
    if (companyId && body.company_id && body.company_id !== companyId) {
      return new Response(JSON.stringify({ error: "Company ID mismatch — access denied" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

      case "compute_on_time_metrics": {
        const { truck_id: otTruckId, run_date: otRunDate } = body;
        if (!otTruckId || !otRunDate) {
          return new Response(JSON.stringify({ error: "truck_id and run_date required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        result = await computeOnTimeMetrics(companyId, otTruckId, otRunDate);
        break;
      }

      case "full_cycle": {
        // Escalate + project + on-time metrics — used as a periodic refresh
        const runDate = body.run_date || new Date().toISOString().split("T")[0];
        const escalation = await escalateTimers(companyId);
        const { data: trucks } = await admin
          .from("trucks")
          .select("id")
          .eq("company_id", companyId)
          .eq("active", true);

        for (const truck of trucks ?? []) {
          await computeProjections(companyId, truck.id, runDate);
          await computeOnTimeMetrics(companyId, truck.id, runDate);
        }
        result = { ...escalation, projections_computed: trucks?.length ?? 0, on_time_computed: true };
        break;
      }

      case "billing_hygiene_batch": {
        // Run billing hygiene for all completed trips on a date
        const batchDate = body.run_date || new Date().toISOString().split("T")[0];
        const { data: completedTrips } = await admin
          .from("trip_records")
          .select("id")
          .eq("company_id", companyId)
          .eq("run_date", batchDate)
          .in("status", ["completed", "ready_for_billing"]);

        const results = [];
        for (const t of completedTrips ?? []) {
          const r = await billingHygieneCheck(t.id);
          results.push({ trip_id: t.id, ...r });
        }
        result = { checked: results.length, results };
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
