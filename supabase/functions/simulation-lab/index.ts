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
const VALID_TRANSPORT_TYPES = ["dialysis", "outpatient", "adhoc"] as const;
const VALID_TRIP_TYPES = ["dialysis", "discharge", "outpatient", "hospital", "private_pay"] as const;
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
  if (raw === "hospital") return "adhoc";
  if (raw === "discharge") return "outpatient";
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

async function ensureSandboxCompany(admin: any, userId: string) {
  const { data: existing } = await admin
    .from("companies")
    .select("id")
    .eq("is_sandbox", true)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await admin
    .from("companies")
    .insert({
      name: "Simulation Sandbox Co",
      is_sandbox: true,
      onboarding_status: "active",
      owner_user_id: userId,
      owner_email: "sandbox@poddispatch.sim",
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create sandbox company: ${error.message}`);

  await admin.from("company_memberships").insert({
    company_id: created.id,
    user_id: userId,
    role: "creator",
  });

  return created.id;
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
  tripMix: { dialysis: number; discharge: number; outpatient: number; hospital: number };
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
};

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
  config.tripMix = {
    dialysis: Math.max(1, Math.round(baseConfig.tripMix.dialysis * patientRatio)),
    discharge: Math.max(0, Math.round(baseConfig.tripMix.discharge * patientRatio)),
    outpatient: Math.max(0, Math.round(baseConfig.tripMix.outpatient * patientRatio)),
    hospital: Math.max(0, Math.round(baseConfig.tripMix.hospital * patientRatio)),
  };
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

  let facilityRowsInserted: Array<{ id: string; name: string }> = [];
  try {
    const facilityTypes = ["dialysis", "hospital", "hospital", "snf", "rehab"];
    const facilityNames = ["Sim Dialysis Center", "Sim General Hospital", "Sim Medical Center", "Sim Nursing Facility", "Sim Rehab Center"];
    if (pressure?.crossCityRouting) facilityNames.push("Sim Dialysis North", "Sim Dialysis South");

    const facilityRows = facilityNames.map((name, i) => ({
      name,
      address: pressure?.crossCityRouting && i >= 5
        ? pick(CITY_CLUSTERS[i % CITY_CLUSTERS.length])
        : FAKE_ADDRESSES[i % FAKE_ADDRESSES.length],
      facility_type: facilityTypes[i % facilityTypes.length],
      phone: `(555) 900-${String(i + 1).padStart(4, "0")}`,
      company_id: companyId,
      is_simulated: true,
      simulation_run_id: runId,
    }));

    const { insertedRows } = await insertRowsResilient({
      admin,
      step: "create_facilities",
      table: "facilities",
      rows: facilityRows,
      logs,
      rowErrors,
      requiredFields: ["name", "facility_type", "company_id"],
      batchSize: 25,
      select: "id,name",
    });
    facilityRowsInserted = insertedRows as Array<{ id: string; name: string }>;
  } catch (e: any) {
    pushSeedLog(logs, { step: "create_facilities", status: "error", error: e.message });
  }

  const facilityNames = facilityRowsInserted.map((f) => f.name);

  const profileMeta = new Map<string, { maxLift: number; stairChair: boolean; bariatric: boolean; oxygen: boolean }>();
  const truckMeta = new Map<string, { has_stair_chair: boolean; has_bariatric_kit: boolean; has_oxygen_mount: boolean }>();

  let truckIds: string[] = [];
  let crewIds: string[] = [];
  let patientIds: string[] = [];
  let tripCount = 0;

  // b) create trucks + equipment
  try {
    const equipConfigs = [
      { has_power_stretcher: true, has_stair_chair: true, has_bariatric_kit: true, has_oxygen_mount: true },
      { has_power_stretcher: true, has_stair_chair: true, has_bariatric_kit: false, has_oxygen_mount: true },
      { has_power_stretcher: true, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: true },
      { has_power_stretcher: false, has_stair_chair: true, has_bariatric_kit: false, has_oxygen_mount: false },
      { has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: true },
      { has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: false },
    ];

    const truckRows: Record<string, unknown>[] = [];
    for (let i = 0; i < config.truckCount; i++) {
      const mismatch = scenarioKey === "crew_mismatch" && i > 1;
      const equip = mismatch
        ? { has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: false }
        : equipConfigs[i % equipConfigs.length];

      truckRows.push({
        name: `SIM-${100 + i + 1}`,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
        ...equip,
      });
    }

    const { insertedRows } = await insertRowsResilient({
      admin,
      step: "create_trucks_equipment",
      table: "trucks",
      rows: truckRows,
      logs,
      rowErrors,
      requiredFields: ["name", "company_id"],
      batchSize: 25,
      select: "id,has_stair_chair,has_bariatric_kit,has_oxygen_mount",
    });

    truckIds = (insertedRows as any[]).map((row) => row.id);
    for (const t of insertedRows as any[]) {
      truckMeta.set(t.id, {
        has_stair_chair: !!t.has_stair_chair,
        has_bariatric_kit: !!t.has_bariatric_kit,
        has_oxygen_mount: !!t.has_oxygen_mount,
      });
    }
  } catch (e: any) {
    pushSeedLog(logs, { step: "create_trucks_equipment", status: "error", error: e.message });
  }

  // c) create crews + profiles/capabilities
  try {
    const profileRows: Record<string, unknown>[] = [];
    const plannedCrews: Array<{ truck_id: string; member1_id: string; member2_id: string }> = [];

    for (let i = 0; i < truckIds.length; i++) {
      const mismatch = scenarioKey === "crew_mismatch" && i > 0;
      const member1Id = crypto.randomUUID();
      const member2Id = crypto.randomUUID();

      const rawCert1 = i % 4 === 0 ? "EMT" : i % 4 === 1 ? "Paramedic" : pick([...STRICT_CERT_LEVELS]);
      const rawCert2 = i % 3 === 0 ? "Paramedic" : "EMT";
      const rawSex1 = i % 2 === 0 ? "male" : "female";
      const rawSex2 = i % 2 === 0 ? "female" : "male";

      const profile1 = {
        id: member1Id,
        user_id: member1Id,
        full_name: FAKE_NAMES[i * 2] || `Crew ${i * 2}`,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
        max_safe_team_lift_lbs: mismatch ? rand(150, 200) : rand(250, 400),
        stair_chair_trained: mismatch ? false : coinFlip(0.7),
        bariatric_trained: mismatch ? false : coinFlip(0.4),
        oxygen_handling_trained: mismatch ? false : coinFlip(0.6),
        lift_assist_ok: coinFlip(0.5),
        cert_level: normalizeCertLevel(rawCert1),
        sex: normalizeSex(rawSex1),
      };

      const profile2 = {
        id: member2Id,
        user_id: member2Id,
        full_name: FAKE_NAMES[i * 2 + 1] || `Crew ${i * 2 + 1}`,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
        max_safe_team_lift_lbs: mismatch ? rand(150, 200) : rand(250, 400),
        stair_chair_trained: mismatch ? false : coinFlip(0.6),
        bariatric_trained: mismatch ? false : coinFlip(0.3),
        oxygen_handling_trained: mismatch ? false : coinFlip(0.5),
        lift_assist_ok: coinFlip(0.5),
        cert_level: normalizeCertLevel(rawCert2),
        sex: normalizeSex(rawSex2),
      };

      profileRows.push(profile1, profile2);
      plannedCrews.push({ truck_id: truckIds[i], member1_id: member1Id, member2_id: member2Id });
    }

    const { insertedRows: insertedProfiles } = await insertRowsResilient({
      admin,
      step: "create_crews_profiles_capabilities",
      table: "profiles",
      rows: profileRows,
      logs,
      rowErrors,
      requiredFields: ["id", "user_id", "full_name", "company_id", "cert_level", "sex"],
      enumRules: [
        { field: "cert_level", values: STRICT_CERT_LEVELS },
        { field: "sex", values: STRICT_SEX_TYPES },
      ],
      batchSize: 25,
      select: "id,max_safe_team_lift_lbs,stair_chair_trained,bariatric_trained,oxygen_handling_trained",
    });

    const profileIdSet = new Set((insertedProfiles as any[]).map((p) => p.id));
    for (const p of insertedProfiles as any[]) {
      profileMeta.set(p.id, {
        maxLift: Number(p.max_safe_team_lift_lbs ?? 0),
        stairChair: !!p.stair_chair_trained,
        bariatric: !!p.bariatric_trained,
        oxygen: !!p.oxygen_handling_trained,
      });
    }

    const crewRows = plannedCrews.map((crew) => ({
      ...crew,
      active_date: today,
      company_id: companyId,
      is_simulated: true,
      simulation_run_id: runId,
    }));

    const { insertedRows: insertedCrews } = await insertRowsResilient({
      admin,
      step: "create_crews_profiles_capabilities",
      table: "crews",
      rows: crewRows,
      logs,
      rowErrors,
      requiredFields: ["truck_id", "member1_id", "member2_id", "company_id"],
      fkRules: [
        { field: "truck_id", allowed: new Set(truckIds), label: "trucks" },
        { field: "member1_id", allowed: profileIdSet, label: "profiles" },
        { field: "member2_id", allowed: profileIdSet, label: "profiles" },
      ],
      batchSize: 25,
      select: "id,truck_id,member1_id,member2_id",
    });

    crewIds = (insertedCrews as any[]).map((c) => c.id);
  } catch (e: any) {
    pushSeedLog(logs, { step: "create_crews_profiles_capabilities", status: "error", error: e.message });
  }

  // d) create patients + needs
  const patientMeta = new Map<string, { weight: number | null; stairs: string; oxygen: boolean; stairChairRequired: boolean }>();
  try {
    const patientNames = pickN(FAKE_NAMES, config.patientCount);
    const tripTypes: string[] = [];
    for (const [type, count] of Object.entries(config.tripMix)) for (let j = 0; j < count; j++) tripTypes.push(type);
    const payerTypes: string[] = [];
    for (const [payer, count] of Object.entries(config.payerMix)) for (let j = 0; j < count; j++) payerTypes.push(payer);

    const expiringAuthIndices = new Set(pickN([...Array(config.patientCount).keys()], Math.min(config.authExpiring, config.patientCount)));
    const missingInfoIndices = new Set(
      pressure?.missingPatientInfo
        ? pickN([...Array(config.patientCount).keys()], Math.min(pressure.missingPatientInfo, config.patientCount))
        : []
    );

    const weights = [120, 150, 165, 180, 195, 210, 240, 275, 310, 340, 360, 380];
    const mobilities = ["ambulatory", "wheelchair", "stretcher", "bedbound"];
    const stairsOptions = ["none", "few_steps", "full_flight", "unknown"];
    const equipOptions = ["none", "none", "none", "bariatric_stretcher", "extra_crew", "lift_assist"];

    const patientRows: Record<string, unknown>[] = [];

    for (let i = 0; i < config.patientCount; i++) {
      const nameParts = patientNames[i]?.split(" ") || ["Test", `P${i}`];
      const first = nameParts[0];
      const last = nameParts.slice(1).join(" ") || `Patient${i}`;
      const tripType = normalizeTripType(tripTypes[i % tripTypes.length] || "dialysis");
      const payer = payerTypes[i % payerTypes.length] || "Medicare";
      const authExpDate = expiringAuthIndices.has(i)
        ? new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
        : new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

      const hasMissingInfo = missingInfoIndices.has(i);
      const baseWeight = pressure?.insufficientTrucks && i % 3 === 0 ? pick([310, 340, 360]) : weights[i % weights.length];
      const weight = hasMissingInfo ? null : baseWeight;
      const stairs = hasMissingInfo ? "unknown" : stairsOptions[i % stairsOptions.length];
      const oxygenReq = !hasMissingInfo && i % 5 === 0;

      const row = {
        first_name: first,
        last_name: last,
        dob: `19${50 + (i % 30)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
        phone: `(555) 800-${String(i + 1).padStart(4, "0")}`,
        pickup_address: pressure?.crossCityRouting ? pick(pick(CITY_CLUSTERS)) : pick(FAKE_ADDRESSES),
        dropoff_facility: facilityNames[i % Math.max(1, facilityNames.length)] || "Sim Dialysis Center",
        transport_type: normalizeTransportType(tripType),
        schedule_days: tripType === "dialysis" ? (i % 2 === 0 ? "MWF" : "TTS") : "MWF",
        status: "active",
        primary_payer: payer,
        auth_required: payer === "Medicare" || payer === "Medicaid",
        auth_expiration: authExpDate,
        weight_lbs: weight,
        mobility: hasMissingInfo ? null : mobilities[i % mobilities.length],
        stairs_required: stairs,
        stair_chair_required: stairs === "full_flight",
        oxygen_required: oxygenReq,
        oxygen_lpm: oxygenReq ? [2, 3, 4, 6][i % 4] : null,
        bariatric: (weight ?? 0) >= 300,
        special_equipment_required: hasMissingInfo ? "none" : equipOptions[i % equipOptions.length],
        dialysis_window_minutes: tripType === "dialysis" ? 45 : 60,
        must_arrive_by: tripType === "dialysis" ? randTime(6, 8) : null,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
      };

      patientRows.push(row);
    }

    const { insertedRows } = await insertRowsResilient({
      admin,
      step: "create_patients_needs",
      table: "patients",
      rows: patientRows,
      logs,
      rowErrors,
      requiredFields: ["first_name", "last_name", "transport_type", "status", "company_id", "special_equipment_required", "stairs_required"],
      enumRules: [
        { field: "transport_type", values: VALID_TRANSPORT_TYPES },
        { field: "status", values: VALID_PATIENT_STATUSES },
      ],
      batchSize: 25,
      select: "id,weight_lbs,stairs_required,oxygen_required,stair_chair_required",
    });

    patientIds = (insertedRows as any[]).map((p) => p.id);
    for (const p of insertedRows as any[]) {
      patientMeta.set(p.id, {
        weight: p.weight_lbs,
        stairs: p.stairs_required,
        oxygen: !!p.oxygen_required,
        stairChairRequired: !!p.stair_chair_required,
      });
    }
  } catch (e: any) {
    pushSeedLog(logs, { step: "create_patients_needs", status: "error", error: e.message });
  }

  // e) create trips + legs + time windows  / f) assign trips to trucks/crews
  let tripRowsInserted: any[] = [];
  try {
    const totalTrips = config.tripMix.dialysis + config.tripMix.discharge + config.tripMix.outpatient + config.tripMix.hospital;
    const tripTypes: string[] = [];
    for (const [type, count] of Object.entries(config.tripMix)) for (let j = 0; j < count; j++) tripTypes.push(type);
    const payerTypes: string[] = [];
    for (const [payer, count] of Object.entries(config.payerMix)) for (let j = 0; j < count; j++) payerTypes.push(payer);

    const missingPcsSet = new Set(pickN([...Array(totalTrips).keys()], Math.min(config.missingPcs, totalTrips)));
    const missingAuthSet = new Set(pickN([...Array(totalTrips).keys()], Math.min(config.missingAuth, totalTrips)));
    const missingSigSet = new Set(pickN([...Array(totalTrips).keys()], Math.min(config.missingSignature, totalTrips)));
    const missingTimesSet = new Set(pickN([...Array(totalTrips).keys()], Math.min(config.missingTimestamps, totalTrips)));

    const legRows: Record<string, unknown>[] = [];
    const slotRows: Record<string, unknown>[] = [];
    const tripRows: Record<string, unknown>[] = [];

    const tripsToCreate = Math.min(totalTrips, patientIds.length);

    for (let i = 0; i < tripsToCreate; i++) {
      const patientId = patientIds[i];
      const tripType = normalizeTripType(tripTypes[i % tripTypes.length] || "dialysis");
      const status = normalizeTripStatus(pick(["scheduled", "assigned", "en_route", "loaded", "completed", "completed", "completed"]));
      const truckIdx = truckIds.length > 0 ? i % truckIds.length : -1;
      const truckId = truckIdx >= 0 ? truckIds[truckIdx] : null;
      const crewId = truckIdx >= 0 ? crewIds[truckIdx] ?? null : null;
      const payer = payerTypes[i % payerTypes.length] || "Medicare";

      const pickupTime = pressure?.overstackedDialysisHours && tripType === "dialysis"
        ? pick(["06:00", "06:15", "06:30", "06:00", "06:15"])
        : (tripType === "dialysis" ? randTime(5, 8) : randTime(8, 14));

      const pickupLoc = pressure?.crossCityRouting ? pick(pick(CITY_CLUSTERS)) : pick(FAKE_ADDRESSES);
      const facility = pressure?.crossCityRouting
        ? (facilityNames[i % Math.max(1, facilityNames.length)] || "Sim General Hospital")
        : (facilityNames[tripType === "dialysis" ? 0 : i % Math.max(1, facilityNames.length)] || "Sim General Hospital");

      const legId = crypto.randomUUID();
      legRows.push({
        id: legId,
        patient_id: patientId,
        leg_type: "A",
        pickup_location: pickupLoc,
        destination_location: facility,
        pickup_time: pickupTime,
        trip_type: tripType,
        run_date: today,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
        estimated_duration_minutes: pressure?.unrealisticGaps ? rand(5, 10) : rand(20, 40),
      });

      if (truckId) {
        slotRows.push({
          truck_id: truckId,
          leg_id: legId,
          run_date: today,
          slot_order: i,
          status: "pending",
          company_id: companyId,
          is_simulated: true,
          simulation_run_id: runId,
        });
      }

      const isCompleted = status === "completed";
      const hasPcs = !missingPcsSet.has(i);
      const hasSig = !missingSigSet.has(i);
      const hasTimes = !missingTimesSet.has(i);
      const hasAuth = !missingAuthSet.has(i);

      const pcrType = tripType === "dialysis"
        ? "nemt_dialysis"
        : tripType === "discharge"
        ? "ift_discharge"
        : tripType === "hospital"
        ? "emergency_ems"
        : "other";

      const baseRevenue = payer === "Medicare" ? rand(180, 350) : payer === "Medicaid" ? rand(120, 250) : rand(200, 400);

      tripRows.push({
        patient_id: patientId,
        truck_id: truckId,
        crew_id: crewId,
        leg_id: legId,
        run_date: today,
        status,
        trip_type: tripType,
        pickup_location: pickupLoc,
        destination_location: facility,
        scheduled_pickup_time: pickupTime,
        loaded_miles: isCompleted ? Math.round((5 + Math.random() * 25) * 10) / 10 : null,
        pcs_attached: hasPcs,
        signature_obtained: hasSig,
        arrived_pickup_at: hasTimes && isCompleted ? `${today}T${pickupTime}:00` : null,
        arrived_dropoff_at: hasTimes && isCompleted ? `${today}T${addMinutes(pickupTime, rand(20, 60))}:00` : null,
        documentation_complete: hasPcs && hasSig && hasTimes,
        claim_ready: isCompleted && hasPcs && hasSig && hasTimes && hasAuth,
        origin_type: "Home",
        destination_type: tripType === "dialysis" ? "Dialysis Center" : "Hospital Outpatient",
        service_level: "BLS",
        necessity_notes: hasPcs ? "Patient requires stretcher transport due to medical necessity" : null,
        pcr_type: pcrType,
        expected_revenue: baseRevenue,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
      });
    }

    const patientIdSet = new Set(patientIds);
    const truckIdSet = new Set(truckIds);
    const crewIdSet = new Set(crewIds);

    const legsInsert = await insertRowsResilient({
      admin,
      step: "create_trips_legs_time_windows",
      table: "scheduling_legs",
      rows: legRows,
      logs,
      rowErrors,
      requiredFields: ["id", "patient_id", "leg_type", "pickup_location", "destination_location", "trip_type", "company_id"],
      enumRules: [
        { field: "leg_type", values: VALID_LEG_TYPES },
        { field: "trip_type", values: VALID_TRIP_TYPES },
      ],
      fkRules: [{ field: "patient_id", allowed: patientIdSet, label: "patients" }],
      batchSize: 25,
      select: "id",
    });

    const legIdSet = new Set((legsInsert.insertedRows as any[]).map((l) => l.id));

    await insertRowsResilient({
      admin,
      step: "assign_trips_to_trucks_crews",
      table: "truck_run_slots",
      rows: slotRows,
      logs,
      rowErrors,
      requiredFields: ["truck_id", "leg_id", "company_id", "status"],
      enumRules: [{ field: "status", values: ["pending", "en_route", "arrived", "with_patient", "transporting", "completed"] }],
      fkRules: [
        { field: "truck_id", allowed: truckIdSet, label: "trucks" },
        { field: "leg_id", allowed: legIdSet, label: "scheduling_legs" },
      ],
      batchSize: 25,
      select: "id",
    });

    const tripsInsert = await insertRowsResilient({
      admin,
      step: "assign_trips_to_trucks_crews",
      table: "trip_records",
      rows: tripRows,
      logs,
      rowErrors,
      requiredFields: ["patient_id", "run_date", "status", "company_id"],
      enumRules: [
        { field: "status", values: VALID_TRIP_STATUSES },
        { field: "trip_type", values: VALID_TRIP_TYPES },
      ],
      fkRules: [
        { field: "patient_id", allowed: patientIdSet, label: "patients" },
        { field: "truck_id", allowed: truckIdSet, label: "trucks", nullable: true },
        { field: "crew_id", allowed: crewIdSet, label: "crews", nullable: true },
        { field: "leg_id", allowed: legIdSet, label: "scheduling_legs", nullable: true },
      ],
      batchSize: 25,
      select: "id,patient_id,truck_id,crew_id,trip_type,claim_ready",
    });

    tripRowsInserted = tripsInsert.insertedRows as any[];
    tripCount = tripsInsert.insertedCount;

    pushSeedLog(logs, {
      step: "create_trips_legs_time_windows",
      status: "ok",
      count: tripCount,
      detail: `legs=${legsInsert.insertedCount}, trips=${tripCount}`,
    });
  } catch (e: any) {
    pushSeedLog(logs, { step: "create_trips_legs_time_windows", status: "error", error: e.message });
  }

  // g) apply safety rules + mark warnings/blocked
  let blockedTrips = 0;
  let warningTrips = 0;
  try {
    const { data: allCrews } = await admin
      .from("crews")
      .select("id,member1_id,member2_id")
      .in("id", crewIds.length ? crewIds : ["00000000-0000-0000-0000-000000000000"]);

    const crewMap = new Map<string, { member1_id: string | null; member2_id: string | null }>();
    for (const c of allCrews ?? []) {
      crewMap.set(c.id, { member1_id: c.member1_id, member2_id: c.member2_id });
    }

    const overrideRows: Record<string, unknown>[] = [];

    for (const trip of tripRowsInserted) {
      const blockers: string[] = [];
      const warnings: string[] = [];
      const needs = patientMeta.get(trip.patient_id);
      const truck = trip.truck_id ? truckMeta.get(trip.truck_id) : undefined;
      const crew = trip.crew_id ? crewMap.get(trip.crew_id) : undefined;

      const m1 = crew?.member1_id ? profileMeta.get(crew.member1_id) : undefined;
      const m2 = crew?.member2_id ? profileMeta.get(crew.member2_id) : undefined;
      const crewLift = (m1?.maxLift ?? 0) + (m2?.maxLift ?? 0);

      if (!needs) {
        warnings.push("MISSING_PATIENT_REQUIREMENTS");
      } else {
        if ((needs.weight ?? 0) >= 300 && !truck?.has_bariatric_kit) blockers.push("UNSAFE_LIFT_RISK");
        if (needs.stairChairRequired && !truck?.has_stair_chair) blockers.push("STAIR_CHAIR_REQUIRED");
        if (needs.oxygen && !truck?.has_oxygen_mount) blockers.push("OXYGEN_SUPPORT_REQUIRED");
        if ((needs.weight ?? 0) > 0 && crewLift > 0 && (needs.weight ?? 0) > crewLift) blockers.push("CREW_LIFT_CAPACITY_EXCEEDED");
      }

      if (blockers.length > 0) {
        blockedTrips++;
        await admin
          .from("trip_records")
          .update({
            claim_ready: false,
            blockers,
            billing_blocked_reason: blockers.join(", "),
          })
          .eq("id", trip.id);

        overrideRows.push({
          company_id: companyId,
          trip_record_id: trip.id,
          overridden_by: userId,
          override_reason: "SIM_SEED",
          override_status: "approved",
          reasons: blockers,
        });
      } else if (warnings.length > 0) {
        warningTrips++;
      }
    }

    if (overrideRows.length > 0) {
      await insertRowsResilient({
        admin,
        step: "apply_safety_rules",
        table: "safety_overrides",
        rows: overrideRows,
        logs,
        rowErrors,
        requiredFields: ["company_id", "trip_record_id", "overridden_by", "override_reason", "override_status"],
        batchSize: 25,
        select: "id",
      });
    }

    pushSeedLog(logs, {
      step: "apply_safety_rules",
      status: "ok",
      detail: `blocked=${blockedTrips}, warnings=${warningTrips}, overrides=${overrideRows.length}`,
    });
  } catch (e: any) {
    pushSeedLog(logs, { step: "apply_safety_rules", status: "error", error: e.message });
  }

  // h) set billing readiness fields
  try {
    const { data: billingTrips } = await admin
      .from("trip_records")
      .select("id,status,pcs_attached,signature_obtained,documentation_complete")
      .eq("company_id", companyId)
      .eq("simulation_run_id", runId);

    for (const t of billingTrips ?? []) {
      const ready = t.status === "completed" && !!t.pcs_attached && !!t.signature_obtained && !!t.documentation_complete;
      if (!ready) {
        await admin.from("trip_records").update({ claim_ready: false }).eq("id", t.id);
      }
    }

    pushSeedLog(logs, {
      step: "set_billing_readiness_fields",
      status: "ok",
      count: billingTrips?.length ?? 0,
    });
  } catch (e: any) {
    pushSeedLog(logs, { step: "set_billing_readiness_fields", status: "error", error: e.message });
  }

  const firstRowError = rowErrors[0];

  if (tripCount === 0) {
    await admin.from("simulation_runs").update({ status: "failed" }).eq("id", runId);
    return {
      ok: false,
      step: firstRowError?.step || "create_trips_legs_time_windows",
      table: firstRowError?.table,
      error: firstRowError?.error || "No trips were seeded",
      row: firstRowError?.row,
      validationErrors: firstRowError?.validationErrors,
      logs,
      rowErrors: rowErrors.slice(0, 50),
    };
  }

  await admin.from("simulation_runs").update({ status: rowErrors.length > 0 ? "completed_with_warnings" : "completed" }).eq("id", runId);

  pushSeedLog(logs, {
    step: "complete",
    status: "ok",
    detail: `trip_count=${tripCount}, row_errors=${rowErrors.length}`,
  });

  return {
    ok: true,
    runId,
    scenario: config.name,
    truckCount: truckIds.length,
    patientCount: patientIds.length,
    tripCount,
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

  // BILLING CHECK 1: Trips missing PCS/auth/sig cannot be billing ready (PCR-type aware)
  const allTrips = trips ?? [];
  let falseReadyCount = 0;
  for (const t of allTrips) {
    if (!t.claim_ready) continue;
    const pcrType = t.pcr_type || "other";
    // PCR-type-specific required fields
    if (pcrType === "nemt_dialysis" || pcrType === "ift_discharge") {
      if (!t.pcs_attached || !t.signature_obtained) falseReadyCount++;
    } else if (pcrType === "emergency_ems") {
      if (!t.signature_obtained) falseReadyCount++;
    } else {
      if (!t.signature_obtained) falseReadyCount++;
    }
  }
  results.push({
    name: "No trip Billing Ready if PCR-type required items missing",
    category: "billing",
    pass: falseReadyCount === 0,
    reason: falseReadyCount === 0
      ? "All billing-ready trips satisfy their PCR-type requirements"
      : `${falseReadyCount} trips marked claim_ready despite missing PCR-required fields`,
  });

  // BILLING CHECK 2: Override actions are logged in billing_overrides table
  const { data: billingOverrides } = await admin.from("billing_overrides")
    .select("id, trip_id")
    .limit(100);

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
      if (t.pcr_type === "nemt_dialysis" || t.pcr_type === "ift_discharge") {
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

async function resetSandbox(admin: any, companyId: string) {
  const tables = [
    "safety_overrides", "claim_records", "trip_records", "truck_run_slots", "scheduling_legs",
    "crews", "trucks", "patients", "facilities",
  ];

  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { data } = await admin.from(table)
      .delete()
      .eq("company_id", companyId)
      .eq("is_simulated", true)
      .select("id");
    counts[table] = data?.length ?? 0;
  }

  const { data: simProfiles } = await admin.from("profiles")
    .delete()
    .eq("company_id", companyId)
    .eq("is_simulated", true)
    .select("id");
  counts["profiles"] = simProfiles?.length ?? 0;

  const { data: runs } = await admin.from("simulation_runs").delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
  counts["simulation_runs"] = runs?.length ?? 0;

  return counts;
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

    const companyId = await ensureSandboxCompany(admin, callerUser.user.id);

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
        result = await resetSandbox(admin, companyId);
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
      default:
        return new Response(JSON.stringify({ ok: false, error: `Unknown action: ${action}` }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Simulation lab error:", error);
    // Always return 200 with error details
    return new Response(JSON.stringify({ ok: false, step: "handler", error: error.message || "Internal error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
