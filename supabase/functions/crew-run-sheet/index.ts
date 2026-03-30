import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, accept, origin, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function validateToken(token: string) {
  // Don't filter by server UTC date — just check token is active.
  // The token's valid_from is the authoritative schedule date.
  const { data: tokenRow, error } = await supabaseAdmin
    .from("crew_share_tokens")
    .select("truck_id, valid_from, valid_until")
    .eq("token", token)
    .eq("active", true)
    .maybeSingle();
  if (error || !tokenRow) return null;
  return tokenRow;
}

function getScheduleDate(tokenRow: { valid_from: string }) {
  // Use the date stored on the token record — never recalculate from server UTC
  return tokenRow.valid_from;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dbErrorResponse(message: string, error: { message?: string; details?: string; code?: string } | null | undefined) {
  return jsonResponse(
    {
      error: message,
      details: error?.details ?? error?.message ?? null,
      code: error?.code ?? null,
    },
    500,
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return jsonResponse({ error: "Missing token" }, 400);
  }

  // ── GET: fetch run sheet ──
  if (req.method === "GET") {
    const tokenRow = await validateToken(token);
    if (!tokenRow) {
      return jsonResponse({ error: "Invalid or expired link." }, 403);
    }

    const scheduleDate = getScheduleDate(tokenRow);

    // Fetch truck first to get company_id (needed by hold_timers query)
    const { data: truck, error: truckErr } = await supabaseAdmin
      .from("trucks")
      .select("name, company_id")
      .eq("id", tokenRow.truck_id)
      .single();

    if (truckErr || !truck) {
      return jsonResponse({ error: "Truck not found for token" }, 404);
    }

    const [{ data: crew }, { data: slots }, { data: companySettings }, { data: activeTimers }] = await Promise.all([
      supabaseAdmin
        .from("crews")
        .select("member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name), member3:profiles!crews_member3_id_fkey(full_name)")
        .eq("truck_id", tokenRow.truck_id)
        .eq("active_date", scheduleDate)
        .maybeSingle(),
      supabaseAdmin
        .from("truck_run_slots")
        .select("id, leg_id, slot_order, status")
        .eq("truck_id", tokenRow.truck_id)
        .eq("run_date", scheduleDate)
        .order("slot_order"),
      supabaseAdmin.from("company_settings").select("company_name").eq("company_id", truck.company_id).limit(1).maybeSingle(),
      supabaseAdmin.from("hold_timers").select("id, trip_id, hold_type, started_at, current_level")
        .eq("is_active", true)
        .eq("company_id", truck.company_id),
    ]);

    const legIds = (slots ?? []).map((s) => s.leg_id);
    let legs: any[] = [];

    if (legIds.length > 0) {
      const { data: legData } = await supabaseAdmin
        .from("scheduling_legs")
        .select("*, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, dob, phone, weight_lbs, notes), is_oneoff, oneoff_name, oneoff_weight_lbs, oneoff_notes")
        .in("id", legIds);

      const { data: alertData } = await supabaseAdmin
        .from("operational_alerts")
        .select("id, leg_id, note, created_at, status")
        .eq("truck_id", tokenRow.truck_id)
        .eq("run_date", scheduleDate)
        .eq("alert_type", "PATIENT_NOT_READY");

      const { data: tripData } = await supabaseAdmin
        .from("trip_records")
        .select("id, leg_id, loaded_miles, signature_obtained, pcs_attached, status, loaded_at, dropped_at, documentation_complete")
        .eq("truck_id", tokenRow.truck_id)
        .eq("run_date", scheduleDate);

      const tripMap = new Map<string, any>();
      for (const t of tripData ?? []) {
        if (t.leg_id) tripMap.set(t.leg_id, t);
      }

      // Build timer map keyed by trip_id
      const timerByTripId = new Map<string, any>();
      for (const tm of activeTimers ?? []) {
        timerByTripId.set(tm.trip_id, tm);
      }

      const alertMap = new Map<string, any>();
      for (const a of alertData ?? []) {
        if (!alertMap.has(a.leg_id) || a.created_at > alertMap.get(a.leg_id)!.created_at) {
          alertMap.set(a.leg_id, { id: a.id, note: a.note, created_at: a.created_at, status: a.status });
        }
      }

      const orderMap = new Map((slots ?? []).map((s) => [s.leg_id, { order: s.slot_order, slotId: s.id, status: s.status }]));

      legs = (legData ?? [])
        .map((l: any) => {
          const slotInfo = orderMap.get(l.id);
          const alert = alertMap.get(l.id) ?? null;
          const trip = tripMap.get(l.id) ?? null;
          const activeTimer = trip ? timerByTripId.get(trip.id) ?? null : null;
          const isOneoff = l.is_oneoff ?? false;
          return {
            id: l.id,
            leg_type: l.leg_type,
            patient_name: isOneoff ? (l.oneoff_name ?? "One-Off") : (l.patient ? `${l.patient.first_name} ${l.patient.last_name}` : "Unknown"),
            patient_dob: l.patient?.dob ?? null,
            patient_phone: l.patient?.phone ?? null,
            patient_notes: isOneoff ? (l.oneoff_notes ?? null) : (l.patient?.notes ?? null),
            pickup_time: l.pickup_time,
            chair_time: l.chair_time,
            pickup_location: l.pickup_location,
            destination_location: l.destination_location,
            estimated_duration_minutes: l.estimated_duration_minutes,
            notes: l.notes ?? null,
            patient_weight: isOneoff ? (l.oneoff_weight_lbs ?? null) : (l.patient?.weight_lbs ?? null),
            slot_id: slotInfo?.slotId ?? null,
            slot_status: slotInfo?.status ?? "pending",
            not_ready_alert: alert && alert.status === "open" ? alert : null,
            trip_id: trip?.id ?? null,
            trip_loaded_miles: trip?.loaded_miles ?? null,
            trip_signature: trip?.signature_obtained ?? false,
            trip_pcs: trip?.pcs_attached ?? false,
            trip_status: trip?.status ?? null,
            trip_doc_complete: trip?.documentation_complete ?? false,
            active_timer: activeTimer ? {
              id: activeTimer.id,
              hold_type: activeTimer.hold_type,
              started_at: activeTimer.started_at,
              current_level: activeTimer.current_level,
            } : null,
            is_oneoff: isOneoff,
          };
        })
        .sort((a: any, b: any) => {
          const aOrder = orderMap.get(a.id)?.order ?? 0;
          const bOrder = orderMap.get(b.id)?.order ?? 0;
          return aOrder - bOrder;
        });
    }

    return jsonResponse({
        companyName: (companySettings as any)?.company_name ?? "",
        truckName: truck?.name ?? "Unknown Truck",
        companyId: (truck as any)?.company_id ?? null,
        truckId: tokenRow.truck_id,
        date: scheduleDate,
        member1: (crew as any)?.member1?.full_name ?? null,
        member2: (crew as any)?.member2?.full_name ?? null,
        member3: (crew as any)?.member3?.full_name ?? null,
        legs,
      });
  }

  // ── PATCH: actions ──
  if (req.method === "PATCH") {
    const tokenRow = await validateToken(token);
    if (!tokenRow) {
      return jsonResponse({ error: "Invalid or expired link." }, 403);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const scheduleDate = getScheduleDate(tokenRow);

    // ── Submit full documentation ──
    if (body.action === "submit_documentation") {
      const { trip_id } = body;
      if (!trip_id) {
        return jsonResponse({ error: "Missing trip_id" }, 400);
      }

      const { data: trip } = await supabaseAdmin
        .from("trip_records")
        .select("id, truck_id, run_date, status")
        .eq("id", trip_id)
        .eq("truck_id", tokenRow.truck_id)
        .eq("run_date", scheduleDate)
        .maybeSingle();

      if (!trip) {
        return jsonResponse({ error: "Trip not found or access denied" }, 403);
      }

      const updates: any = {
        loaded_miles: body.loaded_miles ?? null,
        loaded_at: body.loaded_at ? new Date(body.loaded_at).toISOString() : null,
        dropped_at: body.dropped_at ? new Date(body.dropped_at).toISOString() : null,
        blood_pressure: body.blood_pressure ?? null,
        heart_rate: body.heart_rate ?? null,
        oxygen_saturation: body.oxygen_saturation ?? null,
        respiration_rate: body.respiration_rate ?? null,
        vitals_taken_at: new Date().toISOString(),
        stretcher_required: body.stretcher_required ?? false,
        bed_confined: body.bed_confined ?? false,
        general_weakness: body.general_weakness ?? false,
        esrd_dialysis: body.esrd_dialysis ?? false,
        oxygen_during_transport: body.oxygen_during_transport ?? false,
        fall_risk: body.fall_risk ?? false,
        mobility_method: body.mobility_method ?? null,
        necessity_notes: body.necessity_notes ?? null,
        pcs_attached: body.pcs_attached ?? false,
        signature_obtained: body.signature_obtained ?? false,
        crew_names: body.crew_names ?? null,
        documentation_complete: true,
        status: "completed",
      };

      const { error: updateErr } = await supabaseAdmin
        .from("trip_records")
        .update(updates)
        .eq("id", trip_id);

      if (updateErr) {
        return dbErrorResponse("Failed to submit documentation", updateErr);
      }

      return jsonResponse({ success: true });
    }

    // ── Trip capture: update loaded miles ──
    if (body.action === "update_trip") {
      const { trip_id, loaded_miles, signature_obtained, pcs_attached, complete } = body;
      if (!trip_id) {
        return jsonResponse({ error: "Missing trip_id" }, 400);
      }

      const { data: trip } = await supabaseAdmin
        .from("trip_records")
        .select("id, truck_id, run_date, status")
        .eq("id", trip_id)
        .eq("truck_id", tokenRow.truck_id)
        .eq("run_date", scheduleDate)
        .maybeSingle();

      if (!trip) {
        return jsonResponse({ error: "Trip not found or access denied" }, 403);
      }

      const updates: any = {};
      if (loaded_miles !== undefined) updates.loaded_miles = loaded_miles;
      if (signature_obtained !== undefined) updates.signature_obtained = signature_obtained;
      if (pcs_attached !== undefined) updates.pcs_attached = pcs_attached;

      if (complete) {
        updates.status = "completed";
        updates.dropped_at = new Date().toISOString();
        if (!trip.status || ["scheduled", "assigned", "en_route", "loaded"].includes(trip.status)) {
          updates.loaded_at = updates.loaded_at ?? new Date().toISOString();
        }
      }

      const { error: updateErr } = await supabaseAdmin
        .from("trip_records")
        .update(updates)
        .eq("id", trip_id);

      if (updateErr) {
        return dbErrorResponse("Failed to update trip", updateErr);
      }

      return jsonResponse({ success: true });
    }

    // ── Patient not ready ──
    if (body.action === "not_ready") {
      const { leg_id, note, company_id } = body;
      if (!leg_id) {
        return jsonResponse({ error: "Missing leg_id" }, 400);
      }

      const { data: slot } = await supabaseAdmin
        .from("truck_run_slots")
        .select("id")
        .eq("leg_id", leg_id)
        .eq("truck_id", tokenRow.truck_id)
        .eq("run_date", scheduleDate)
        .maybeSingle();

      if (!slot) {
        return jsonResponse({ error: "Leg not found or access denied" }, 403);
      }

      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from("operational_alerts")
        .insert({
          company_id: company_id ?? null,
          run_date: scheduleDate,
          truck_id: tokenRow.truck_id,
          leg_id,
          alert_type: "PATIENT_NOT_READY",
          note: note?.trim() || null,
          status: "open",
          created_by: "crew",
        })
        .select("id, created_at")
        .single();

      if (insertErr) {
        return dbErrorResponse("Failed to create alert", insertErr);
      }

      return jsonResponse({ success: true, alert_id: inserted.id, created_at: inserted.created_at });
    }

    // ── Start Wait Timer ──
    if (body.action === "start_wait") {
      const { trip_id, slot_id, hold_type, note } = body;
      if (!trip_id || !hold_type) {
        return jsonResponse({ error: "Missing trip_id or hold_type" }, 400);
      }

      // Verify trip belongs to this truck
      const { data: trip } = await supabaseAdmin
        .from("trip_records")
        .select("id, truck_id, company_id, simulation_run_id")
        .eq("id", trip_id)
        .eq("truck_id", tokenRow.truck_id)
        .maybeSingle();

      if (!trip) {
        return jsonResponse({ error: "Trip not found or access denied" }, 403);
      }

      const now = new Date().toISOString();

      // Insert hold_timer
      const { data: timer, error: timerErr } = await supabaseAdmin
        .from("hold_timers")
        .insert({
          company_id: trip.company_id,
          simulation_run_id: trip.simulation_run_id,
          trip_id,
          slot_id: slot_id ?? null,
          hold_type,
          started_at: now,
          current_level: "green",
          is_active: true,
        })
        .select("id")
        .single();

      if (timerErr) {
        return dbErrorResponse("Failed to start timer", timerErr);
      }

      // Insert trip_event
      await supabaseAdmin.from("trip_events").insert({
        company_id: trip.company_id,
        simulation_run_id: trip.simulation_run_id,
        trip_id,
        slot_id: slot_id ?? null,
        truck_id: tokenRow.truck_id,
        event_type: hold_type === "wait_patient" ? "waiting_patient_start" : "waiting_offload_start",
        event_time: now,
        source: "crew",
        meta: note ? { note } : null,
      });

      return jsonResponse({ success: true, timer_id: timer.id });
    }

    // ── End Wait Timer ──
    if (body.action === "end_wait") {
      const { timer_id, note } = body;
      if (!timer_id) {
        return jsonResponse({ error: "Missing timer_id" }, 400);
      }

      const { data: timer } = await supabaseAdmin
        .from("hold_timers")
        .select("*")
        .eq("id", timer_id)
        .eq("is_active", true)
        .maybeSingle();

      if (!timer) {
        return jsonResponse({ error: "Timer not found or already resolved" }, 404);
      }

      const now = new Date().toISOString();

      const { error: resolveErr } = await supabaseAdmin
        .from("hold_timers")
        .update({ resolved_at: now, is_active: false })
        .eq("id", timer_id);

      if (resolveErr) {
        return dbErrorResponse("Failed to resolve timer", resolveErr);
      }

      // Insert end event
      await supabaseAdmin.from("trip_events").insert({
        company_id: timer.company_id,
        simulation_run_id: timer.simulation_run_id,
        trip_id: timer.trip_id,
        slot_id: timer.slot_id,
        truck_id: tokenRow.truck_id,
        event_type: timer.hold_type === "wait_patient" ? "waiting_patient_end" : "waiting_offload_end",
        event_time: now,
        source: "crew",
        meta: note ? { note } : null,
      });

      return jsonResponse({ success: true });
    }

    // ── Clear not ready ──
    if (body.action === "clear_not_ready") {
      const { alert_id } = body;
      if (!alert_id) {
        return jsonResponse({ error: "Missing alert_id" }, 400);
      }

      const { error: updateErr } = await supabaseAdmin
        .from("operational_alerts")
        .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: "crew" })
        .eq("id", alert_id);

      if (updateErr) {
        return dbErrorResponse("Failed to resolve alert", updateErr);
      }

      return jsonResponse({ success: true });
    }

    // ── Advance slot status ──
    const { slot_id, next_status } = body;

    if (!slot_id || !next_status) {
      return jsonResponse({ error: "Missing slot_id or next_status" }, 400);
    }

    const STATUS_FLOW = ["pending", "en_route", "arrived", "with_patient", "transporting", "completed"];
    if (!STATUS_FLOW.includes(next_status)) {
      return jsonResponse({ error: "Invalid status" }, 400);
    }

    const { data: slot } = await supabaseAdmin
      .from("truck_run_slots")
      .select("id, status, slot_order")
      .eq("id", slot_id)
      .eq("truck_id", tokenRow.truck_id)
      .eq("run_date", scheduleDate)
      .maybeSingle();

    if (!slot) {
      return jsonResponse({ error: "Slot not found or access denied" }, 403);
    }

    const currentIdx = STATUS_FLOW.indexOf(slot.status);
    const nextIdx = STATUS_FLOW.indexOf(next_status);
    if (nextIdx !== currentIdx + 1) {
      return jsonResponse({ error: "Status can only advance one step at a time" }, 400);
    }

    const { error: updateError } = await supabaseAdmin
      .from("truck_run_slots")
      .update({ status: next_status })
      .eq("id", slot_id);

    if (updateError) {
      return dbErrorResponse("Failed to update status", updateError);
    }

    return jsonResponse({ success: true, status: next_status });
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
