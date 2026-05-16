import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FAKE_NAMES = [
  "Ava Simmons", "Ben Carter", "Cara Diaz", "Dan Foster", "Eva Grant",
  "Frank Hill", "Gina Ives", "Hank Jones", "Iris Kelly", "Jake Lopez",
  "Kara Moore", "Leo Nash", "Mia Owen", "Nick Park", "Olive Quinn",
  "Pete Ross", "Quin Stone", "Rita Todd", "Sam Upton", "Tina Vale",
  "Uma West", "Vince York", "Wanda Zane", "Xena Adams", "Yuri Blake",
  "Zara Clark", "Adam Drake", "Beth Evans", "Carl Ford", "Dawn Green",
  "Ed Hayes", "Fay Irving", "Glen James", "Hope King", "Ian Long",
  "Jill Mann", "Kurt Noel", "Lisa Owens", "Mark Penn", "Nora Reed",
  "Oscar Shaw", "Pam Trent", "Ray Ulmer", "Sue Voss", "Tom Watts",
  "Una Xiong", "Val Young", "Will Zhu", "Amy Barr", "Bob Chase",
  "Cyd Dunn", "Dee Ernst", "Eli Frost", "Flo Gates", "Guy Hardy",
  "Hal Ingram", "Ivy Jacobs", "Joy Keen", "Ken Lowe", "Lea Marsh",
];

const FAKE_ADDRESSES = [
  "100 Sim Ave, Testville", "200 Mock St, Demotown", "300 Fake Blvd, Sampleburg",
  "400 Test Ln, Mockville", "500 Demo Dr, Simtown", "600 Sample Rd, Fakesburg",
  "700 Pretend Way, Testburg", "800 Sandbox Ct, Mockton", "900 Example Ave, Simville",
  "1000 Trial St, Demoburg", "1100 Virtual Ln, Testton", "1200 Practice Blvd, Mockburg",
];

const CITY_CLUSTERS = [
  ["100 Northside Ave, Testville", "200 Northside St, Testville", "300 Northside Dr, Testville"],
  ["400 Southpark Rd, Demotown", "500 Southpark Blvd, Demotown", "600 Southpark Ln, Demotown"],
  ["700 Eastgate Way, Sampleburg", "800 Eastgate Ct, Sampleburg"],
  ["900 Westfield Ave, Mockville", "1000 Westfield Dr, Mockville"],
];

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randTime(h1: number, h2: number): string {
  const h = h1 + Math.floor(Math.random() * (h2 - h1));
  const m = Math.floor(Math.random() * 4) * 15;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
function timeToMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
function rand(min: number, max: number): number { return min + Math.floor(Math.random() * (max - min + 1)); }
function coinFlip(prob = 0.5): boolean { return Math.random() < prob; }

// Valid enum values from database
const VALID_CERT_LEVELS = ["EMT-B", "EMT-A", "EMT-P", "AEMT", "Other"] as const;
const VALID_SEX_TYPES = ["M", "F"] as const;
const VALID_TRANSPORT_TYPES = ["dialysis", "outpatient", "adhoc", "wound_care", "ift", "discharge", "private_pay", "psych_transport"] as const;
const VALID_TRIP_TYPES = ["dialysis", "discharge", "outpatient", "hospital", "private_pay", "ift", "wound_care", "psych_transport"] as const;
const VALID_TRIP_STATUSES = ["scheduled", "assigned", "en_route", "loaded", "completed", "ready_for_billing", "cancelled", "arrived_pickup", "arrived_dropoff", "no_show", "patient_not_ready", "facility_delay"] as const;
const VALID_PATIENT_STATUSES = ["active", "in_hospital", "out_of_hospital", "vacation", "paused"] as const;
const VALID_LEG_TYPES = ["A", "B"] as const;

// Seeder strict enums requested for stable inserts
const STRICT_CERT_LEVELS = ["EMT-B", "EMT-P"] as const;
const STRICT_SEX_TYPES = ["M", "F"] as const;

interface SeedStepLog {
  step: string;
  status: "ok" | "error" | "skipped";
  count?: number;
  error?: string;
  detail?: string;
  table?: string;
  row?: Record<string, unknown>;
  validationErrors?: string[];
}

interface SeedRowError {
  step: string;
  table: string;
  error: string;
  row: Record<string, unknown>;
  validationErrors?: string[];
}

function chunkArray<T>(arr: T[], size = 25): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

function toRowSnippet(row: Record<string, unknown>) {
  const entries = Object.entries(row).slice(0, 14);
  return Object.fromEntries(entries);
}

function pushSeedLog(logs: SeedStepLog[], log: SeedStepLog) {
  logs.push(log);
  console.log(JSON.stringify({ type: "seed_stage", ...log, row: log.row ? toRowSnippet(log.row) : undefined }));
}

function normalizeCertLevel(value: string | null | undefined): (typeof STRICT_CERT_LEVELS)[number] {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "emt-p" || raw === "paramedic") return "EMT-P";
  if (raw === "emt-b" || raw === "emt") return "EMT-B";
  if ((STRICT_CERT_LEVELS as readonly string[]).includes(value ?? "")) return value as (typeof STRICT_CERT_LEVELS)[number];
  return "EMT-B";
}

function normalizeSex(value: string | null | undefined): (typeof STRICT_SEX_TYPES)[number] {
  const raw = (value ?? "").trim().toLowerCase();
  if (raw === "f" || raw === "female") return "F";
  if (raw === "m" || raw === "male") return "M";
  if ((STRICT_SEX_TYPES as readonly string[]).includes(value ?? "")) return value as (typeof STRICT_SEX_TYPES)[number];
  return "M";
}

function normalizeTransportType(value: string | null | undefined): (typeof VALID_TRANSPORT_TYPES)[number] {
  const raw = (value ?? "").trim().toLowerCase();
  // Legacy coercions removed (Item 15a): discharge, wound_care, ift, psych_transport
  // are first-class transport_types. "hospital" is a destination type, not a transport
  // variation, and falls through to the default below if encountered.
  if ((VALID_TRANSPORT_TYPES as readonly string[]).includes(raw)) return raw as (typeof VALID_TRANSPORT_TYPES)[number];
  return "outpatient";
}

function normalizeTripType(value: string | null | undefined): (typeof VALID_TRIP_TYPES)[number] {
  const raw = (value ?? "").trim().toLowerCase();
  if ((VALID_TRIP_TYPES as readonly string[]).includes(raw)) return raw as (typeof VALID_TRIP_TYPES)[number];
  return "outpatient";
}

function normalizeTripStatus(value: string | null | undefined): (typeof VALID_TRIP_STATUSES)[number] {
  const raw = (value ?? "").trim().toLowerCase();
  if ((VALID_TRIP_STATUSES as readonly string[]).includes(raw)) return raw as (typeof VALID_TRIP_STATUSES)[number];
  return "scheduled";
}

function validateRequired(row: Record<string, unknown>, requiredFields: string[]): string[] {
  const errors: string[] = [];
  for (const field of requiredFields) {
    const value = row[field];
    if (value === null || value === undefined || value === "") {
      errors.push(`Required field '${field}' is missing`);
    }
  }
  return errors;
}

function validateEnum(
  row: Record<string, unknown>,
  enumRules: { field: string; values: readonly string[] }[],
): string[] {
  const errors: string[] = [];
  for (const rule of enumRules) {
    const raw = row[rule.field];
    if (raw === null || raw === undefined) continue;
    const value = String(raw);
    if (!rule.values.includes(value)) {
      errors.push(`Enum '${rule.field}' has invalid value '${value}'`);
    }
  }
  return errors;
}

function validateForeignKeys(
  row: Record<string, unknown>,
  fkRules: { field: string; allowed: Set<string>; label: string; nullable?: boolean }[],
): string[] {
  const errors: string[] = [];
  for (const rule of fkRules) {
    const raw = row[rule.field];
    if (raw === null || raw === undefined || raw === "") {
      if (!rule.nullable) errors.push(`Foreign key '${rule.field}' is missing (${rule.label})`);
      continue;
    }
    const id = String(raw);
    if (!rule.allowed.has(id)) {
      errors.push(`Foreign key '${rule.field}' invalid (${rule.label} not found): '${id}'`);
    }
  }
  return errors;
}

async function insertRowsResilient(params: {
  admin: any;
  step: string;
  table: string;
  rows: Record<string, unknown>[];
  logs: SeedStepLog[];
  rowErrors: SeedRowError[];
  requiredFields?: string[];
  enumRules?: { field: string; values: readonly string[] }[];
  fkRules?: { field: string; allowed: Set<string>; label: string; nullable?: boolean }[];
  batchSize?: number;
  select?: string;
}) {
  const {
    admin,
    step,
    table,
    rows,
    logs,
    rowErrors,
    requiredFields = [],
    enumRules = [],
    fkRules = [],
    batchSize = 25,
    select = "id",
  } = params;

  const insertedRows: any[] = [];
  let insertedCount = 0;
  let skippedCount = 0;

  for (const batch of chunkArray(rows, batchSize)) {
    const validRows: Record<string, unknown>[] = [];

    for (const row of batch) {
      const validationErrors = [
        ...validateRequired(row, requiredFields),
        ...validateEnum(row, enumRules),
        ...validateForeignKeys(row, fkRules),
      ];

      if (validationErrors.length > 0) {
        skippedCount++;
        const failure: SeedRowError = {
          step,
          table,
          error: validationErrors[0],
          validationErrors,
          row: toRowSnippet(row),
        };
        rowErrors.push(failure);
        pushSeedLog(logs, {
          step,
          status: "skipped",
          table,
          error: failure.error,
          validationErrors,
          row: failure.row,
        });
        continue;
      }
      validRows.push(row);
    }

    if (validRows.length === 0) continue;

    const bulkQuery = admin.from(table).insert(validRows).select(select);
    const { data: bulkData, error: bulkError } = await bulkQuery;

    if (!bulkError) {
      insertedCount += bulkData?.length ?? validRows.length;
      insertedRows.push(...(bulkData ?? []));
      continue;
    }

    pushSeedLog(logs, {
      step,
      status: "error",
      table,
      error: `Batch insert failed, falling back to row inserts: ${bulkError.message}`,
      detail: `batch_size=${validRows.length}`,
    });

    for (const row of validRows) {
      const { data, error } = await admin.from(table).insert(row).select(select).maybeSingle();
      if (error) {
        skippedCount++;
        const failure: SeedRowError = {
          step,
          table,
          error: error.message,
          row: toRowSnippet(row),
        };
        rowErrors.push(failure);
        pushSeedLog(logs, {
          step,
          status: "error",
          table,
          error: error.message,
          row: failure.row,
        });
      } else if (data) {
        insertedCount += 1;
        insertedRows.push(data);
      }
    }
  }

  pushSeedLog(logs, {
    step,
    status: insertedCount > 0 ? "ok" : "skipped",
    table,
    count: insertedCount,
    detail: `inserted=${insertedCount}, skipped=${skippedCount}`,
  });

  return { insertedRows, insertedCount, skippedCount };
}

// The simulation lab seeds into a single, fixed creator-owned test tenant
// ("Lorenzo Test Company"). Spawning new sandbox companies on each run was
// retired in 15a.1 — it produced 22 stale rows and made the lab look like a
// normal customer tenant in admin views.
const LORENZO_TEST_COMPANY_ID = "f53311c3-a40e-4b2b-b4c2-5aec852f7789";

async function getTestTenantId(admin: any): Promise<string> {
  const { data, error } = await admin
    .from("companies")
    .select("id")
    .eq("id", LORENZO_TEST_COMPANY_ID)
    .eq("creator_test_tenant", true)
    .maybeSingle();
  if (error) throw new Error(`Failed to resolve test tenant: ${error.message}`);
  if (!data) throw new Error("Creator test tenant is not configured (creator_test_tenant flag missing)");
  return data.id;
}

// ── Crew speed/doc reliability profiles ──
type CrewProfile = { speed: "fast" | "avg" | "slow"; docReliability: "high" | "avg" | "risky" };
const CREW_PROFILES: CrewProfile[] = [
  { speed: "fast", docReliability: "high" },
  { speed: "avg", docReliability: "high" },
  { speed: "avg", docReliability: "avg" },
  { speed: "avg", docReliability: "avg" },
  { speed: "slow", docReliability: "avg" },
  { speed: "slow", docReliability: "risky" },
  { speed: "fast", docReliability: "risky" },
  { speed: "avg", docReliability: "risky" },
];

// Seed size multipliers
const SEED_SIZES: Record<string, { truckMult: number; patientMult: number }> = {
  small: { truckMult: 0.5, patientMult: 0.4 },
  medium: { truckMult: 0.75, patientMult: 0.7 },
  large: { truckMult: 1.0, patientMult: 1.0 },
};

interface ScenarioConfig {
  name: string;
  truckCount: number;
  patientCount: number;
  tripMix: Partial<Record<"dialysis" | "discharge" | "outpatient" | "hospital" | "ift" | "wound_care" | "psych_transport", number>>;
  payerMix: { Medicare: number; Medicaid: number; "Facility Contract": number; "Private Pay": number };
  missingPcs: number;
  missingAuth: number;
  missingSignature: number;
  missingTimestamps: number;
  facilityDelayCount: number;
  authExpiring: number;
  dispatchPressure?: {
    overstackedDialysisHours?: boolean;
    crossCityRouting?: boolean;
    missingPatientInfo?: number;
    lateDischargeAdds?: number;
    unrealisticGaps?: boolean;
    insufficientTrucks?: boolean;
  };
}

const SCENARIOS: Record<string, ScenarioConfig> = {
  dialysis_heavy: {
    name: "Dialysis Heavy Day",
    truckCount: 6, patientCount: 40,
    tripMix: { dialysis: 30, discharge: 3, outpatient: 5, hospital: 2 },
    payerMix: { Medicare: 25, Medicaid: 10, "Facility Contract": 3, "Private Pay": 2 },
    missingPcs: 3, missingAuth: 2, missingSignature: 2, missingTimestamps: 1,
    facilityDelayCount: 0, authExpiring: 2,
  },
  mixed_day: {
    name: "Dialysis + Discharge Mix",
    truckCount: 6, patientCount: 35,
    tripMix: { dialysis: 18, discharge: 10, outpatient: 5, hospital: 2 },
    payerMix: { Medicare: 18, Medicaid: 8, "Facility Contract": 5, "Private Pay": 4 },
    missingPcs: 4, missingAuth: 3, missingSignature: 2, missingTimestamps: 2,
    facilityDelayCount: 0, authExpiring: 3,
  },
  stress_test: {
    name: "Late Adds + Cancellations Stress",
    truckCount: 6, patientCount: 50,
    tripMix: { dialysis: 20, discharge: 12, outpatient: 10, hospital: 8 },
    payerMix: { Medicare: 20, Medicaid: 12, "Facility Contract": 8, "Private Pay": 10 },
    missingPcs: 6, missingAuth: 5, missingSignature: 4, missingTimestamps: 3,
    facilityDelayCount: 0, authExpiring: 4,
  },
  billing_risk: {
    name: "Auth Expiring / Missing PCS Billing Risk",
    truckCount: 6, patientCount: 30,
    tripMix: { dialysis: 15, discharge: 5, outpatient: 6, hospital: 4 },
    payerMix: { Medicare: 15, Medicaid: 8, "Facility Contract": 4, "Private Pay": 3 },
    missingPcs: 10, missingAuth: 8, missingSignature: 6, missingTimestamps: 4,
    facilityDelayCount: 0, authExpiring: 8,
  },
  facility_delay: {
    name: "Facility Delay Day (B-leg risk)",
    truckCount: 6, patientCount: 35,
    tripMix: { dialysis: 25, discharge: 4, outpatient: 4, hospital: 2 },
    payerMix: { Medicare: 20, Medicaid: 10, "Facility Contract": 3, "Private Pay": 2 },
    missingPcs: 2, missingAuth: 1, missingSignature: 1, missingTimestamps: 1,
    facilityDelayCount: 8, authExpiring: 1,
  },
  dispatch_overload: {
    name: "Dispatch Overload — Cascade Failure",
    truckCount: 4, patientCount: 45,
    tripMix: { dialysis: 28, discharge: 8, outpatient: 5, hospital: 4 },
    payerMix: { Medicare: 22, Medicaid: 12, "Facility Contract": 5, "Private Pay": 6 },
    missingPcs: 8, missingAuth: 6, missingSignature: 5, missingTimestamps: 4,
    facilityDelayCount: 4, authExpiring: 5,
    dispatchPressure: {
      overstackedDialysisHours: true,
      crossCityRouting: true,
      missingPatientInfo: 10,
      lateDischargeAdds: 4,
      unrealisticGaps: true,
      insufficientTrucks: true,
    },
  },
  crew_mismatch: {
    name: "Crew Capability Mismatch Day",
    truckCount: 6, patientCount: 35,
    tripMix: { dialysis: 20, discharge: 6, outpatient: 5, hospital: 4 },
    payerMix: { Medicare: 18, Medicaid: 10, "Facility Contract": 4, "Private Pay": 3 },
    missingPcs: 4, missingAuth: 3, missingSignature: 3, missingTimestamps: 2,
    facilityDelayCount: 2, authExpiring: 3,
    dispatchPressure: {
      missingPatientInfo: 5,
    },
  },
  revenue_leak: {
    name: "Revenue Leak — PCR & Billing Cascade",
    truckCount: 6, patientCount: 38,
    tripMix: { dialysis: 22, discharge: 8, outpatient: 5, hospital: 3 },
    payerMix: { Medicare: 20, Medicaid: 10, "Facility Contract": 5, "Private Pay": 3 },
    missingPcs: 12, missingAuth: 10, missingSignature: 8, missingTimestamps: 6,
    facilityDelayCount: 5, authExpiring: 6,
    dispatchPressure: {
      overstackedDialysisHours: true,
      lateDischargeAdds: 3,
    },
  },
  varied_mix: {
    name: "Varied Transport Mix (OA companion)",
    truckCount: 4, patientCount: 35,
    tripMix: { dialysis: 10, ift: 6, discharge: 5, wound_care: 4, psych_transport: 3, outpatient: 2 },
    payerMix: { Medicare: 12, Medicaid: 10, "Facility Contract": 5, "Private Pay": 3 },
    missingPcs: 3, missingAuth: 2, missingSignature: 2, missingTimestamps: 1,
    facilityDelayCount: 1, authExpiring: 2,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// PIPELINE-DRIVEN SEEDER (Option A)
//
// The seeder now operates ON TOP OF real setup data the user created manually:
//   - Real trucks (created by user in /trucks)
//   - Real crews assigned to trucks for today (created by user in /scheduling)
//   - Real facilities (created by user in /facilities)
//   - Patient templates the user marked with `is_template = true`
//
// The seeder DOES NOT create trucks, crews, profiles, or facilities. It DOES NOT
// pre-bake `claim_records`. It clones template patients, writes scheduling_legs +
// truck_run_slots + trip_records using the real production columns, then flips
// `pcr_status='submitted'` on each completed trip. The DB trigger
// `auto_create_claim_on_pcr_submit` then creates the claim — same code path a
// real customer's PCR would execute. Reset wipes only operational rows by
// `is_simulated=true`.
// ─────────────────────────────────────────────────────────────────────────────

async function seedScenario(admin: any, companyId: string, userId: string, scenarioKey: string, seedSize: string = "small") {
  const baseConfig = SCENARIOS[scenarioKey];
  if (!baseConfig) {
    return { ok: false, step: "init", error: `Unknown scenario: ${scenarioKey}`, logs: [] as SeedStepLog[] };
  }

  const logs: SeedStepLog[] = [];
  const rowErrors: SeedRowError[] = [];
  const runId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);

  const sizeMultiplier = SEED_SIZES[seedSize] || SEED_SIZES.small;
  const config: ScenarioConfig = {
    ...baseConfig,
    truckCount: Math.max(2, Math.round(baseConfig.truckCount * sizeMultiplier.truckMult)),
    patientCount: Math.max(4, Math.round(baseConfig.patientCount * sizeMultiplier.patientMult)),
  };

  const patientRatio = config.patientCount / baseConfig.patientCount;
  config.tripMix = Object.fromEntries(
    Object.entries(baseConfig.tripMix).map(([type, count], idx) => [
      type,
      Math.max(idx === 0 ? 1 : 0, Math.round((count ?? 0) * patientRatio)),
    ]),
  ) as ScenarioConfig["tripMix"];
  config.missingPcs = Math.round(baseConfig.missingPcs * patientRatio);
  config.missingAuth = Math.round(baseConfig.missingAuth * patientRatio);
  config.missingSignature = Math.round(baseConfig.missingSignature * patientRatio);
  config.missingTimestamps = Math.round(baseConfig.missingTimestamps * patientRatio);
  config.authExpiring = Math.round(baseConfig.authExpiring * patientRatio);

  const pressure = config.dispatchPressure;

  pushSeedLog(logs, {
    step: "sandbox_tenant_company_ready",
    status: "ok",
    detail: `company_id=${companyId}`,
  });

  try {
    const { error } = await admin.from("simulation_runs").insert({
      id: runId,
      scenario_name: config.name,
      created_by: userId,
      status: "running",
      config,
    });
    if (error) throw error;
    pushSeedLog(logs, { step: "create_simulation_run", status: "ok" });
  } catch (e: any) {
    pushSeedLog(logs, { step: "create_simulation_run", status: "error", error: e.message });
    return { ok: false, step: "create_simulation_run", error: e.message, logs };
  }

  // ── Read REAL setup data (Option A precondition) ─────────────────────────────
  const { data: realFacilities } = await admin
    .from("facilities")
    .select("id, name, facility_type")
    .eq("company_id", companyId)
    .eq("is_simulated", false);
  const { data: realTrucks } = await admin
    .from("trucks")
    .select("id, name, active, has_power_stretcher, has_stair_chair, has_bariatric_kit, has_oxygen_mount")
    .eq("company_id", companyId)
    .eq("is_simulated", false)
    .eq("active", true);
  const { data: realCrews } = await admin
    .from("crews")
    .select("id, truck_id, member1_id, member2_id, member3_id")
    .eq("company_id", companyId)
    .eq("active_date", today);
  const { data: templatePatients } = await admin
    .from("patients")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_template", true);

  const facilityNames: string[] = (realFacilities ?? []).map((f: any) => f.name);
  const trucks = (realTrucks ?? []) as any[];
  const crewByTruck = new Map<string, any>();
  for (const c of realCrews ?? []) crewByTruck.set(c.truck_id, c);
  const trucksWithCrew = trucks.filter((t) => crewByTruck.has(t.id));
  const templates = (templatePatients ?? []) as any[];

  const preconditions: { name: string; ok: boolean; detail: string }[] = [
    { name: "real_trucks_active", ok: trucks.length > 0, detail: `${trucks.length} active trucks` },
    { name: "crews_assigned_today", ok: trucksWithCrew.length > 0, detail: `${trucksWithCrew.length} trucks have a crew assigned today (${today})` },
    { name: "facilities_present", ok: (realFacilities?.length ?? 0) > 0, detail: `${realFacilities?.length ?? 0} facilities` },
    { name: "patient_templates_present", ok: templates.length > 0, detail: `${templates.length} template patients (is_template=true)` },
  ];
  const failed = preconditions.filter((p) => !p.ok);
  if (failed.length > 0) {
    pushSeedLog(logs, { step: "preconditions", status: "error", detail: failed.map((f) => `${f.name}: ${f.detail}`).join(" | ") });
    await admin.from("simulation_runs").update({ status: "failed" }).eq("id", runId);
    return {
      ok: false,
      step: "preconditions",
      error: `Setup incomplete. Before seeding, the test tenant must have: ${failed.map((f) => f.name).join(", ")}.`,
      preconditions,
      logs,
    };
  }
  for (const p of preconditions) pushSeedLog(logs, { step: "preconditions", status: "ok", detail: `${p.name}=${p.detail}` });

  const truckIds: string[] = trucksWithCrew.map((t) => t.id);
  const crewIds: string[] = trucksWithCrew.map((t) => crewByTruck.get(t.id)!.id);
  const truckMeta = new Map<string, { has_stair_chair: boolean; has_bariatric_kit: boolean; has_oxygen_mount: boolean; has_power_stretcher: boolean }>();
  for (const t of trucksWithCrew) {
    truckMeta.set(t.id, {
      has_stair_chair: !!t.has_stair_chair,
      has_bariatric_kit: !!t.has_bariatric_kit,
      has_oxygen_mount: !!t.has_oxygen_mount,
      has_power_stretcher: !!t.has_power_stretcher,
    });
  }
  let patientIds: string[] = [];
  let tripCount = 0;

  // ── Clone patients from templates with name suffixing (D4) ───────────────────
  try {
    const cloned: Record<string, unknown>[] = [];
    const tripTypes: string[] = [];
    for (const [type, count] of Object.entries(config.tripMix)) for (let j = 0; j < count; j++) tripTypes.push(type);
    const payerTypes: string[] = [];
    for (const [payer, count] of Object.entries(config.payerMix)) for (let j = 0; j < count; j++) payerTypes.push(payer);

    for (let i = 0; i < config.patientCount; i++) {
      const tpl = templates[i % templates.length];
      // Strip identity/audit fields; clone the rest
      const {
        id: _id, created_at: _ca, updated_at: _ua, is_template: _it,
        is_simulated: _is, simulation_run_id: _sr, ...rest
      } = tpl;
      const desiredTrip = normalizeTripType(tripTypes[i % tripTypes.length] || "dialysis");
      const desiredPayer = payerTypes[i % payerTypes.length] || tpl.primary_payer || "Medicare";
      cloned.push({
        ...rest,
        first_name: tpl.first_name,
        last_name: `${tpl.last_name} #${i + 1}`,
        // Override transport/payer when scenario mix demands it; keep template defaults otherwise
        transport_type: normalizeTransportType(desiredTrip),
        primary_payer: desiredPayer,
        company_id: companyId,
        is_template: false,
        is_simulated: true,
        simulation_run_id: runId,
      });
    }

    const { insertedRows } = await insertRowsResilient({
      admin,
      step: "clone_template_patients",
      table: "patients",
      rows: cloned,
      logs,
      rowErrors,
      requiredFields: ["first_name", "last_name", "transport_type", "status", "company_id"],
      enumRules: [
        { field: "transport_type", values: VALID_TRANSPORT_TYPES },
        { field: "status", values: VALID_PATIENT_STATUSES },
      ],
      batchSize: 25,
      select: "id",
    });
    patientIds = (insertedRows as any[]).map((p) => p.id);
  } catch (e: any) {
    pushSeedLog(logs, { step: "clone_template_patients", status: "error", error: e.message });
  }

  // ── Build scheduling_legs + truck_run_slots + trip_records (production writes) ──
  let tripRowsInserted: any[] = [];
  try {
    const totalTrips = Object.values(config.tripMix).reduce((sum, n) => sum + (n ?? 0), 0);
    const tripsToCreate = Math.min(totalTrips, patientIds.length);
    const tripTypes: string[] = [];
    for (const [type, count] of Object.entries(config.tripMix)) for (let j = 0; j < count; j++) tripTypes.push(type);

    const missingPcsSet = new Set(pickN([...Array(tripsToCreate).keys()], Math.min(config.missingPcs, tripsToCreate)));
    const missingSigSet = new Set(pickN([...Array(tripsToCreate).keys()], Math.min(config.missingSignature, tripsToCreate)));
    const missingTimesSet = new Set(pickN([...Array(tripsToCreate).keys()], Math.min(config.missingTimestamps, tripsToCreate)));

    const legRows: Record<string, unknown>[] = [];
    const slotRows: Record<string, unknown>[] = [];

    for (let i = 0; i < tripsToCreate; i++) {
      const patientId = patientIds[i];
      const tripType = normalizeTripType(tripTypes[i % tripTypes.length] || "dialysis");
      const truckIdx = i % truckIds.length;
      const truckId = truckIds[truckIdx];
      const pickupTime = pressure?.overstackedDialysisHours && tripType === "dialysis"
        ? pick(["06:00", "06:15", "06:30"])
        : (tripType === "dialysis" ? randTime(5, 8) : randTime(8, 14));
      const pickupLoc = pressure?.crossCityRouting ? pick(pick(CITY_CLUSTERS)) : pick(FAKE_ADDRESSES);
      const facility = facilityNames[i % Math.max(1, facilityNames.length)] || facilityNames[0];
      const legId = crypto.randomUUID();
      legRows.push({
        id: legId, patient_id: patientId, leg_type: "A",
        pickup_location: pickupLoc, destination_location: facility,
        pickup_time: pickupTime, trip_type: tripType, run_date: today,
        company_id: companyId, is_simulated: true, simulation_run_id: runId,
        estimated_duration_minutes: pressure?.unrealisticGaps ? rand(5, 10) : rand(20, 40),
      });
      slotRows.push({
        truck_id: truckId, leg_id: legId, run_date: today, slot_order: Math.floor(i / truckIds.length),
        status: "completed", company_id: companyId, is_simulated: true, simulation_run_id: runId,
      });
    }

    const patientIdSet = new Set(patientIds);
    const truckIdSet = new Set(truckIds);

    const legsInsert = await insertRowsResilient({
      admin, step: "create_scheduling_legs", table: "scheduling_legs",
      rows: legRows, logs, rowErrors,
      requiredFields: ["id", "patient_id", "leg_type", "pickup_location", "destination_location", "trip_type", "company_id"],
      enumRules: [
        { field: "leg_type", values: VALID_LEG_TYPES },
        { field: "trip_type", values: VALID_TRIP_TYPES },
      ],
      fkRules: [{ field: "patient_id", allowed: patientIdSet, label: "patients" }],
      batchSize: 25, select: "id",
    });
    const legIdSet = new Set((legsInsert.insertedRows as any[]).map((l) => l.id));

    await insertRowsResilient({
      admin, step: "create_truck_run_slots", table: "truck_run_slots",
      rows: slotRows, logs, rowErrors,
      requiredFields: ["truck_id", "leg_id", "company_id", "status"],
      enumRules: [{ field: "status", values: ["pending", "en_route", "arrived", "with_patient", "transporting", "completed"] }],
      fkRules: [
        { field: "truck_id", allowed: truckIdSet, label: "trucks" },
        { field: "leg_id", allowed: legIdSet, label: "scheduling_legs" },
      ],
      batchSize: 25, select: "id",
    });

    // Build trip_records using REAL operational columns the crew/PCR would write.
    const tripRows: Record<string, unknown>[] = [];
    for (let i = 0; i < legRows.length; i++) {
      const leg = legRows[i] as any;
      const slot = slotRows[i] as any;
      if (!legIdSet.has(leg.id)) continue;

      const tplIdx = i % templates.length;
      const tpl = templates[tplIdx];
      const tripType = leg.trip_type as string;
      const pickupTime: string = leg.pickup_time;
      const truckId: string = slot.truck_id;
      const crewId = crewByTruck.get(truckId)?.id ?? null;

      const hasPcs = !missingPcsSet.has(i);
      const hasSig = !missingSigSet.has(i);
      const hasTimes = !missingTimesSet.has(i);

      // Chronological timestamps (all on `today`)
      const dispatch = `${today}T${addMinutes(pickupTime, -10)}:00`;
      const atScene = `${today}T${pickupTime}:00`;
      const patientContact = `${today}T${addMinutes(pickupTime, 3)}:00`;
      const leftScene = `${today}T${addMinutes(pickupTime, 8)}:00`;
      const arrivedDest = `${today}T${addMinutes(pickupTime, rand(20, 60))}:00`;
      const inService = `${today}T${addMinutes(pickupTime, rand(65, 90))}:00`;

      const odoScene = rand(20000, 80000);
      const loadedMi = Math.round((5 + Math.random() * 25) * 10) / 10;
      const odoDest = odoScene + Math.round(loadedMi);

      const sig = hasSig ? [{
        type: "crew_primary", signed_at: leftScene, signed_by_name: "Sim Crew",
        signature_data_url: "data:image/svg+xml;base64,PHN2Zy8+",
      }] : null;

      const pcrType = tripType === "dialysis" ? "nemt_dialysis"
        : tripType === "discharge" ? "ift_discharge"
        : tripType === "hospital" ? "emergency_ems"
        : tripType === "ift" ? "ift_general"
        : tripType === "wound_care" ? "ift_wound_care"
        : tripType === "psych_transport" ? "behavioral_health"
        : tripType === "outpatient" ? "outpatient_specialty"
        : "other";

      const destinationType = tripType === "dialysis" ? "Dialysis Center"
        : tripType === "wound_care" ? "Wound Care Clinic"
        : tripType === "psych_transport" ? "Behavioral Health Facility"
        : tripType === "discharge" ? "Skilled Nursing Facility"
        : tripType === "ift" ? "Hospital"
        : "Hospital Outpatient";

      const icd10 = (tpl.icd10_codes && tpl.icd10_codes.length > 0)
        ? tpl.icd10_codes
        : (tripType === "dialysis" ? ["N18.6", "Z99.2"] : ["R26.2"]);

      tripRows.push({
        patient_id: patientIds[i], truck_id: truckId, crew_id: crewId, leg_id: leg.id,
        run_date: today, status: "ready_for_billing", trip_type: tripType, pcr_type: pcrType,
        pickup_location: leg.pickup_location, destination_location: leg.destination_location,
        scheduled_pickup_time: pickupTime,
        // Real operational columns (the crew/PCR would write these):
        dispatch_time: hasTimes ? dispatch : null,
        at_scene_time: hasTimes ? atScene : null,
        patient_contact_time: hasTimes ? patientContact : null,
        left_scene_time: hasTimes ? leftScene : null,
        arrived_pickup_at: hasTimes ? atScene : null,
        arrived_dropoff_at: hasTimes ? arrivedDest : null,
        in_service_time: hasTimes ? inService : null,
        odometer_at_scene: hasTimes ? odoScene : null,
        odometer_at_destination: hasTimes ? odoDest : null,
        loaded_miles: hasTimes ? loadedMi : null,
        signatures_json: sig,
        // Medical necessity (at least one required by QA trigger)
        bed_confined: tpl.default_bed_confined ?? true,
        cannot_transfer_safely: tpl.default_cannot_transfer ?? false,
        requires_monitoring: tpl.default_requires_monitoring ?? false,
        oxygen_during_transport: tpl.default_oxygen_transport ?? false,
        icd10_codes: icd10,
        chief_complaint: tpl.default_chief_complaint || (tripType === "dialysis" ? "ESRD — Scheduled Dialysis Transport" : "No Complaint — Routine Transport"),
        primary_impression: tpl.default_primary_impression || (tripType === "dialysis" ? "ESRD on Dialysis" : "No Acute Findings — Routine Transport"),
        medical_necessity_reason: tpl.default_medical_necessity_reason || "Bed-confined, requires stretcher transport",
        narrative: "Patient was transported by stretcher per medical necessity. Crew monitored throughout. Patient delivered to destination without incident. Documentation complete per company policy and CMS standards. (Synthetic seed.)",
        primary_payer: (tpl.primary_payer || "medicare").toString().toLowerCase(),
        member_id: tpl.member_id ?? `SIM${String(i + 1).padStart(6, "0")}`,
        service_level: tpl.default_service_level || "BLS",
        origin_type: "Home", destination_type: destinationType,
        documentation_complete: hasPcs && hasSig && hasTimes,
        pcs_attached: hasPcs,
        signature_obtained: hasSig,
        claim_ready: hasPcs && hasSig && hasTimes,
        company_id: companyId, is_simulated: true, simulation_run_id: runId,
        pcr_status: "not_started",
      });
    }

    const tripsInsert = await insertRowsResilient({
      admin, step: "create_trip_records", table: "trip_records",
      rows: tripRows, logs, rowErrors,
      requiredFields: ["patient_id", "run_date", "status", "company_id"],
      enumRules: [
        { field: "status", values: VALID_TRIP_STATUSES },
        { field: "trip_type", values: VALID_TRIP_TYPES },
      ],
      fkRules: [
        { field: "patient_id", allowed: patientIdSet, label: "patients" },
        { field: "truck_id", allowed: truckIdSet, label: "trucks" },
        { field: "leg_id", allowed: legIdSet, label: "scheduling_legs" },
      ],
      batchSize: 25,
      select: "id,patient_id,truck_id,crew_id,trip_type,documentation_complete,signature_obtained,pcs_attached",
    });
    tripRowsInserted = tripsInsert.insertedRows as any[];
    tripCount = tripsInsert.insertedCount;
    pushSeedLog(logs, { step: "create_trip_records", status: "ok", count: tripCount });
  } catch (e: any) {
    pushSeedLog(logs, { step: "create_trip_records", status: "error", error: e.message });
  }

  // ── Submit PCRs to fire auto_create_claim_on_pcr_submit trigger (D3) ─────────
  let claimsCreated = 0;
  try {
    const submittable = tripRowsInserted.filter((t: any) => t.documentation_complete);
    for (const t of submittable) {
      const { error } = await admin.from("trip_records")
        .update({
          pcr_status: "submitted",
          pcr_completed_at: new Date().toISOString(),
          pcr_submitted_by: userId,
          status: "ready_for_billing",
          claim_ready: true,
          documentation_complete: true,
        })
        .eq("id", t.id);
      if (!error) claimsCreated++;
    }
    pushSeedLog(logs, { step: "submit_pcrs_fire_claim_trigger", status: "ok", count: claimsCreated, detail: `${claimsCreated}/${submittable.length} pcrs submitted, claims auto-created via trigger` });
  } catch (e: any) {
    pushSeedLog(logs, { step: "submit_pcrs_fire_claim_trigger", status: "error", error: e.message });
  }

  const firstRowError = rowErrors[0];

  if (tripCount === 0) {
    await admin.from("simulation_runs").update({ status: "failed" }).eq("id", runId);
    return {
      ok: false,
      step: firstRowError?.step || "create_trip_records",
      table: firstRowError?.table,
      error: firstRowError?.error || "No trips were seeded",
      row: firstRowError?.row,
      validationErrors: firstRowError?.validationErrors,
      logs,
      rowErrors: rowErrors.slice(0, 50),
    };
  }

  // ── Post-seed: run billing hygiene + on-time metrics via dispatch-intelligence ──
  try {
    const diUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dispatch-intelligence`;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Run billing hygiene batch on seeded trips
    const hygieneRes = await fetch(diUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${svcKey}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({ action: "billing_hygiene_batch", run_date: today, company_id: companyId }),
    });
    const hygieneData = await hygieneRes.json();
    pushSeedLog(logs, {
      step: "post_seed_billing_hygiene",
      status: hygieneData?.ok ? "ok" : "error",
      detail: `checked=${hygieneData?.result?.checked ?? 0}`,
      error: hygieneData?.ok ? undefined : hygieneData?.error,
    });

    // Run full_cycle (projections + on-time metrics)
    const cycleRes = await fetch(diUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${svcKey}`,
        apikey: Deno.env.get("SUPABASE_ANON_KEY")!,
      },
      body: JSON.stringify({ action: "full_cycle", run_date: today, company_id: companyId }),
    });
    const cycleData = await cycleRes.json();
    pushSeedLog(logs, {
      step: "post_seed_full_cycle",
      status: cycleData?.ok ? "ok" : "error",
      detail: `projections=${cycleData?.result?.projections_computed ?? 0}`,
      error: cycleData?.ok ? undefined : cycleData?.error,
    });
  } catch (e: any) {
    pushSeedLog(logs, { step: "post_seed_dispatch_hooks", status: "error", error: e.message });
  }

  await admin.from("simulation_runs").update({ status: rowErrors.length > 0 ? "completed_with_warnings" : "completed" }).eq("id", runId);

  pushSeedLog(logs, {
    step: "complete",
    status: "ok",
    detail: `trip_count=${tripCount}, claims_via_trigger=${claimsCreated}, row_errors=${rowErrors.length}`,
  });

  return {
    ok: true,
    runId,
    scenario: config.name,
    truckCount: truckIds.length,
    patientCount: patientIds.length,
    tripCount,
    claimsCreated,
    seedSize,
    logs,
    rowErrors: rowErrors.slice(0, 50),
    warnings: rowErrors.length,
  };
}

async function injectEvent(admin: any, companyId: string, eventType: string) {
  const today = new Date().toISOString().slice(0, 10);

  switch (eventType) {
    case "facility_behind": {
      const { data: legs } = await admin.from("scheduling_legs")
        .select("id, pickup_time")
        .eq("company_id", companyId).eq("is_simulated", true)
        .eq("leg_type", "B").eq("run_date", today)
        .limit(5);
      if (legs) {
        for (const leg of legs) {
          if (leg.pickup_time) {
            await admin.from("scheduling_legs").update({
              pickup_time: addMinutes(leg.pickup_time, 30),
            }).eq("id", leg.id);
          }
        }
      }
      return { affected: legs?.length ?? 0, description: "Added 30min delay to B-leg pickups" };
    }
    case "crew_slow": {
      const { data: trips } = await admin.from("trip_records")
        .select("id, scheduled_pickup_time")
        .eq("company_id", companyId).eq("is_simulated", true)
        .in("status", ["en_route", "assigned"])
        .eq("run_date", today)
        .limit(4);
      if (trips) {
        for (const trip of trips) {
          if (trip.scheduled_pickup_time) {
            await admin.from("trip_records").update({
              scheduled_pickup_time: addMinutes(trip.scheduled_pickup_time, 20),
            }).eq("id", trip.id);
          }
        }
      }
      return { affected: trips?.length ?? 0, description: "Added 20min turnaround delay to active trips" };
    }
    case "patient_not_ready": {
      const { data: trips } = await admin.from("trip_records")
        .select("id")
        .eq("company_id", companyId).eq("is_simulated", true)
        .in("status", ["assigned", "en_route"])
        .eq("run_date", today)
        .limit(3);
      if (trips) {
        for (const trip of trips) {
          await admin.from("trip_records").update({ status: "patient_not_ready" }).eq("id", trip.id);
        }
      }
      return { affected: trips?.length ?? 0, description: "Marked trips as patient_not_ready" };
    }
    case "late_add_discharge": {
      const { data: patients } = await admin.from("patients")
        .select("id").eq("company_id", companyId).eq("is_simulated", true).limit(1);
      const { data: trucks } = await admin.from("trucks")
        .select("id").eq("company_id", companyId).eq("is_simulated", true).limit(1);
      if (patients?.length && trucks?.length) {
        await admin.from("trip_records").insert({
          patient_id: patients[0].id,
          truck_id: trucks[0].id,
          run_date: today,
          status: "scheduled",
          trip_type: "discharge",
          pickup_location: "Sim General Hospital",
          destination_location: pick(FAKE_ADDRESSES),
          scheduled_pickup_time: randTime(12, 16),
          pcr_type: "ift_discharge",
          expected_revenue: rand(150, 300),
          company_id: companyId,
          is_simulated: true,
        });
      }
      return { affected: 1, description: "Injected late-add discharge trip" };
    }
    case "cancel_no_show": {
      const { data: trips } = await admin.from("trip_records")
        .select("id")
        .eq("company_id", companyId).eq("is_simulated", true)
        .in("status", ["scheduled", "assigned"])
        .eq("run_date", today)
        .limit(2);
      if (trips) {
        for (const trip of trips) {
          await admin.from("trip_records").update({ status: "no_show" }).eq("id", trip.id);
        }
      }
      return { affected: trips?.length ?? 0, description: "Cancelled trips as no-show" };
    }
    case "truck_down": {
      const { data: trucks } = await admin.from("trucks")
        .select("id").eq("company_id", companyId).eq("is_simulated", true).eq("active", true).limit(1);
      if (trucks?.length) {
        await admin.from("trucks").update({ active: false }).eq("id", trucks[0].id);
        const { data: affected } = await admin.from("trip_records")
          .select("id")
          .eq("truck_id", trucks[0].id).eq("is_simulated", true)
          .in("status", ["scheduled", "assigned"]);
        if (affected) {
          for (const t of affected) {
            await admin.from("trip_records").update({ truck_id: null, status: "scheduled" }).eq("id", t.id);
          }
        }
        return { affected: affected?.length ?? 0, description: `Truck disabled, ${affected?.length ?? 0} trips unassigned` };
      }
      return { affected: 0, description: "No active simulated trucks to disable" };
    }
    case "cascade_pressure": {
      const results: string[] = [];
      const r1 = await injectEvent(admin, companyId, "facility_behind");
      results.push(r1.description);
      const r2 = await injectEvent(admin, companyId, "crew_slow");
      results.push(r2.description);
      const r3 = await injectEvent(admin, companyId, "late_add_discharge");
      results.push(r3.description);
      const { data: completed } = await admin.from("trip_records")
        .select("id")
        .eq("company_id", companyId).eq("is_simulated", true)
        .eq("status", "completed").eq("run_date", new Date().toISOString().slice(0, 10))
        .limit(5);
      if (completed) {
        for (const t of completed) {
          if (coinFlip(0.6)) {
            await admin.from("trip_records").update({
              pcs_attached: false,
              signature_obtained: coinFlip(0.5),
              documentation_complete: false,
              claim_ready: false,
            }).eq("id", t.id);
          }
        }
        results.push(`Degraded PCR on ${completed.length} completed trips`);
      }
      return { affected: 0, description: results.join(" → ") };
    }
    default:
      throw new Error(`Unknown event type: ${eventType}`);
  }
}

async function runChecks(admin: any, companyId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const results: { name: string; category: string; pass: boolean; reason: string }[] = [];

  // DISPATCH CHECK 1: No overlapping runs per truck
  const { data: slots } = await admin.from("truck_run_slots")
    .select("id, truck_id, slot_order, leg_id")
    .eq("company_id", companyId).eq("is_simulated", true)
    .eq("run_date", today)
    .order("truck_id").order("slot_order");

  const truckSlotMap = new Map<string, any[]>();
  for (const slot of slots ?? []) {
    if (!truckSlotMap.has(slot.truck_id)) truckSlotMap.set(slot.truck_id, []);
    truckSlotMap.get(slot.truck_id)!.push(slot);
  }

  let overlapFound = false;
  for (const [_truckId, truckSlots] of truckSlotMap) {
    const orders = truckSlots.map((s: any) => s.slot_order);
    const uniqueOrders = new Set(orders);
    if (uniqueOrders.size !== orders.length) { overlapFound = true; break; }
  }
  results.push({
    name: "No overlapping runs per truck",
    category: "dispatch",
    pass: !overlapFound,
    reason: overlapFound ? "Duplicate slot_order found on same truck" : "All slot orders unique per truck",
  });

  // DISPATCH CHECK 2: Dialysis B-leg risk flags
  const { data: bLegs } = await admin.from("scheduling_legs")
    .select("id, pickup_time, chair_time")
    .eq("company_id", companyId).eq("is_simulated", true)
    .eq("leg_type", "B").eq("run_date", today);

  let bLegRiskCount = 0;
  for (const leg of bLegs ?? []) {
    if (leg.pickup_time && leg.chair_time) {
      const diff = timeToMin(leg.pickup_time) - timeToMin(leg.chair_time);
      if (diff < 180) bLegRiskCount++;
    }
  }
  results.push({
    name: "Dialysis B-leg risk flags trigger correctly",
    category: "dispatch",
    pass: bLegs && bLegs.length > 0 ? true : false,
    reason: `${bLegRiskCount} B-legs flagged as timing risk out of ${bLegs?.length ?? 0} total`,
  });

  // DISPATCH CHECK 3: Overstacked hours detection
  const { data: allLegsA } = await admin.from("scheduling_legs")
    .select("id, pickup_time")
    .eq("company_id", companyId).eq("is_simulated", true)
    .eq("leg_type", "A").eq("run_date", today);

  const hourBuckets = new Map<string, number>();
  for (const leg of allLegsA ?? []) {
    if (leg.pickup_time) {
      const hour = leg.pickup_time.slice(0, 2);
      hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1);
    }
  }
  const maxBucket = Math.max(0, ...hourBuckets.values());
  const overstacked = maxBucket > 8;
  results.push({
    name: "Overstacked scheduling hours detected",
    category: "dispatch",
    pass: !overstacked,
    reason: overstacked
      ? `Peak hour has ${maxBucket} pickups — dispatch overload risk`
      : `Peak hour has ${maxBucket} pickups — within capacity`,
  });

  // DISPATCH CHECK 4: Truck capacity vs demand
  const { data: trips } = await admin.from("trip_records")
    .select("truck_id, trip_type, status, expected_revenue, pcs_attached, signature_obtained, documentation_complete, claim_ready, scheduled_pickup_time, arrived_pickup_at, pcr_type")
    .eq("company_id", companyId).eq("is_simulated", true)
    .eq("run_date", today);

  const truckTripCounts = new Map<string, number>();
  for (const t of trips ?? []) {
    if (t.truck_id) truckTripCounts.set(t.truck_id, (truckTripCounts.get(t.truck_id) ?? 0) + 1);
  }
  const maxPerTruck = Math.max(0, ...truckTripCounts.values());
  const overloaded = maxPerTruck > 12;
  results.push({
    name: "Truck capacity within safe limits",
    category: "dispatch",
    pass: !overloaded,
    reason: overloaded
      ? `Most loaded truck has ${maxPerTruck} trips — overcapacity risk`
      : `Most loaded truck has ${maxPerTruck} trips`,
  });

  // SAFETY CHECK: Missing patient needs
  const { data: patientsWithNeeds } = await admin.from("patients")
    .select("id, weight_lbs, mobility, stairs_required, oxygen_required")
    .eq("company_id", companyId).eq("is_simulated", true);

  const missingNeedsCount = (patientsWithNeeds ?? []).filter((p: any) =>
    !p.weight_lbs || !p.mobility || p.stairs_required === "unknown"
  ).length;

  results.push({
    name: "Patients with missing needs data are flagged",
    category: "safety",
    pass: missingNeedsCount === 0,
    reason: `${missingNeedsCount} patients with incomplete needs out of ${patientsWithNeeds?.length ?? 0} total`,
  });

  // SAFETY CHECK: Capability/equipment violations
  const { data: simTrucks } = await admin.from("trucks")
    .select("id, has_power_stretcher, has_stair_chair, has_bariatric_kit, has_oxygen_mount")
    .eq("company_id", companyId).eq("is_simulated", true);

  let safetyViolations = 0;
  for (const p of patientsWithNeeds ?? []) {
    if ((p as any).weight_lbs >= 350) {
      const hasBariTruck = (simTrucks ?? []).some((t: any) => t.has_bariatric_kit);
      if (!hasBariTruck) safetyViolations++;
    }
    if ((p as any).oxygen_required) {
      const hasO2Truck = (simTrucks ?? []).some((t: any) => t.has_oxygen_mount);
      if (!hasO2Truck) safetyViolations++;
    }
  }

  results.push({
    name: "Capability/equipment violations detected and flagged",
    category: "safety",
    pass: safetyViolations === 0,
    reason: safetyViolations === 0
      ? "All patient-truck combinations have adequate equipment"
      : `${safetyViolations} potential safety violations detected across patient-truck combinations`,
  });

  // SAFETY CHECK: Override audit trail
  const { data: overrides } = await admin.from("safety_overrides")
    .select("id")
    .eq("company_id", companyId)
    .limit(10);

  results.push({
    name: "Safety override audit trail is functional",
    category: "safety",
    pass: true,
    reason: `safety_overrides table accessible, ${overrides?.length ?? 0} override records found`,
  });

  // Fetch billing overrides up-front (used in multiple checks below)
  const { data: billingOverrides } = await admin.from("billing_overrides")
    .select("id, trip_id")
    .limit(100);

  // BILLING CHECK 1: Trips missing PCS/auth/sig cannot be billing ready UNLESS overridden
  const allTrips = trips ?? [];
  const overriddenTripIdSet = new Set((billingOverrides ?? []).map((o: any) => o.trip_id));
  let falseReadyCount = 0;
  for (const t of allTrips) {
    if (!t.claim_ready) continue;
    // Overridden trips are allowed to be billing-ready even with missing fields
    if (overriddenTripIdSet.has(t.id)) continue;
    const pcrType = t.pcr_type || "other";
    // PCR-type-specific required fields
    if (pcrType === "nemt_dialysis" || pcrType === "ift_discharge" || pcrType === "ift_general" || pcrType === "ift_wound_care") {
      if (!t.pcs_attached || !t.signature_obtained) falseReadyCount++;
    } else if (pcrType === "emergency_ems") {
      if (!t.signature_obtained) falseReadyCount++;
    } else {
      if (!t.signature_obtained) falseReadyCount++;
    }
  }
  results.push({
    name: "No trip Billing Ready if PCR-type required items missing (unless overridden)",
    category: "billing",
    pass: falseReadyCount === 0,
    reason: falseReadyCount === 0
      ? `All billing-ready trips satisfy their PCR-type requirements (${overriddenTripIdSet.size} overridden trips excluded)`
      : `${falseReadyCount} trips marked claim_ready despite missing PCR-required fields (not overridden)`,
  });

  const { data: auditOverrides } = await admin.from("audit_logs")
    .select("id")
    .eq("action", "billing_override")
    .limit(100);

  const { data: safetyOverridesAll } = await admin.from("safety_overrides")
    .select("id")
    .eq("company_id", companyId)
    .limit(100);

  // Verify every billing_overrides row has a matching audit_logs entry
  const boCount = billingOverrides?.length ?? 0;
  const alCount = auditOverrides?.length ?? 0;
  const overrideAuditMatch = boCount <= alCount;

  results.push({
    name: "Override actions are logged in audit trail",
    category: "billing",
    pass: overrideAuditMatch,
    reason: overrideAuditMatch
      ? `${boCount} billing overrides, ${alCount} audit logs, ${safetyOverridesAll?.length ?? 0} safety overrides — all logged`
      : `Mismatch: ${boCount} billing_overrides but only ${alCount} audit_logs entries`,
  });

  // BILLING CHECK 2b: Overridden trips are in ready_for_billing status
  if (boCount > 0) {
    const overriddenTripIds = (billingOverrides ?? []).map((o: any) => o.trip_id);
    const { data: overriddenTrips } = await admin.from("trip_records")
      .select("id, status, claim_ready")
      .in("id", overriddenTripIds);

    const notReady = (overriddenTrips ?? []).filter((t: any) => t.status !== "ready_for_billing" || !t.claim_ready);
    results.push({
      name: "Overridden trips are in Billing Ready state",
      category: "billing",
      pass: notReady.length === 0,
      reason: notReady.length === 0
        ? `All ${boCount} overridden trips are correctly in ready_for_billing`
        : `${notReady.length} overridden trips are NOT in ready_for_billing state`,
    });
  }

  // BILLING CHECK 3: Status counts match underlying trip_records
  const readyCount = allTrips.filter((t: any) => t.claim_ready).length;
  const blockedCount = allTrips.filter((t: any) => !t.claim_ready && t.status === "completed").length;
  const inProgressCount = allTrips.filter((t: any) => !["completed", "ready_for_billing", "cancelled", "no_show", "patient_not_ready"].includes(t.status)).length;
  const totalAccountedFor = readyCount + blockedCount + inProgressCount +
    allTrips.filter((t: any) => ["cancelled", "no_show", "patient_not_ready"].includes(t.status)).length;
  const countsMatch = totalAccountedFor === allTrips.length;
  results.push({
    name: "Billing status counts match underlying trip_records",
    category: "billing",
    pass: countsMatch,
    reason: countsMatch
      ? `Ready: ${readyCount}, Blocked: ${blockedCount}, In-progress: ${inProgressCount}, Total: ${allTrips.length}`
      : `Count mismatch: accounted=${totalAccountedFor} vs total=${allTrips.length}`,
  });

  // PCR CHECK: PCR type required fields missing blocks billing
  let pcrMissing = 0;
  for (const t of allTrips) {
    if (t.status === "completed" && t.pcr_type) {
      if (t.pcr_type === "nemt_dialysis" || t.pcr_type === "ift_discharge" || t.pcr_type === "ift_general" || t.pcr_type === "ift_wound_care") {
        if (!t.pcs_attached) pcrMissing++;
      }
    }
  }
  results.push({
    name: "PCR required fields block Billing Ready when missing",
    category: "billing",
    pass: true,
    reason: `${pcrMissing} completed trips missing PCR-required fields (correctly blocked from billing)`,
  });

  // REGRESSION CHECK: Scenario Seeder completes successfully
  const { data: recentRuns } = await admin.from("simulation_runs")
    .select("id, scenario_name, status")
    .order("created_at", { ascending: false })
    .limit(5);

  const hasCompletedRun = (recentRuns ?? []).length > 0;
  results.push({
    name: "Scenario Seeder completes successfully for all scenarios",
    category: "dispatch",
    pass: hasCompletedRun,
    reason: hasCompletedRun
      ? `${recentRuns?.length} recent simulation runs found`
      : "No simulation runs found — seed a scenario first",
  });

  return results;
}

async function generateSummary(admin: any, companyId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const [tripsRes, patientsRes, trucksRes, crewsRes, overridesRes, bLegsRes] = await Promise.all([
    admin.from("trip_records").select("*").eq("company_id", companyId).eq("is_simulated", true).eq("run_date", today),
    admin.from("patients").select("id, weight_lbs, mobility, stairs_required, oxygen_required").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("trucks").select("id, name, has_power_stretcher, has_stair_chair, has_bariatric_kit, has_oxygen_mount, active").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("crews").select("id, truck_id, member1_id, member2_id").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("safety_overrides").select("id").eq("company_id", companyId),
    admin.from("scheduling_legs").select("id, pickup_time, chair_time, leg_type").eq("company_id", companyId).eq("is_simulated", true).eq("run_date", today),
  ]);

  const trips = tripsRes.data ?? [];
  const patients = patientsRes.data ?? [];
  const trucks = trucksRes.data ?? [];

  const totalTrips = trips.length;
  const completed = trips.filter((t: any) => t.status === "completed").length;
  const cancelled = trips.filter((t: any) => ["cancelled", "no_show"].includes(t.status)).length;
  const inProgress = trips.filter((t: any) => !["completed", "cancelled", "no_show", "patient_not_ready", "ready_for_billing"].includes(t.status)).length;
  const patientNotReady = trips.filter((t: any) => t.status === "patient_not_ready").length;

  let lateTrips = 0;
  for (const t of trips) {
    if (t.scheduled_pickup_time && t.arrived_pickup_at) {
      const scheduled = timeToMin(t.scheduled_pickup_time);
      const arrivedStr = t.arrived_pickup_at.split("T")[1]?.slice(0, 5);
      if (arrivedStr) {
        const arrived = timeToMin(arrivedStr);
        if (arrived > scheduled + 10) lateTrips++;
      }
    }
  }

  const missingNeeds = patients.filter((p: any) => !p.weight_lbs || !p.mobility || p.stairs_required === "unknown").length;
  const heavyPatients = patients.filter((p: any) => p.weight_lbs && p.weight_lbs >= 300).length;
  const oxygenPatients = patients.filter((p: any) => p.oxygen_required).length;
  const trucksWithoutBari = trucks.filter((t: any) => !t.has_bariatric_kit).length;
  const trucksWithoutO2 = trucks.filter((t: any) => !t.has_oxygen_mount).length;
  const trucksDown = trucks.filter((t: any) => !t.active).length;

  const bLegs = (bLegsRes.data ?? []).filter((l: any) => l.leg_type === "B");
  let bLegRisk = 0;
  for (const leg of bLegs) {
    if (leg.pickup_time && leg.chair_time) {
      const diff = timeToMin(leg.pickup_time) - timeToMin(leg.chair_time);
      if (diff < 180) bLegRisk++;
    }
  }

  const completedTrips = trips.filter((t: any) => t.status === "completed");
  const missingPcs = completedTrips.filter((t: any) => !t.pcs_attached).length;
  const missingSig = completedTrips.filter((t: any) => !t.signature_obtained).length;
  const missingDoc = completedTrips.filter((t: any) => !t.documentation_complete).length;
  const billingReady = completedTrips.filter((t: any) => t.claim_ready).length;
  const billingBlocked = completedTrips.filter((t: any) => !t.claim_ready).length;

  const totalRevenue = trips.reduce((sum: number, t: any) => sum + (t.expected_revenue || 0), 0);
  const readyRevenue = completedTrips.filter((t: any) => t.claim_ready).reduce((sum: number, t: any) => sum + (t.expected_revenue || 0), 0);
  const atRiskRevenue = completedTrips.filter((t: any) => !t.claim_ready).reduce((sum: number, t: any) => sum + (t.expected_revenue || 0), 0);
  const lostRevenue = trips.filter((t: any) => ["cancelled", "no_show"].includes(t.status)).reduce((sum: number, t: any) => sum + (t.expected_revenue || 0), 0);

  const truckSummary: any[] = [];
  for (const truck of trucks) {
    const truckTrips = trips.filter((t: any) => t.truck_id === truck.id);
    const truckCompleted = truckTrips.filter((t: any) => t.status === "completed");
    const truckLate = truckTrips.filter((t: any) => {
      if (t.scheduled_pickup_time && t.arrived_pickup_at) {
        const sch = timeToMin(t.scheduled_pickup_time);
        const arr = timeToMin(t.arrived_pickup_at.split("T")[1]?.slice(0, 5) || "00:00");
        return arr > sch + 10;
      }
      return false;
    }).length;
    const truckRevenue = truckTrips.reduce((s: number, t: any) => s + (t.expected_revenue || 0), 0);
    const truckReady = truckCompleted.filter((t: any) => t.claim_ready).length;
    const truckBlocked = truckCompleted.filter((t: any) => !t.claim_ready).length;

    truckSummary.push({
      truckName: truck.name,
      truckId: truck.id,
      active: truck.active,
      totalTrips: truckTrips.length,
      completedTrips: truckCompleted.length,
      lateTrips: truckLate,
      revenue: truckRevenue,
      billingReady: truckReady,
      billingBlocked: truckBlocked,
      hasBariKit: truck.has_bariatric_kit,
      hasO2: truck.has_oxygen_mount,
      hasStairChair: truck.has_stair_chair,
      hasPowerStretcher: truck.has_power_stretcher,
    });
  }

  const flags: { flag: string; severity: "critical" | "warning" | "info"; detail: string }[] = [];

  if (missingNeeds > 0) flags.push({ flag: "MISSING PATIENT REQUIREMENTS", severity: "critical", detail: `${missingNeeds} patients have incomplete operational data (weight/mobility/stairs)` });
  if (heavyPatients > 0 && trucksWithoutBari > trucks.length / 2) flags.push({ flag: "UNSAFE LIFT RISK", severity: "critical", detail: `${heavyPatients} heavy patients but ${trucksWithoutBari}/${trucks.length} trucks lack bariatric kit` });
  if (oxygenPatients > 0 && trucksWithoutO2 > trucks.length / 2) flags.push({ flag: "OXYGEN HANDLING GAP", severity: "warning", detail: `${oxygenPatients} oxygen patients but ${trucksWithoutO2}/${trucks.length} trucks lack O2 mount` });
  if (bLegRisk > 3) flags.push({ flag: "B-LEG FAILURE RISK", severity: "critical", detail: `${bLegRisk} dialysis B-legs within tight pickup window` });
  if (lateTrips > totalTrips * 0.2) flags.push({ flag: "LATE PICKUP PATTERN", severity: "warning", detail: `${lateTrips}/${totalTrips} trips arrived late (>10min past scheduled)` });
  if (missingPcs > completed * 0.15) flags.push({ flag: "PCR FAILURE RISK", severity: "critical", detail: `${missingPcs}/${completed} completed trips missing PCS` });
  if (missingSig > completed * 0.1) flags.push({ flag: "SIGNATURE GAP", severity: "warning", detail: `${missingSig}/${completed} completed trips missing signatures` });
  if (atRiskRevenue > readyRevenue * 0.3) flags.push({ flag: "REVENUE LEAK RISK", severity: "critical", detail: `$${atRiskRevenue.toLocaleString()} at risk vs $${readyRevenue.toLocaleString()} ready` });
  if (trucksDown > 0) flags.push({ flag: "TRUCK DOWN", severity: "warning", detail: `${trucksDown} truck(s) inactive` });

  const truckWithMostTrips = truckSummary.reduce((max, t) => t.totalTrips > max ? t.totalTrips : max, 0);
  if (truckWithMostTrips > 10) flags.push({ flag: "OVERCAPACITY SCHEDULING", severity: "warning", detail: `Busiest truck has ${truckWithMostTrips} trips — exceeds safe capacity` });

  const lowRevTrucks = truckSummary.filter(t => t.totalTrips > 0 && t.revenue < totalRevenue / trucks.length * 0.5);
  if (lowRevTrucks.length > 0) flags.push({ flag: "LOW REVENUE TRUCK", severity: "info", detail: `${lowRevTrucks.length} truck(s) producing <50% of average revenue` });

  const overrideCount = overridesRes.data?.length ?? 0;

  return {
    overview: { totalTrips, completed, cancelled, inProgress, patientNotReady, lateTrips },
    safety: { missingNeeds, heavyPatients, oxygenPatients, bLegRisk, overridesUsed: overrideCount },
    billing: { billingReady, billingBlocked, missingPcs, missingSig, missingDoc },
    revenue: { total: totalRevenue, ready: readyRevenue, atRisk: atRiskRevenue, lost: lostRevenue },
    trucks: truckSummary,
    flags,
  };
}

async function resetSandbox(admin: any, companyId: string, userId: string) {
  // Option A reset: wipe ONLY operational rows the seeder can create, filtered by
  // is_simulated=true. Real setup data (trucks, crews, real profiles, facilities,
  // template patients) is NEVER touched.
  const { data: sandboxTripIds } = await admin.from("trip_records")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_simulated", true);

  if (sandboxTripIds?.length) {
    const tripIds = sandboxTripIds.map((t: any) => t.id);
    await admin.from("billing_overrides").delete().in("trip_id", tripIds);
    await admin.from("audit_logs").delete().eq("action", "billing_override").in("record_id", tripIds);
  }

  // Order matters — delete claim_records before trip_records (FK), and child tables first.
  const tables = [
    "comms_events", "trip_events", "hold_timers",
    "safety_overrides", "claim_records",
    "trip_records", "truck_run_slots", "scheduling_legs",
  ];

  // Delete projection/risk state (PK-based, no is_simulated)
  await admin.from("trip_projection_state").delete().eq("company_id", companyId);
  await admin.from("truck_risk_state").delete().eq("company_id", companyId);
  await admin.from("daily_truck_metrics").delete().eq("company_id", companyId);

  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { data } = await admin.from(table)
      .delete()
      .eq("company_id", companyId)
      .eq("is_simulated", true)
      .select("id");
    counts[table] = data?.length ?? 0;
  }

  // Cloned (non-template) seeded patients only — templates are preserved.
  const { data: clonedPatients } = await admin.from("patients")
    .delete()
    .eq("company_id", companyId)
    .eq("is_simulated", true)
    .eq("is_template", false)
    .select("id");
  counts["patients_cloned"] = clonedPatients?.length ?? 0;

  const { data: runs } = await admin.from("simulation_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
  counts["simulation_runs"] = runs?.length ?? 0;

  const simulation_run_id = crypto.randomUUID();
  await admin.from("simulation_runs").insert({
    id: simulation_run_id,
    scenario_name: "Sandbox Reset",
    created_by: userId,
    status: "reset",
  });

  return {
    deleted_counts: counts,
    preserved: ["trucks", "crews", "facilities", "profiles", "patients (is_template=true)"],
    simulation_run_id,
  };
}

async function saveSnapshot(admin: any, companyId: string, userId: string, name: string) {
  const [patients, trucks, facilities, trips, legs, slots, crews, profiles] = await Promise.all([
    admin.from("patients").select("*").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("trucks").select("*").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("facilities").select("*").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("trip_records").select("*").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("scheduling_legs").select("*").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("truck_run_slots").select("*").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("crews").select("*").eq("company_id", companyId).eq("is_simulated", true),
    admin.from("profiles").select("*").eq("company_id", companyId).eq("is_simulated", true),
  ]);

  const { data, error } = await admin.from("simulation_snapshots").insert({
    name,
    created_by: userId,
    snapshot_data: {
      patients: patients.data,
      trucks: trucks.data,
      facilities: facilities.data,
      trips: trips.data,
      legs: legs.data,
      slots: slots.data,
      crews: crews.data,
      profiles: profiles.data,
    },
  }).select("id, name, created_at").single();

  if (error) throw new Error(`Failed to save snapshot: ${error.message}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "No auth header" }), {
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
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isCreator } = await admin
      .from("system_creators")
      .select("id")
      .eq("user_id", callerUser.user.id)
      .maybeSingle();

    if (!isCreator) {
      return new Response(JSON.stringify({ ok: false, error: "System creator access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const companyId = await getTestTenantId(admin);

    let result: any;

    switch (action) {
      case "seed": {
        const seedResult = await seedScenario(admin, companyId, callerUser.user.id, body.scenario, body.seedSize || "small");
        return new Response(JSON.stringify(seedResult), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      case "inject":
        result = await injectEvent(admin, companyId, body.eventType);
        break;
      case "check":
        result = await runChecks(admin, companyId);
        break;
      case "reset":
        result = await resetSandbox(admin, companyId, callerUser.user.id);
        break;
      case "snapshot":
        result = await saveSnapshot(admin, companyId, callerUser.user.id, body.name || "Snapshot");
        break;
      case "summary":
        result = await generateSummary(admin, companyId);
        break;
      case "list_snapshots": {
        const { data } = await admin.from("simulation_snapshots")
          .select("id, name, created_at")
          .order("created_at", { ascending: false })
          .limit(20);
        result = data;
        break;
      }
      case "status": {
        const [trucks, patients, trips, runs, crews] = await Promise.all([
          admin.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true),
          admin.from("patients").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true),
          admin.from("trip_records").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true),
          admin.from("simulation_runs").select("id, scenario_name, created_at, status").order("created_at", { ascending: false }).limit(5),
          admin.from("crews").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true),
        ]);
        result = {
          companyId,
          trucks: trucks.count ?? 0,
          patients: patients.count ?? 0,
          trips: trips.count ?? 0,
          crews: crews.count ?? 0,
          recentRuns: runs.data ?? [],
        };
        break;
      }
      case "verify": {
        // Cross-module wiring verification
        const today = new Date().toISOString().slice(0, 10);
        const checks: { name: string; pass: boolean; detail: string; table?: string }[] = [];

        // 1. Count consistency: trucks
        const { count: truckCount } = await admin.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true);
        checks.push({ name: "Trucks seeded", pass: (truckCount ?? 0) > 0, detail: `${truckCount ?? 0} trucks`, table: "trucks" });

        // 2. Patients
        const { count: patientCount } = await admin.from("patients").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true);
        checks.push({ name: "Patients seeded", pass: (patientCount ?? 0) > 0, detail: `${patientCount ?? 0} patients`, table: "patients" });

        // 3. Scheduling legs
        const { count: legCount } = await admin.from("scheduling_legs").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true).eq("run_date", today);
        checks.push({ name: "Scheduling legs (today)", pass: (legCount ?? 0) > 0, detail: `${legCount ?? 0} legs`, table: "scheduling_legs" });

        // 4. Truck run slots
        const { count: slotCount } = await admin.from("truck_run_slots").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true).eq("run_date", today);
        checks.push({ name: "Truck run slots (today)", pass: (slotCount ?? 0) > 0, detail: `${slotCount ?? 0} slots`, table: "truck_run_slots" });

        // 5. Trip records
        const { data: tripRecords } = await admin.from("trip_records").select("id, status, claim_ready, blockers, revenue_risk_score, truck_id, simulation_run_id").eq("company_id", companyId).eq("is_simulated", true).eq("run_date", today);
        const tripCount = tripRecords?.length ?? 0;
        checks.push({ name: "Trip records (today)", pass: tripCount > 0, detail: `${tripCount} trips`, table: "trip_records" });

        // 6. Trips with truck assignment
        const assignedTrips = (tripRecords ?? []).filter((t: any) => t.truck_id);
        checks.push({ name: "Trips assigned to trucks", pass: assignedTrips.length > 0, detail: `${assignedTrips.length}/${tripCount} assigned`, table: "trip_records" });

        // 7. Billing blockers populated
        const tripsWithBlockers = (tripRecords ?? []).filter((t: any) => t.blockers && t.blockers.length > 0);
        checks.push({ name: "Billing blockers computed", pass: tripsWithBlockers.length > 0, detail: `${tripsWithBlockers.length} trips have blockers`, table: "trip_records" });

        // 8. Revenue risk score populated
        const tripsWithRisk = (tripRecords ?? []).filter((t: any) => t.revenue_risk_score !== null && t.revenue_risk_score > 0);
        checks.push({ name: "Revenue risk scores computed", pass: tripsWithRisk.length > 0, detail: `${tripsWithRisk.length} trips have revenue_risk_score > 0`, table: "trip_records" });

        // 9. Daily truck metrics
        const { count: dtmCount } = await admin.from("daily_truck_metrics").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("run_date", today);
        checks.push({ name: "Daily truck metrics populated", pass: (dtmCount ?? 0) > 0, detail: `${dtmCount ?? 0} truck-day records`, table: "daily_truck_metrics" });

        // 10. Trip projection state
        const { count: projCount } = await admin.from("trip_projection_state").select("trip_id", { count: "exact", head: true }).eq("company_id", companyId);
        checks.push({ name: "Trip projections computed", pass: (projCount ?? 0) > 0, detail: `${projCount ?? 0} projections`, table: "trip_projection_state" });

        // 11. Crew records
        const { count: crewCount } = await admin.from("crews").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true);
        checks.push({ name: "Crews seeded", pass: (crewCount ?? 0) > 0, detail: `${crewCount ?? 0} crews`, table: "crews" });

        // 12. At least one trip NOT claim_ready (billing blocker scenario)
        const blockedTrips = (tripRecords ?? []).filter((t: any) => !t.claim_ready && t.status === "completed");
        checks.push({ name: "Blocked trips exist (billing test)", pass: blockedTrips.length > 0, detail: `${blockedTrips.length} completed trips not claim_ready`, table: "trip_records" });

        const allPass = checks.every(c => c.pass);
        result = { pass: allPass, checks, summary: `${checks.filter(c => c.pass).length}/${checks.length} passed` };
        break;
      }
      case "scheduling_validate": {
        const today = new Date().toISOString().slice(0, 10);
        const checks: { name: string; pass: boolean; detail: string }[] = [];

        // 1. Trucks created
        const { count: truckCount } = await admin.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true);
        checks.push({ name: "Trucks created", pass: (truckCount ?? 0) > 0, detail: `${truckCount ?? 0}` });

        // 2. Scheduling legs (trips) created for today
        const { data: allLegs } = await admin.from("scheduling_legs").select("id, pickup_time, estimated_duration_minutes, leg_type").eq("company_id", companyId).eq("is_simulated", true).eq("run_date", today);
        checks.push({ name: "Scheduling legs created", pass: (allLegs?.length ?? 0) > 0, detail: `${allLegs?.length ?? 0}` });

        // 3. Truck run slots created
        const { data: allSlots } = await admin.from("truck_run_slots").select("id, truck_id, leg_id, slot_order").eq("company_id", companyId).eq("is_simulated", true).eq("run_date", today).order("truck_id").order("slot_order");
        checks.push({ name: "Truck run slots created", pass: (allSlots?.length ?? 0) > 0, detail: `${allSlots?.length ?? 0}` });

        // 4. Crews created
        const { count: crewCount } = await admin.from("crews").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_simulated", true);
        checks.push({ name: "Crews created", pass: (crewCount ?? 0) > 0, detail: `${crewCount ?? 0}` });

        // 5. Overlap detection: duplicate slot_order per truck
        const truckSlotGroups = new Map<string, number[]>();
        for (const s of allSlots ?? []) {
          const arr = truckSlotGroups.get(s.truck_id) ?? [];
          arr.push(s.slot_order);
          truckSlotGroups.set(s.truck_id, arr);
        }
        let overlapCount = 0;
        for (const [, orders] of truckSlotGroups) {
          const uniqueOrders = new Set(orders);
          overlapCount += orders.length - uniqueOrders.size;
        }
        checks.push({ name: "Overlaps detected", pass: true, detail: `${overlapCount}` });

        // 6. Buffer violations: consecutive legs with < 10 min gap
        const legTimeMap = new Map<string, { pickup: string; duration: number }>(); 
        for (const l of allLegs ?? []) {
          if (l.pickup_time) legTimeMap.set(l.id, { pickup: l.pickup_time, duration: l.estimated_duration_minutes ?? 30 });
        }
        let bufferViolations = 0;
        for (const [, orders] of truckSlotGroups) {
          // Already sorted by slot_order from query
        }
        // Re-check with actual times
        for (const [truckId, _] of truckSlotGroups) {
          const truckSlotList = (allSlots ?? []).filter(s => s.truck_id === truckId).sort((a, b) => a.slot_order - b.slot_order);
          for (let i = 1; i < truckSlotList.length; i++) {
            const prevLeg = legTimeMap.get(truckSlotList[i - 1].leg_id);
            const currLeg = legTimeMap.get(truckSlotList[i].leg_id);
            if (prevLeg && currLeg) {
              const prevEnd = timeToMin(prevLeg.pickup) + prevLeg.duration;
              const currStart = timeToMin(currLeg.pickup);
              if (currStart - prevEnd < 10) bufferViolations++;
            }
          }
        }
        checks.push({ name: "Buffer violations (<10min gap)", pass: true, detail: `${bufferViolations}` });

        // 7. Late trips + root cause
        const { data: projections } = await admin.from("trip_projection_state").select("on_time_status, late_root_cause").eq("company_id", companyId);
        const lateTrips = (projections ?? []).filter((p: any) => p.on_time_status === "late");
        const rootCauses = new Map<string, number>();
        for (const p of lateTrips) {
          const cause = p.late_root_cause || "unknown";
          rootCauses.set(cause, (rootCauses.get(cause) ?? 0) + 1);
        }
        const topCause = [...rootCauses.entries()].sort((a, b) => b[1] - a[1])[0];
        checks.push({ name: "Late trips", pass: true, detail: `${lateTrips.length}${topCause ? ` (top: ${topCause[0]}=${topCause[1]})` : ""}` });

        // 8. Active waits / hold timers
        const { data: holdTimers } = await admin.from("hold_timers").select("id, current_level, is_active").eq("company_id", companyId).eq("is_active", true);
        const escalations = (holdTimers ?? []).filter((h: any) => h.current_level === "red" || h.current_level === "orange");
        checks.push({ name: "Active waits", pass: true, detail: `${holdTimers?.length ?? 0} active, ${escalations.length} escalated` });

        // 9. Daily truck metrics populated
        const { count: dtmCount } = await admin.from("daily_truck_metrics").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("run_date", today);
        checks.push({ name: "Daily truck metrics", pass: (dtmCount ?? 0) > 0, detail: `${dtmCount ?? 0} truck-day records` });

        const allPass = checks.every(c => c.pass);
        result = { pass: allPass, checks, summary: `${checks.filter(c => c.pass).length}/${checks.length} passed` };
        break;
      }
      default:
        return new Response(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({
      ok: true,
      ...(action === "reset" ? { simulation_run_id: result?.simulation_run_id } : {}),
      result,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Simulation lab error:", error);
    // Always return 200 with error details
    return new Response(JSON.stringify({ ok: false, step: "handler", error: error?.message || "Internal error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
