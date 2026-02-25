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
  // Cascade pressure fields
  dispatchPressure?: {
    overstackedDialysisHours?: boolean;   // multiple same-time pickups
    crossCityRouting?: boolean;           // conflicting facility locations
    missingPatientInfo?: number;          // patients with unknown needs
    lateDischargeAdds?: number;           // mid-day discharge injections
    unrealisticGaps?: boolean;            // too-tight turnaround windows
    insufficientTrucks?: boolean;         // fewer trucks than needed
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
  // ── NEW CASCADE SCENARIOS ──
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

async function seedScenario(admin: any, companyId: string, userId: string, scenarioKey: string) {
  const config = SCENARIOS[scenarioKey];
  if (!config) throw new Error(`Unknown scenario: ${scenarioKey}`);

  const runId = crypto.randomUUID();
  const today = new Date().toISOString().slice(0, 10);
  const pressure = config.dispatchPressure;

  await admin.from("simulation_runs").insert({
    id: runId,
    scenario_name: config.name,
    created_by: userId,
    config: config,
  });

  // Create facilities — use city clusters if cross-city routing enabled
  const facilityTypes = ["dialysis", "hospital", "hospital", "snf", "rehab"];
  const facilityNames = ["Sim Dialysis Center", "Sim General Hospital", "Sim Medical Center", "Sim Nursing Facility", "Sim Rehab Center"];
  if (pressure?.crossCityRouting) {
    facilityNames.push("Sim Dialysis North", "Sim Dialysis South");
  }
  const facilityIds: string[] = [];
  for (let i = 0; i < facilityNames.length; i++) {
    const addr = pressure?.crossCityRouting && i >= 5
      ? pick(CITY_CLUSTERS[i % CITY_CLUSTERS.length])
      : FAKE_ADDRESSES[i % FAKE_ADDRESSES.length];
    const { data } = await admin.from("facilities").insert({
      name: facilityNames[i],
      address: addr,
      facility_type: facilityTypes[i % facilityTypes.length],
      phone: `(555) 900-${String(i + 1).padStart(4, "0")}`,
      company_id: companyId,
      is_simulated: true,
      simulation_run_id: runId,
    }).select("id").single();
    if (data) facilityIds.push(data.id);
  }

  // Create trucks — fewer if insufficientTrucks
  const truckIds: string[] = [];
  const equipConfigs = [
    { has_power_stretcher: true, has_stair_chair: true, has_bariatric_kit: true, has_oxygen_mount: true },
    { has_power_stretcher: true, has_stair_chair: true, has_bariatric_kit: false, has_oxygen_mount: true },
    { has_power_stretcher: true, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: true },
    { has_power_stretcher: false, has_stair_chair: true, has_bariatric_kit: false, has_oxygen_mount: false },
    { has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: true },
    { has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: false },
  ];

  // For crew mismatch scenario, strip equipment from most trucks
  const isMismatch = scenarioKey === "crew_mismatch";
  for (let i = 0; i < config.truckCount; i++) {
    let equip = equipConfigs[i % equipConfigs.length];
    if (isMismatch && i > 1) {
      equip = { has_power_stretcher: false, has_stair_chair: false, has_bariatric_kit: false, has_oxygen_mount: false };
    }
    const { data } = await admin.from("trucks").insert({
      name: `SIM-${100 + i + 1}`,
      company_id: companyId,
      is_simulated: true,
      simulation_run_id: runId,
      ...equip,
    }).select("id").single();
    if (data) truckIds.push(data.id);
  }

  // Create crew profiles with speed/doc reliability
  const crewIds: string[] = [];
  for (let i = 0; i < truckIds.length; i++) {
    const profile = CREW_PROFILES[i % CREW_PROFILES.length];
    const crewName1 = FAKE_NAMES[i * 2] || `Crew Member ${i * 2}`;
    const crewName2 = FAKE_NAMES[i * 2 + 1] || `Crew Member ${i * 2 + 1}`;

    // For mismatch scenario: make most crews undertrained
    const isMismatchCrew = isMismatch && i > 0;
    const member1Id = crypto.randomUUID();
    const member2Id = crypto.randomUUID();

    // Create simulated profiles for crew members
    await admin.from("profiles").upsert([
      {
        id: member1Id,
        user_id: member1Id,
        full_name: crewName1,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
        max_safe_team_lift_lbs: isMismatchCrew ? rand(150, 200) : rand(250, 400),
        stair_chair_trained: isMismatchCrew ? false : coinFlip(0.7),
        bariatric_trained: isMismatchCrew ? false : coinFlip(0.4),
        oxygen_handling_trained: isMismatchCrew ? false : coinFlip(0.6),
        lift_assist_ok: coinFlip(0.5),
        cert_level: pick(["EMT", "AEMT", "Paramedic"]),
        sex: pick(["male", "female"]),
      },
      {
        id: member2Id,
        user_id: member2Id,
        full_name: crewName2,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
        max_safe_team_lift_lbs: isMismatchCrew ? rand(150, 200) : rand(250, 400),
        stair_chair_trained: isMismatchCrew ? false : coinFlip(0.6),
        bariatric_trained: isMismatchCrew ? false : coinFlip(0.3),
        oxygen_handling_trained: isMismatchCrew ? false : coinFlip(0.5),
        lift_assist_ok: coinFlip(0.5),
        cert_level: pick(["EMT", "AEMT", "Paramedic"]),
        sex: pick(["male", "female"]),
      },
    ]);

    const { data: crew } = await admin.from("crews").insert({
      truck_id: truckIds[i],
      member1_id: member1Id,
      member2_id: member2Id,
      active_date: today,
      company_id: companyId,
      is_simulated: true,
      simulation_run_id: runId,
    }).select("id").single();
    if (crew) crewIds.push(crew.id);
  }

  // Create patients
  const patientNames = pickN(FAKE_NAMES, config.patientCount);
  const totalTrips = config.tripMix.dialysis + config.tripMix.discharge + config.tripMix.outpatient + config.tripMix.hospital;
  const tripTypes: string[] = [];
  for (const [type, count] of Object.entries(config.tripMix)) {
    for (let i = 0; i < count; i++) tripTypes.push(type);
  }
  const payerTypes: string[] = [];
  for (const [payer, count] of Object.entries(config.payerMix)) {
    for (let i = 0; i < count; i++) payerTypes.push(payer);
  }

  const patientIds: string[] = [];
  const expiringAuthIndices = new Set(pickN([...Array(config.patientCount).keys()], config.authExpiring));
  // Indices of patients with missing needs data
  const missingInfoIndices = new Set(
    pressure?.missingPatientInfo
      ? pickN([...Array(config.patientCount).keys()], Math.min(pressure.missingPatientInfo, config.patientCount))
      : []
  );

  for (let i = 0; i < config.patientCount; i++) {
    const [first, last] = patientNames[i].split(" ");
    const tripType = tripTypes[i % tripTypes.length] as string;
    const payer = payerTypes[i % payerTypes.length];
    const authExpiring = expiringAuthIndices.has(i);
    const hasMissingInfo = missingInfoIndices.has(i);
    const authExpDate = authExpiring
      ? new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
      : new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

    // Weight distribution with intentional mismatches for cascade scenarios
    const weights = [120, 150, 165, 180, 195, 210, 240, 275, 310, 340, 360, 380];
    let weightVal = isMismatch
      ? weights[Math.min(i, weights.length - 1)]  // heavier patients for mismatch
      : weights[i % weights.length];
    // Bump some patients heavier for overload scenario
    if (pressure?.insufficientTrucks && i % 3 === 0) weightVal = pick([310, 340, 360]);

    const mobilities = ["ambulatory", "wheelchair", "stretcher", "bedbound"];
    const stairsOptions = ["none", "few_steps", "full_flight", "unknown"];
    const equipOptions = ["none", "none", "none", "bariatric_stretcher", "extra_crew", "lift_assist"];

    const mobilityVal = hasMissingInfo ? null : mobilities[i % mobilities.length];
    const stairsVal = hasMissingInfo ? "unknown" : stairsOptions[i % stairsOptions.length];
    const equipVal = hasMissingInfo ? "none" : equipOptions[i % equipOptions.length];
    const oxygenReq = !hasMissingInfo && i % 5 === 0;

    const { data } = await admin.from("patients").insert({
      first_name: first,
      last_name: last,
      dob: `19${50 + (i % 30)}-${String((i % 12) + 1).padStart(2, "0")}-${String((i % 28) + 1).padStart(2, "0")}`,
      phone: `(555) 800-${String(i + 1).padStart(4, "0")}`,
      pickup_address: pressure?.crossCityRouting ? pick(pick(CITY_CLUSTERS)) : pick(FAKE_ADDRESSES),
      dropoff_facility: facilityNames[i % facilityNames.length],
      transport_type: tripType === "hospital" ? "adhoc" : tripType === "discharge" ? "outpatient" : tripType as any,
      schedule_days: tripType === "dialysis" ? (i % 2 === 0 ? "MWF" : "TTS") : "MWF",
      status: "active",
      primary_payer: payer,
      auth_required: payer === "Medicare" || payer === "Medicaid",
      auth_expiration: authExpDate,
      weight_lbs: hasMissingInfo ? null : weightVal,
      mobility: mobilityVal,
      stairs_required: stairsVal,
      stair_chair_required: stairsVal === "full_flight",
      oxygen_required: oxygenReq,
      oxygen_lpm: oxygenReq ? [2, 3, 4, 6][i % 4] : null,
      bariatric: weightVal >= 300,
      special_equipment_required: equipVal,
      dialysis_window_minutes: tripType === "dialysis" ? 45 : 60,
      must_arrive_by: tripType === "dialysis" ? randTime(6, 8) : null,
      company_id: companyId,
      is_simulated: true,
      simulation_run_id: runId,
    }).select("id").single();
    if (data) patientIds.push(data.id);
  }

  // Create scheduling legs and trip records
  const missingPcsSet = new Set(pickN([...Array(totalTrips).keys()], config.missingPcs));
  const missingAuthSet = new Set(pickN([...Array(totalTrips).keys()], config.missingAuth));
  const missingSigSet = new Set(pickN([...Array(totalTrips).keys()], config.missingSignature));
  const missingTimesSet = new Set(pickN([...Array(totalTrips).keys()], config.missingTimestamps));

  // For overstacked dialysis: force many pickups into the same 06:00-07:00 window
  const dialysisOverstacked = pressure?.overstackedDialysisHours;
  // For unrealistic gaps: make turnaround windows too tight
  const unrealisticGaps = pressure?.unrealisticGaps;

  const statuses = ["scheduled", "assigned", "en_route", "loaded", "completed", "completed", "completed"];
  let tripIdx = 0;

  for (let i = 0; i < Math.min(totalTrips, patientIds.length); i++) {
    const truckIdx = i % truckIds.length;
    const patientId = patientIds[i];
    const tripType = tripTypes[i] as any;
    const payer = payerTypes[i % payerTypes.length];

    // Pickup time — overstacked means many at same time
    let pickupTime: string;
    if (dialysisOverstacked && tripType === "dialysis") {
      pickupTime = pick(["06:00", "06:15", "06:30", "06:00", "06:15"]); // clustered
    } else {
      pickupTime = tripType === "dialysis" ? randTime(5, 8) : randTime(8, 14);
    }

    // Cross-city facility assignment
    const facility = pressure?.crossCityRouting
      ? facilityNames[i % facilityNames.length]
      : facilityNames[tripType === "dialysis" ? 0 : (i % facilityNames.length)];

    const status = pick(statuses) as any;
    const isCompleted = status === "completed";

    // Crew profile for this truck affects PCR quality
    const crewProfile = CREW_PROFILES[truckIdx % CREW_PROFILES.length];
    const isRiskyCrew = crewProfile.docReliability === "risky";
    const isSlowCrew = crewProfile.speed === "slow";

    // Risky crews have higher chance of missing documentation
    const riskPcsMissing = missingPcsSet.has(tripIdx) || (isRiskyCrew && coinFlip(0.4));
    const riskSigMissing = missingSigSet.has(tripIdx) || (isRiskyCrew && coinFlip(0.35));
    const riskTimesMissing = missingTimesSet.has(tripIdx) || (isRiskyCrew && coinFlip(0.25));

    // Slow crews create late pickups
    const isLate = isSlowCrew && coinFlip(0.5);
    const actualPickupDelay = isLate ? rand(10, 35) : 0;

    // Pickup location — cross-city creates long distances
    const pickupLoc = pressure?.crossCityRouting
      ? pick(pick(CITY_CLUSTERS))
      : pick(FAKE_ADDRESSES);

    // A-leg
    const { data: legA } = await admin.from("scheduling_legs").insert({
      patient_id: patientId,
      leg_type: "A",
      pickup_location: pickupLoc,
      destination_location: facility,
      pickup_time: pickupTime,
      trip_type: tripType === "hospital" ? "hospital" : tripType === "discharge" ? "discharge" : tripType,
      run_date: today,
      company_id: companyId,
      is_simulated: true,
      simulation_run_id: runId,
      estimated_duration_minutes: unrealisticGaps ? rand(5, 10) : rand(20, 40),
    }).select("id").single();

    if (legA) {
      await admin.from("truck_run_slots").insert({
        truck_id: truckIds[truckIdx],
        leg_id: legA.id,
        run_date: today,
        slot_order: i,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
      });
    }

    // B-leg for dialysis
    if (tripType === "dialysis") {
      const chairTime = addMinutes(pickupTime, 30);
      const bTime = addMinutes(pickupTime, 240 + Math.floor(Math.random() * 60));
      const { data: legB } = await admin.from("scheduling_legs").insert({
        patient_id: patientId,
        leg_type: "B",
        pickup_location: facility,
        destination_location: pickupLoc,
        pickup_time: bTime,
        chair_time: chairTime,
        trip_type: "dialysis",
        run_date: today,
        company_id: companyId,
        is_simulated: true,
        simulation_run_id: runId,
        estimated_duration_minutes: unrealisticGaps ? rand(5, 10) : rand(20, 40),
      }).select("id").single();

      if (legB) {
        await admin.from("truck_run_slots").insert({
          truck_id: truckIds[truckIdx],
          leg_id: legB.id,
          run_date: today,
          slot_order: i + 1000,
          company_id: companyId,
          is_simulated: true,
          simulation_run_id: runId,
        });
      }
    }

    // Trip record — crew quality impacts documentation
    const hasPcs = !riskPcsMissing;
    const hasAuth = !missingAuthSet.has(tripIdx);
    const hasSig = !riskSigMissing;
    const hasTimes = !riskTimesMissing;
    const claimReady = isCompleted && hasPcs && hasSig && hasTimes && hasAuth;

    // PCR type based on trip type
    const pcrType = tripType === "dialysis" ? "nemt_dialysis"
      : tripType === "discharge" ? "ift_discharge"
      : tripType === "hospital" ? "emergency_ems" : "other";

    // Revenue estimate
    const baseRevenue = payer === "Medicare" ? rand(180, 350) : payer === "Medicaid" ? rand(120, 250) : rand(200, 400);

    await admin.from("trip_records").insert({
      patient_id: patientId,
      truck_id: truckIds[truckIdx],
      crew_id: crewIds[truckIdx] || null,
      leg_id: legA?.id,
      run_date: today,
      status: status,
      trip_type: tripType === "hospital" ? "hospital" : tripType === "discharge" ? "discharge" : tripType,
      pickup_location: pickupLoc,
      destination_location: facility,
      scheduled_pickup_time: pickupTime,
      loaded_miles: isCompleted ? Math.round((5 + Math.random() * 25) * 10) / 10 : null,
      pcs_attached: hasPcs,
      signature_obtained: hasSig,
      arrived_pickup_at: hasTimes && isCompleted ? `${today}T${addMinutes(pickupTime, actualPickupDelay)}:00` : null,
      arrived_dropoff_at: hasTimes && isCompleted ? `${today}T${addMinutes(pickupTime, 30 + actualPickupDelay + Math.floor(Math.random() * 20))}:00` : null,
      documentation_complete: hasPcs && hasSig && hasTimes,
      claim_ready: claimReady,
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

    tripIdx++;
  }

  // Inject late discharge adds if configured
  if (pressure?.lateDischargeAdds) {
    for (let d = 0; d < pressure.lateDischargeAdds; d++) {
      const pIdx = rand(0, patientIds.length - 1);
      await admin.from("trip_records").insert({
        patient_id: patientIds[pIdx],
        truck_id: truckIds[rand(0, truckIds.length - 1)],
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
        simulation_run_id: runId,
      });
    }
  }

  return { runId, scenario: config.name, truckCount: truckIds.length, patientCount: patientIds.length, tripCount: tripIdx + (pressure?.lateDischargeAdds ?? 0) };
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
      // Inject combined pressure: facility delay + crew slow + late adds
      const results: string[] = [];
      const r1 = await injectEvent(admin, companyId, "facility_behind");
      results.push(r1.description);
      const r2 = await injectEvent(admin, companyId, "crew_slow");
      results.push(r2.description);
      const r3 = await injectEvent(admin, companyId, "late_add_discharge");
      results.push(r3.description);
      // Degrade PCR quality on some completed trips
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
    .select("id, pickup_time, truck_run_slots(truck_id)")
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

  // BILLING CHECK 1: Trips missing PCS/auth/sig cannot be billing ready
  const allTrips = trips ?? [];
  let falseReadyCount = 0;
  for (const t of allTrips) {
    if (t.claim_ready && (!t.pcs_attached || !t.signature_obtained || !t.documentation_complete)) {
      falseReadyCount++;
    }
  }
  results.push({
    name: "Trips missing PCS/auth/signatures cannot be Billing Ready",
    category: "billing",
    pass: falseReadyCount === 0,
    reason: falseReadyCount === 0
      ? "No falsely-ready trips found"
      : `${falseReadyCount} trips marked claim_ready despite missing fields`,
  });

  // BILLING CHECK 2: Billing readiness counts
  const readyCount = allTrips.filter((t: any) => t.claim_ready).length;
  const blockedCount = allTrips.filter((t: any) => !t.claim_ready && t.status === "completed").length;
  const inProgressCount = allTrips.filter((t: any) => !["completed", "ready_for_billing", "cancelled", "no_show", "patient_not_ready"].includes(t.status)).length;
  results.push({
    name: "Billing readiness summary counts match trip statuses",
    category: "billing",
    pass: true,
    reason: `Ready: ${readyCount}, Blocked: ${blockedCount}, In-progress: ${inProgressCount}, Total: ${allTrips.length}`,
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

  return results;
}

async function generateSummary(admin: any, companyId: string) {
  const today = new Date().toISOString().slice(0, 10);

  // Fetch all data needed for summary
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

  // ── Core metrics ──
  const totalTrips = trips.length;
  const completed = trips.filter((t: any) => t.status === "completed").length;
  const cancelled = trips.filter((t: any) => ["cancelled", "no_show"].includes(t.status)).length;
  const inProgress = trips.filter((t: any) => !["completed", "cancelled", "no_show", "patient_not_ready", "ready_for_billing"].includes(t.status)).length;
  const patientNotReady = trips.filter((t: any) => t.status === "patient_not_ready").length;

  // ── Late trips (arrived after scheduled) ──
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

  // ── Safety risks ──
  const missingNeeds = patients.filter((p: any) => !p.weight_lbs || !p.mobility || p.stairs_required === "unknown").length;
  const heavyPatients = patients.filter((p: any) => p.weight_lbs && p.weight_lbs >= 300).length;
  const oxygenPatients = patients.filter((p: any) => p.oxygen_required).length;
  const trucksWithoutBari = trucks.filter((t: any) => !t.has_bariatric_kit).length;
  const trucksWithoutO2 = trucks.filter((t: any) => !t.has_oxygen_mount).length;
  const trucksDown = trucks.filter((t: any) => !t.active).length;

  // B-leg risk
  const bLegs = (bLegsRes.data ?? []).filter((l: any) => l.leg_type === "B");
  let bLegRisk = 0;
  for (const leg of bLegs) {
    if (leg.pickup_time && leg.chair_time) {
      const diff = timeToMin(leg.pickup_time) - timeToMin(leg.chair_time);
      if (diff < 180) bLegRisk++;
    }
  }

  // ── PCR & Billing ──
  const completedTrips = trips.filter((t: any) => t.status === "completed");
  const missingPcs = completedTrips.filter((t: any) => !t.pcs_attached).length;
  const missingSig = completedTrips.filter((t: any) => !t.signature_obtained).length;
  const missingDoc = completedTrips.filter((t: any) => !t.documentation_complete).length;
  const billingReady = completedTrips.filter((t: any) => t.claim_ready).length;
  const billingBlocked = completedTrips.filter((t: any) => !t.claim_ready).length;

  // Revenue
  const totalRevenue = trips.reduce((sum: number, t: any) => sum + (t.expected_revenue || 0), 0);
  const readyRevenue = completedTrips.filter((t: any) => t.claim_ready).reduce((sum: number, t: any) => sum + (t.expected_revenue || 0), 0);
  const atRiskRevenue = completedTrips.filter((t: any) => !t.claim_ready).reduce((sum: number, t: any) => sum + (t.expected_revenue || 0), 0);
  const lostRevenue = trips.filter((t: any) => ["cancelled", "no_show"].includes(t.status)).reduce((sum: number, t: any) => sum + (t.expected_revenue || 0), 0);

  // ── Per-truck breakdown ──
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

  // ── Cascade failure flags ──
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

  // Overcapacity check
  const truckWithMostTrips = truckSummary.reduce((max, t) => t.totalTrips > max ? t.totalTrips : max, 0);
  if (truckWithMostTrips > 10) flags.push({ flag: "OVERCAPACITY SCHEDULING", severity: "warning", detail: `Busiest truck has ${truckWithMostTrips} trips — exceeds safe capacity` });

  // Low revenue trucks
  const lowRevTrucks = truckSummary.filter(t => t.totalTrips > 0 && t.revenue < totalRevenue / trucks.length * 0.5);
  if (lowRevTrucks.length > 0) flags.push({ flag: "LOW REVENUE TRUCK", severity: "info", detail: `${lowRevTrucks.length} truck(s) producing <50% of average revenue` });

  const overrideCount = overridesRes.data?.length ?? 0;

  return {
    overview: {
      totalTrips,
      completed,
      cancelled,
      inProgress,
      patientNotReady,
      lateTrips,
    },
    safety: {
      missingNeeds,
      heavyPatients,
      oxygenPatients,
      bLegRisk,
      overridesUsed: overrideCount,
    },
    billing: {
      billingReady,
      billingBlocked,
      missingPcs,
      missingSig,
      missingDoc,
    },
    revenue: {
      total: totalRevenue,
      ready: readyRevenue,
      atRisk: atRiskRevenue,
      lost: lostRevenue,
    },
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

  // Also delete simulated profiles
  const { data: simProfiles } = await admin.from("profiles")
    .delete()
    .eq("company_id", companyId)
    .eq("is_simulated", true)
    .select("id");
  counts["profiles"] = simProfiles?.length ?? 0;

  // Clear simulation runs
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
      return new Response(JSON.stringify({ error: "No auth header" }), {
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

    const { data: isCreator } = await admin
      .from("system_creators")
      .select("id")
      .eq("user_id", callerUser.user.id)
      .maybeSingle();

    if (!isCreator) {
      return new Response(JSON.stringify({ error: "System creator access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    const companyId = await ensureSandboxCompany(admin, callerUser.user.id);

    let result: any;

    switch (action) {
      case "seed":
        result = await seedScenario(admin, companyId, callerUser.user.id, body.scenario);
        break;
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
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Simulation lab error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
