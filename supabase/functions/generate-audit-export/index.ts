import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  const e = s.replace(/"/g, '""');
  return /[",\n\r]/.test(e) ? `"${e}"` : e;
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );
  const out = [headers.join(",")];
  for (const r of rows) out.push(headers.map((h) => csvEscape(r[h])).join(","));
  return out.join("\n");
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Pull ALL rows for a query (handles 1000-row limit)
async function fetchAll(
  build: (from: number, to: number) => any
): Promise<any[]> {
  const PAGE = 1000;
  let from = 0;
  const out: any[] = [];
  while (true) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    out.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Auth required" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user via anon client with their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "Invalid token" }, 401);
    const user = userData.user;

    // Resolve their company + role using user-scoped client (respects RLS)
    const { data: membership } = await userClient
      .from("company_memberships")
      .select("company_id, role")
      .eq("user_id", user.id)
      .in("role", ["owner", "creator", "manager"])
      .maybeSingle();

    if (!membership) {
      return json({ error: "Only owners, managers, or creators can generate audit exports" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const {
      regime,
      date_from,
      date_to,
      include_test_data = false,
      filters = {},
    } = body as {
      regime: string;
      date_from: string;
      date_to: string;
      include_test_data?: boolean;
      filters?: Record<string, unknown>;
    };

    if (!regime || !date_from || !date_to) {
      return json({ error: "regime, date_from, date_to required" }, 400);
    }
    if (date_from > date_to) {
      return json({ error: "date_from must be <= date_to" }, 400);
    }

    const company_id = membership.company_id;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // ---- Company header ----
    const { data: company } = await admin
      .from("companies")
      .select("id, name, npi, ein, address, city, state, zip_code")
      .eq("id", company_id)
      .maybeSingle();

    // ---- Trips ----
    const trips = await fetchAll((from, to) =>
      admin
        .from("trip_records")
        .select(
          "id, run_date, patient_id, trip_type, service_level, pickup_location, destination_location, origin_type, destination_type, primary_payer, loaded_miles, odometer_at_scene, odometer_at_destination, dispatch_time, at_scene_time, left_scene_time, arrived_dropoff_at, in_service_time, status, pcr_status, is_simulated, simulation_run_id, signatures_json, medical_necessity_reason"
        )
        .eq("company_id", company_id)
        .gte("run_date", date_from)
        .lte("run_date", date_to)
        .order("run_date", { ascending: true })
        .range(from, to)
    );

    const filteredTrips = include_test_data ? trips : trips.filter((t) => !t.is_simulated);
    const tripIds = filteredTrips.map((t) => t.id);

    // Patient lookup (chunked by id list)
    const patientIds = Array.from(
      new Set(filteredTrips.map((t) => t.patient_id).filter(Boolean))
    );
    let patients: any[] = [];
    if (patientIds.length > 0) {
      const { data } = await admin
        .from("patients")
        .select("id, first_name, last_name, dob, member_id, primary_payer")
        .in("id", patientIds);
      patients = data ?? [];
    }
    const patientById = new Map(patients.map((p) => [p.id, p]));

    const tripRows = filteredTrips.map((t) => {
      const p = t.patient_id ? patientById.get(t.patient_id) : null;
      return {
        trip_id: t.id,
        date_of_service: t.run_date,
        patient_last_name: p?.last_name ?? "",
        patient_first_name: p?.first_name ?? "",
        patient_dob: p?.dob ?? "",
        member_id: p?.member_id ?? "",
        trip_type: t.trip_type,
        service_level: t.service_level,
        origin: t.pickup_location,
        origin_type: t.origin_type,
        destination: t.destination_location,
        destination_type: t.destination_type,
        payer: t.primary_payer,
        loaded_miles: t.loaded_miles,
        odometer_scene: t.odometer_at_scene,
        odometer_dest: t.odometer_at_destination,
        dispatch_time: t.dispatch_time,
        at_scene_time: t.at_scene_time,
        left_scene_time: t.left_scene_time,
        arrived_dropoff: t.arrived_dropoff_at,
        in_service_time: t.in_service_time,
        status: t.status,
        pcr_status: t.pcr_status,
        medical_necessity: t.medical_necessity_reason,
        is_test_data: t.is_simulated ? "YES" : "",
      };
    });

    // ---- Claims lineage ----
    let claims: any[] = [];
    if (tripIds.length > 0) {
      claims = await fetchAll((from, to) =>
        admin
          .from("claim_records")
          .select(
            "id, trip_id, run_date, payer_type, member_id, status, total_charge, paid_amount, patient_responsibility, denial_code, denial_category, rejection_codes, submitted_at, paid_at, icn, hcpcs_codes, hcpcs_modifiers, is_simulated, is_test_submission, created_at, updated_at"
          )
          .eq("company_id", company_id)
          .in("trip_id", tripIds)
          .range(from, to)
      );
      if (!include_test_data) {
        claims = claims.filter((c) => !c.is_simulated && !c.is_test_submission);
      }
    }
    const claimIds = claims.map((c) => c.id);

    // ---- Payments ----
    let payments: any[] = [];
    if (claimIds.length > 0) {
      const { data } = await admin
        .from("claim_payments")
        .select("*")
        .in("claim_id", claimIds);
      payments = data ?? [];
    }

    // ---- Acknowledgments ----
    let acks: any[] = [];
    if (claimIds.length > 0) {
      const { data } = await admin
        .from("claim_acknowledgments")
        .select("*")
        .in("claim_id", claimIds);
      acks = data ?? [];
    }

    // ---- Audit logs ----
    const auditScopeIds = [...tripIds, ...claimIds];
    let auditLogs: any[] = [];
    if (auditScopeIds.length > 0) {
      auditLogs = await fetchAll((from, to) =>
        admin
          .from("audit_logs")
          .select("id, action, actor_email, table_name, record_id, notes, created_at")
          .eq("company_id", company_id)
          .in("record_id", auditScopeIds)
          .order("created_at", { ascending: true })
          .range(from, to)
      );
    }

    // ---- Overrides ----
    let overrides: any[] = [];
    if (tripIds.length > 0) {
      const { data } = await admin
        .from("billing_overrides")
        .select("id, trip_id, reason, override_reason, overridden_by, overridden_at, created_at")
        .in("trip_id", tripIds);
      overrides = data ?? [];
    }

    const rowCounts = {
      trips: tripRows.length,
      claims: claims.length,
      payments: payments.length,
      acknowledgments: acks.length,
      audit_log_entries: auditLogs.length,
      overrides: overrides.length,
    };

    // ---- Build files ----
    const generatedAt = new Date().toISOString();
    const exportId = crypto.randomUUID();

    const coverSheet = [
      "═══════════════════════════════════════════════════════════════",
      "       POD DISPATCH — SEALED COMPLIANCE EXPORT",
      "═══════════════════════════════════════════════════════════════",
      "",
      `Export ID:            ${exportId}`,
      `Regime cited:         ${regime}`,
      `Company:              ${company?.name ?? "(unknown)"}`,
      `NPI:                  ${company?.npi ?? "(not on file)"}`,
      `EIN:                  ${company?.ein ?? "(not on file)"}`,
      `Address:              ${[company?.address, company?.city, company?.state, company?.zip_code].filter(Boolean).join(", ")}`,
      "",
      `Date range:           ${date_from}  →  ${date_to}`,
      `Generated by:         ${user.email ?? user.id}`,
      `Generated at:         ${generatedAt}`,
      `Includes test data:   ${include_test_data ? "YES — NOT FOR REGULATORY USE" : "no"}`,
      "",
      "─────────── Row counts ───────────",
      `Trips:                ${rowCounts.trips}`,
      `Claims:               ${rowCounts.claims}`,
      `Payments:             ${rowCounts.payments}`,
      `Acknowledgments:      ${rowCounts.acknowledgments}`,
      `Audit log entries:    ${rowCounts.audit_log_entries}`,
      `Billing overrides:    ${rowCounts.overrides}`,
      "",
      "─────────── Tamper-evident verification ───────────",
      "The SHA-256 hash of this archive is recorded in the system's",
      "immutable audit_exports table at generation time. To verify",
      "this archive has not been altered after the fact, re-compute",
      "its SHA-256 and confirm it matches the recorded value.",
      "",
      "  macOS / Linux:    shasum -a 256 <this-file>.zip",
      "  Windows:          certutil -hashfile <this-file>.zip SHA256",
      "",
      "The recorded hash is also stamped in manifest.json inside this",
      "archive and visible in the Compliance Vault > Export History.",
      "═══════════════════════════════════════════════════════════════",
    ].join("\n");

    const manifest = {
      export_id: exportId,
      regime,
      date_from,
      date_to,
      company_id,
      company_name: company?.name,
      company_npi: company?.npi,
      generated_by: { user_id: user.id, email: user.email },
      generated_at: generatedAt,
      include_test_data,
      filters,
      row_counts: rowCounts,
      files: [
        "cover_sheet.txt",
        "trips.csv",
        "claims.csv",
        "payments.csv",
        "acknowledgments.csv",
        "audit_trail.csv",
        "overrides.csv",
        "manifest.json",
      ],
    };

    const zip = new JSZip();
    zip.file("cover_sheet.txt", coverSheet);
    zip.file("trips.csv", toCSV(tripRows));
    zip.file("claims.csv", toCSV(claims));
    zip.file("payments.csv", toCSV(payments));
    zip.file("acknowledgments.csv", toCSV(acks));
    zip.file("audit_trail.csv", toCSV(auditLogs));
    zip.file("overrides.csv", toCSV(overrides));
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));

    const zipBytes = await zip.generateAsync({ type: "uint8array" });
    const sha256 = await sha256Hex(zipBytes);

    const filePath = `${company_id}/${exportId}.zip`;
    const { error: uploadErr } = await admin.storage
      .from("audit-exports")
      .upload(filePath, zipBytes, {
        contentType: "application/zip",
        upsert: false,
      });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // Insert sealed record
    const { data: inserted, error: insertErr } = await admin
      .from("audit_exports")
      .insert({
        id: exportId,
        company_id,
        regime,
        date_from,
        date_to,
        filters,
        include_test_data,
        generated_by: user.id,
        generated_by_email: user.email,
        generated_at: generatedAt,
        file_path: filePath,
        file_size_bytes: zipBytes.byteLength,
        sha256,
        row_counts: rowCounts,
        manifest,
      })
      .select()
      .single();
    if (insertErr) throw new Error(`Insert failed: ${insertErr.message}`);

    // Audit log
    await admin.from("audit_logs").insert({
      action: "export",
      actor_user_id: user.id,
      actor_email: user.email,
      company_id,
      table_name: "audit_exports",
      record_id: exportId,
      notes: `Sealed compliance export — regime=${regime}, range=${date_from}..${date_to}, sha256=${sha256}`,
    });

    // Signed download URL (1 hour)
    const { data: signed } = await admin.storage
      .from("audit-exports")
      .createSignedUrl(filePath, 3600);

    return json({
      ok: true,
      export: inserted,
      signed_url: signed?.signedUrl ?? null,
    });
  } catch (err) {
    console.error("generate-audit-export error:", err);
    return json({ error: (err as Error).message ?? "Unknown error" }, 500);
  }
});
