// loadtest-harness — creator-only end-to-end load + HIPAA isolation test.
// Seeds 10 disposable tenants with real auth users, runs a parallel scenario,
// runs a cross-tenant probe with REAL JWTs across every tenant-scoped table,
// soft-archives the tenants, and persists the report into loadtest_reports.
//
// Hard wall-clock for an edge function is ~150s, so the parallel scenario is
// time-boxed (default 45s). All work happens within a single invocation; the
// row in loadtest_reports gets `status='running'` first, then patched on
// completion. The Creator Console polls that row.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// Every public table that has a `company_id` column. Source of truth:
// information_schema; refresh manually if new tenant-scoped tables ship.
const TENANT_TABLES = [
  "admin_actions","alerts","ar_followup_notes","audit_logs","biller_tasks",
  "charge_master","claim_acknowledgments","claim_adjustments","claim_creation_failures",
  "claim_payments","claim_records","claim_submission_artifacts","claim_submission_queue",
  "clearinghouse_credentials","clearinghouse_settings","comms_events","company_memberships",
  "company_settings","company_verifications","crew_share_tokens","crews",
  "customer_payer_enrollments","daily_truck_metrics","document_attachments",
  "eligibility_checks","email_send_log","facilities","hold_timers",
  "import_mapping_templates","import_sessions","incident_reports","legal_acceptances",
  "migration_settings","onboarding_events","operational_alerts","patient_schedule_overrides",
  "patients","payer_billing_rules","payer_directory","plb_adjustments","qa_reviews",
  "remittance_files","runs","safety_overrides","schedule_change_log","schedule_previews",
  "scheduling_legs","subscription_records","subscription_status_history","support_tickets",
  "trip_events","trip_projection_state","trip_records","trip_status_history",
  "truck_availability","truck_builder_templates","truck_risk_state","truck_run_slots",
  "trucks","vehicle_inspection_alerts","vehicle_inspection_templates","vehicle_inspections",
];

const TENANT_COUNT = 10;
const DEFAULT_SCENARIO_SECONDS = 45;
const TRIP_TYPE = "ift"; // valid trip_type enum value

function log(step: string, msg: string, extra?: Record<string, unknown>) {
  console.log(JSON.stringify({ step, msg, ...(extra ?? {}) }));
}

function pct(arr: number[], p: number): number | null {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.max(0, Math.min(s.length - 1, Math.round((p / 100) * s.length) - 1));
  return Math.round(s[i] * 10) / 10;
}

async function timed<T>(fn: () => Promise<T>): Promise<[T | null, number, string | null]> {
  const t0 = performance.now();
  try {
    const r = await fn();
    return [r, performance.now() - t0, null];
  } catch (e) {
    return [null, performance.now() - t0, (e as Error).message];
  }
}

type Tenant = {
  name: string;
  company_id: string;
  owner: { user_id: string; email: string; password: string; jwt: string };
  members: Array<{ role: string; user_id: string; email: string }>;
  trucks: string[];
  patients: string[];
};

// Background runner — performs all phases and patches the report row.
async function runHarness(params: {
  admin: ReturnType<typeof createClient>;
  reportId: string;
  triggeredBy: string;
  scenarioSeconds: number;
  runTag: string;
}) {
  const { admin, reportId, triggeredBy, scenarioSeconds, runTag } = params;
  const errors: Array<{ phase: string; message: string }> = [];
  const tenants: Tenant[] = [];
  let seedAborted: string | null = null;

  try {
    // ============= PHASE 1: SEED =============
    const seedT0 = performance.now();
    for (let i = 1; i <= TENANT_COUNT; i++) {
      const name = `LOADTEST-${String(i).padStart(3, "0")}`;
      log("seed.start", name);
      try {
        const { data: co, error: coErr } = await admin.from("companies").insert({
          name,
          onboarding_status: "active",
          creator_test_tenant: false,
          owner_email: `${name.toLowerCase()}-${runTag}-owner@loadtest.invalid`,
        }).select("id").single();
        if (coErr) throw new Error(`company: ${coErr.message}`);
        const company_id = co.id;

        const memberSpecs = [
          { role: "owner", suffix: "owner" },
          { role: "dispatcher", suffix: "dispatcher" },
          { role: "biller", suffix: "biller" },
          { role: "crew", suffix: "crew1" },
          { role: "crew", suffix: "crew2" },
        ];
        const password = "LoadTest!" + crypto.randomUUID().slice(0, 12);
        const members: Tenant["members"] = [];
        let ownerJwt = "";
        let ownerUserId = "";
        let ownerEmail = "";
        for (const m of memberSpecs) {
          const email = `${name.toLowerCase()}-${runTag}-${m.suffix}@loadtest.invalid`;
          const { data: created, error: usrErr } = await admin.auth.admin.createUser({
            email, password, email_confirm: true,
            user_metadata: { loadtest: true, tenant: name, role: m.role },
          });
          if (usrErr || !created.user) throw new Error(`auth.${m.suffix}: ${usrErr?.message}`);
          const uid = created.user.id;

          const { error: pfErr } = await admin.from("profiles").insert({
            user_id: uid,
            full_name: `${m.suffix} ${name}`,
            email,
            active_company_id: company_id,
            sex: "M",
            cert_level: "EMT-B",
          });
          if (pfErr) throw new Error(`profile.${m.suffix}: ${pfErr.message}`);

          const { error: memErr } = await admin.from("company_memberships").insert({
            user_id: uid, company_id, role: m.role,
          });
          if (memErr) throw new Error(`membership.${m.suffix}: ${memErr.message}`);

          members.push({ role: m.role, user_id: uid, email });
          if (m.role === "owner") {
            ownerUserId = uid; ownerEmail = email;
            const cli = createClient(SUPABASE_URL, ANON_KEY);
            const { data: sess, error: sErr } = await cli.auth.signInWithPassword({ email, password });
            if (sErr || !sess.session) throw new Error(`signin.owner: ${sErr?.message}`);
            ownerJwt = sess.session.access_token;
          }
        }

        const truckIds: string[] = [];
        for (let n = 0; n < 3; n++) {
          const { data: t, error: tErr } = await admin.from("trucks").insert({
            company_id, name: `T${n + 1}`,
          }).select("id").single();
          if (tErr) throw new Error(`truck: ${tErr.message}`);
          truckIds.push(t.id);
        }

        const patientIds: string[] = [];
        for (let n = 0; n < 5; n++) {
          const { data: p, error: pErr } = await admin.from("patients").insert({
            company_id, first_name: `P${name}`, last_name: `#${n}`, primary_payer: "medicare",
          }).select("id").single();
          if (pErr) throw new Error(`patient: ${pErr.message}`);
          patientIds.push(p.id);
        }

        const tripRows = Array.from({ length: 30 }, (_, n) => ({
          company_id,
          patient_id: patientIds[n % 5],
          run_date: new Date().toISOString().slice(0, 10),
          status: "scheduled",
          trip_type: TRIP_TYPE,
        }));
        const { error: trErr } = await admin.from("trip_records").insert(tripRows);
        if (trErr) throw new Error(`trips: ${trErr.message}`);

        tenants.push({
          name, company_id,
          owner: { user_id: ownerUserId, email: ownerEmail, password, jwt: ownerJwt },
          members, trucks: truckIds, patients: patientIds,
        });
        log("seed.ok", name);
      } catch (e) {
        const message = (e as Error).message;
        errors.push({ phase: `seed:${name}`, message });
        log("seed.fail", name, { message });
        seedAborted = `Seed failed at ${name}: ${message}`;
        break;
      }
    }
    const seedMs = Math.round(performance.now() - seedT0);

    if (seedAborted || tenants.length === 0) {
      const failMsg = seedAborted ?? "No tenants seeded";
      log("abort", failMsg, { tenants_seeded: tenants.length });
      await admin.from("loadtest_reports").update({
        finished_at: new Date().toISOString(),
        status: "failed",
        summary: {
          tenants_seeded: tenants.length,
          seed_ms: seedMs,
          failure_reason: failMsg,
          violations: [failMsg],
          pass: false,
        },
        errors,
      }).eq("id", reportId);
      return;
    }

    // ============= PHASE 2: CROSS-TENANT HIPAA PROBE (parallel per tenant) =============
    const probeT0 = performance.now();
    const isolationLeaks: Array<{ tenant: string; table: string; visible_other_rows: number }> = [];
    let probesRun = 0;

    await Promise.all(tenants.map(async (t) => {
      log("probe.tenant", t.name);
      const cli = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${t.owner.jwt}` } },
      });
      // Probe all tables for this tenant in parallel too.
      await Promise.all(TENANT_TABLES.map(async (tbl) => {
        probesRun++;
        try {
          const { count, error } = await cli
            .from(tbl)
            .select("*", { count: "exact", head: true })
            .neq("company_id", t.company_id);
          if (error) {
            if (!/permission denied|policy/i.test(error.message)) {
              isolationLeaks.push({ tenant: t.name, table: tbl, visible_other_rows: -1 });
            }
            return;
          }
          if ((count ?? 0) > 0) {
            isolationLeaks.push({ tenant: t.name, table: tbl, visible_other_rows: count ?? 0 });
          }
        } catch (e) {
          errors.push({ phase: `probe:${t.name}.${tbl}`, message: (e as Error).message });
        }
      }));
    }));
    const probeMs = Math.round(performance.now() - probeT0);

    // ============= PHASE 3: LATENCY LOAD =============
    const loadT0 = performance.now();
    const opLatency: Record<string, number[]> = {
      select_trips: [], select_claims: [], select_dispatch_board: [], insert_trip: [],
    };
    let opErrors = 0;

    const endAt = Date.now() + scenarioSeconds * 1000;
    await Promise.all(tenants.map(async (t) => {
      const cli = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${t.owner.jwt}` } },
      });
      while (Date.now() < endAt) {
        const [, ms1, e1] = await timed(() =>
          cli.from("trip_records").select("id,status,run_date").order("run_date", { ascending: false }).limit(50));
        opLatency.select_trips.push(ms1); if (e1) opErrors++;

        const [, ms2, e2] = await timed(() =>
          cli.from("claim_records").select("id,status,amount_paid").limit(100));
        opLatency.select_claims.push(ms2); if (e2) opErrors++;

        const [, ms3, e3] = await timed(() =>
          cli.from("trucks").select("id,name").limit(50));
        opLatency.select_dispatch_board.push(ms3); if (e3) opErrors++;

        const [, ms4, e4] = await timed(() =>
          cli.from("trip_records").insert({
            company_id: t.company_id, patient_id: t.patients[0],
            run_date: new Date().toISOString().slice(0, 10),
            status: "scheduled", trip_type: TRIP_TYPE,
          }));
        opLatency.insert_trip.push(ms4); if (e4) opErrors++;
      }
    }));
    const loadMs = Math.round(performance.now() - loadT0);

    const totalOps = Object.values(opLatency).reduce((s, a) => s + a.length, 0);
    const errorRate = totalOps ? (opErrors / (totalOps + opErrors)) * 100 : 0;

    const latencyResults = Object.fromEntries(
      Object.entries(opLatency).map(([k, v]) => [k, {
        n: v.length, p50: pct(v, 50), p95: pct(v, 95), p99: pct(v, 99),
        max: v.length ? Math.round(Math.max(...v) * 10) / 10 : null,
      }])
    );

    // ============= PHASE 4: SOFT ARCHIVE =============
    const archiveT0 = performance.now();
    let archived = 0;
    for (const t of tenants) {
      const { error: aErr } = await admin.from("companies").update({
        deleted_at: new Date().toISOString(),
        deleted_by: triggeredBy,
        onboarding_status: "suspended",
        suspended_at: new Date().toISOString(),
        suspended_by: triggeredBy,
        suspended_reason: "LOADTEST cleanup",
      }).eq("id", t.company_id);
      if (aErr) errors.push({ phase: `archive:${t.name}`, message: aErr.message });
      else archived++;

      for (const m of t.members) {
        const { error: dErr } = await admin.auth.admin.deleteUser(m.user_id);
        if (dErr) errors.push({ phase: `archive:${t.name}.${m.role}`, message: dErr.message });
      }
    }
    const archiveMs = Math.round(performance.now() - archiveT0);

    // ============= REPORT =============
    const thresholds = {
      typical_p50_ms: 200, typical_p95_ms: 800, typical_p99_ms: 2000,
      pcr_claim_p95_ms: 1500, max_error_rate_pct: 0.5,
    };

    const violations: string[] = [];
    for (const [op, r] of Object.entries(latencyResults)) {
      const rr = r as { p50: number | null; p95: number | null; p99: number | null };
      if (rr.p50 != null && rr.p50 > thresholds.typical_p50_ms) violations.push(`${op} p50=${rr.p50}ms > ${thresholds.typical_p50_ms}`);
      if (rr.p95 != null && rr.p95 > thresholds.typical_p95_ms) violations.push(`${op} p95=${rr.p95}ms > ${thresholds.typical_p95_ms}`);
      if (rr.p99 != null && rr.p99 > thresholds.typical_p99_ms) violations.push(`${op} p99=${rr.p99}ms > ${thresholds.typical_p99_ms}`);
    }
    if (errorRate > thresholds.max_error_rate_pct) violations.push(`error_rate=${errorRate.toFixed(2)}% > ${thresholds.max_error_rate_pct}%`);
    if (isolationLeaks.length > 0) violations.push(`HIPAA isolation: ${isolationLeaks.length} leak(s) detected`);

    const summary = {
      tenants_seeded: tenants.length,
      tenants_archived: archived,
      probes_run: probesRun,
      isolation_leaks: isolationLeaks.length,
      total_ops: totalOps,
      op_errors: opErrors,
      error_rate_pct: Math.round(errorRate * 1000) / 1000,
      seed_ms: seedMs, probe_ms: probeMs, load_ms: loadMs, archive_ms: archiveMs,
      thresholds, violations,
      pass: violations.length === 0 && tenants.length === TENANT_COUNT,
    };

    const manifest = tenants.map((t) => ({
      name: t.name, company_id: t.company_id,
      owner_email: t.owner.email,
      members: t.members.map((m) => ({ role: m.role, email: m.email })),
    }));

    await admin.from("loadtest_reports").update({
      finished_at: new Date().toISOString(),
      status: violations.length === 0 ? "completed" : "completed_with_violations",
      summary, isolation_results: isolationLeaks,
      latency_results: latencyResults, errors, manifest,
    }).eq("id", reportId);
  } catch (err) {
    log("fatal", (err as Error).message);
    await admin.from("loadtest_reports").update({
      finished_at: new Date().toISOString(),
      status: "failed",
      summary: { failure_reason: (err as Error).message, violations: [(err as Error).message], pass: false },
      errors: [...errors, { phase: "fatal", message: (err as Error).message }],
    }).eq("id", reportId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ─── auth gate: system creator only ───────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return j({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return j({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: sc } = await admin
      .from("system_creators").select("user_id").eq("user_id", u.user.id).maybeSingle();
    if (!sc) return j({ error: "Forbidden — system creators only" }, 403);

    const body = await req.json().catch(() => ({}));
    const scenarioSeconds = Math.min(Math.max(Number(body?.scenario_seconds) || DEFAULT_SCENARIO_SECONDS, 15), 90);

    const runTag = Date.now().toString(36) + crypto.randomUUID().slice(0, 4);

    const { data: report, error: reportErr } = await admin
      .from("loadtest_reports").insert({
        triggered_by: u.user.id,
        scenario_seconds: scenarioSeconds,
        tenant_count: TENANT_COUNT,
        status: "running",
      }).select("id").single();
    if (reportErr || !report) return j({ error: `Failed to open report: ${reportErr?.message}` }, 500);
    const reportId = report.id;

    // Kick off the heavy work in the background and return immediately.
    // The client polls loadtest_reports for status/summary updates.
    // @ts-ignore: EdgeRuntime is provided by Supabase edge runtime
    EdgeRuntime.waitUntil(
      runHarness({ admin, reportId, triggeredBy: u.user.id, scenarioSeconds, runTag })
    );

    return j({ ok: true, report_id: reportId, status: "running" }, 202);
  } catch (err) {
    return j({ error: (err as Error).message ?? "Unknown error" }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}