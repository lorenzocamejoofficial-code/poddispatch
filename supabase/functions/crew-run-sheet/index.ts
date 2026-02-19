import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

async function validateToken(token: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data: tokenRow, error } = await supabaseAdmin
    .from("crew_share_tokens")
    .select("truck_id, valid_from, valid_until")
    .eq("token", token)
    .eq("active", true)
    .lte("valid_from", today)
    .gte("valid_until", today)
    .maybeSingle();

  if (error || !tokenRow) return null;
  return tokenRow;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response(JSON.stringify({ error: "Missing token" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── GET: fetch run sheet ──────────────────────────────────────────────────
  if (req.method === "GET") {
    const tokenRow = await validateToken(token);
    if (!tokenRow) {
      return new Response(JSON.stringify({ error: "Invalid or expired link." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date().toISOString().split("T")[0];
    const scheduleDate =
      today >= tokenRow.valid_from && today <= tokenRow.valid_until
        ? today
        : tokenRow.valid_from;

    const [{ data: truck }, { data: crew }, { data: slots }] = await Promise.all([
      supabaseAdmin.from("trucks").select("name").eq("id", tokenRow.truck_id).single(),
      supabaseAdmin
        .from("crews")
        .select(
          "member1:profiles!crews_member1_id_fkey(full_name), member2:profiles!crews_member2_id_fkey(full_name)"
        )
        .eq("truck_id", tokenRow.truck_id)
        .eq("active_date", scheduleDate)
        .maybeSingle(),
      supabaseAdmin
        .from("truck_run_slots")
        .select("id, leg_id, slot_order, status")
        .eq("truck_id", tokenRow.truck_id)
        .eq("run_date", scheduleDate)
        .order("slot_order"),
    ]);

    const legIds = (slots ?? []).map((s) => s.leg_id);
    let legs: any[] = [];

    if (legIds.length > 0) {
      const { data: legData } = await supabaseAdmin
        .from("scheduling_legs")
        .select(
          "*, patient:patients!scheduling_legs_patient_id_fkey(first_name, last_name, weight_lbs, notes)"
        )
        .in("id", legIds);

      const orderMap = new Map(
        (slots ?? []).map((s) => [
          s.leg_id,
          { order: s.slot_order, slotId: s.id, status: s.status },
        ])
      );

      legs = (legData ?? [])
        .map((l: any) => {
          const slotInfo = orderMap.get(l.id);
          return {
            id: l.id,
            leg_type: l.leg_type,
            patient_name: l.patient
              ? `${l.patient.first_name} ${l.patient.last_name}`
              : "Unknown",
            pickup_time: l.pickup_time,
            chair_time: l.chair_time,
            pickup_location: l.pickup_location,
            destination_location: l.destination_location,
            estimated_duration_minutes: l.estimated_duration_minutes,
            notes: l.patient?.notes ?? l.notes ?? null,
            patient_weight: l.patient?.weight_lbs ?? null,
            slot_id: slotInfo?.slotId ?? null,
            slot_status: slotInfo?.status ?? "pending",
          };
        })
        .sort((a: any, b: any) => {
          const aOrder = orderMap.get(a.id)?.order ?? 0;
          const bOrder = orderMap.get(b.id)?.order ?? 0;
          return aOrder - bOrder;
        });
    }

    return new Response(
      JSON.stringify({
        truckName: truck?.name ?? "Unknown Truck",
        date: scheduleDate,
        member1: (crew as any)?.member1?.full_name ?? null,
        member2: (crew as any)?.member2?.full_name ?? null,
        legs,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  // ── PATCH: advance slot status ────────────────────────────────────────────
  if (req.method === "PATCH") {
    const tokenRow = await validateToken(token);
    if (!tokenRow) {
      return new Response(JSON.stringify({ error: "Invalid or expired link." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { slot_id, next_status } = await req.json();

    if (!slot_id || !next_status) {
      return new Response(JSON.stringify({ error: "Missing slot_id or next_status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const STATUS_FLOW = [
      "pending",
      "en_route",
      "arrived",
      "with_patient",
      "transporting",
      "completed",
    ];
    if (!STATUS_FLOW.includes(next_status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the slot belongs to this token's truck (security check)
    const today = new Date().toISOString().split("T")[0];
    const scheduleDate =
      today >= tokenRow.valid_from && today <= tokenRow.valid_until
        ? today
        : tokenRow.valid_from;

    const { data: slot } = await supabaseAdmin
      .from("truck_run_slots")
      .select("id, status, slot_order")
      .eq("id", slot_id)
      .eq("truck_id", tokenRow.truck_id)
      .eq("run_date", scheduleDate)
      .maybeSingle();

    if (!slot) {
      return new Response(JSON.stringify({ error: "Slot not found or access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce forward-only progression
    const currentIdx = STATUS_FLOW.indexOf(slot.status);
    const nextIdx = STATUS_FLOW.indexOf(next_status);
    if (nextIdx !== currentIdx + 1) {
      return new Response(
        JSON.stringify({ error: "Status can only advance one step at a time" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from("truck_run_slots")
      .update({ status: next_status })
      .eq("id", slot_id);

    if (updateError) {
      return new Response(JSON.stringify({ error: "Failed to update status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, status: next_status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
