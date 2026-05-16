// Comprehensive clinical dropdown options for PCR system
// NEMSIS 3.5 aligned (eSituation.09 Chief Complaint / eSituation.11 Primary Impression)

export interface DropdownGroup {
  parent: string;
  items: string[];
}

// Chief Complaint — eSituation.09 (patient-presenting symptoms)
export const CHIEF_COMPLAINT_GROUPS: DropdownGroup[] = [
  { parent: "CARDIOVASCULAR", items: ["Chest Pain / Discomfort", "Palpitations", "Cardiac Arrest", "Hypertension", "Hypotension / Shock", "Edema (Peripheral)"] },
  { parent: "RESPIRATORY", items: ["Breathing Difficulty / Dyspnea", "Respiratory Distress", "Respiratory Arrest", "Cough", "Tracheostomy Concern", "Airway Obstruction"] },
  { parent: "NEUROLOGICAL", items: ["Altered Mental Status", "CVA / Stroke Symptoms", "Seizure", "Syncope / Near Syncope", "Headache", "Dizziness / Vertigo", "Weakness (Extremity / Focal)"] },
  { parent: "MUSCULOSKELETAL", items: ["Back Pain", "Extremity Pain", "Joint Pain / Swelling", "Post-Operative Orthopedic Recovery"] },
  { parent: "GI / ABDOMINAL", items: ["Abdominal Pain", "Nausea / Vomiting", "GI Bleeding", "Constipation / Obstipation", "Diarrhea"] },
  { parent: "GU / RENAL", items: ["ESRD — Scheduled Dialysis Transport", "Urinary Retention", "Catheter / Urostomy Concern", "Hematuria"] },
  { parent: "BEHAVIORAL / PSYCHIATRIC", items: ["Behavioral / Psychiatric Emergency", "Involuntary Psychiatric Hold Transport", "Suicidal Ideation", "Agitation / Combative Behavior", "Substance Intoxication / Withdrawal"] },
  { parent: "ENDOCRINE", items: ["Hyperglycemia", "Hypoglycemia", "Diabetic Routine Care Transport"] },
  { parent: "ENVIRONMENTAL", items: ["Hypothermia / Cold Exposure", "Hyperthermia / Heat Exposure", "Drowning / Submersion"] },
  { parent: "INFECTIOUS DISEASE", items: ["Sepsis / Suspected Infection", "Fever", "Isolation Transport (known infectious precaution)"] },
  { parent: "PAIN", items: ["Generalized Pain — specify location"] },
  { parent: "SENSORY", items: ["Visual Disturbance", "Hearing Loss / Tinnitus"] },
  { parent: "SKIN / WOUND", items: ["Wound Check / Dressing Change", "Active Wound — Drainage / Vac", "Pressure Ulcer Care", "Burn Care", "Rash / Skin Eruption"] },
  { parent: "TRAUMA", items: ["Fall — With Injury", "Fall — Without Injury", "MVC / Trauma", "Penetrating Trauma", "Assault"] },
  { parent: "GENERAL / SYSTEMIC", items: ["General Weakness / Debility", "Hospice / Palliative Transport", "Oncology Transport", "Post-Op Recovery Transport", "Bariatric Transport", "No Complaint — Routine Transport", "Transfer — No Acute Complaint"] },
  { parent: "OTHER", items: ["Other"] },
];

// Flat list (backward-compatible; current Select consumers iterate this)
export const CHIEF_COMPLAINTS: string[] = CHIEF_COMPLAINT_GROUPS.flatMap((g) => g.items);

// Primary Impression — eSituation.11 (clinician working diagnosis)
export const PRIMARY_IMPRESSION_GROUPS: DropdownGroup[] = [
  { parent: "CARDIOVASCULAR", items: ["Hypertension — Stable", "Heart Failure / CHF", "Atrial Fibrillation / Dysrhythmia", "Acute Coronary Syndrome (suspected)", "Cardiac Arrest", "Cardiovascular — Stable for Transport"] },
  { parent: "RESPIRATORY", items: ["COPD / Asthma — Stable", "COPD / Asthma — Exacerbation", "Respiratory Failure", "Tracheostomy — Stable", "Ventilator Dependent — Stable"] },
  { parent: "NEUROLOGICAL", items: ["CVA / TIA", "Seizure Disorder", "Dementia / Cognitive Impairment — Baseline", "Altered Mental Status", "Syncope", "Neurological — Stable"] },
  { parent: "MUSCULOSKELETAL", items: ["Post-Operative Orthopedic — Stable", "Chronic Musculoskeletal Pain", "Hip / Femur Fracture — Post Stabilization", "Joint Replacement Aftercare"] },
  { parent: "GI / ABDOMINAL", items: ["GI Bleed", "Bowel Obstruction", "Abdominal Pain — Undifferentiated", "GI — Stable"] },
  { parent: "GU / RENAL", items: ["ESRD on Dialysis", "Acute Kidney Injury", "Urinary Retention / Catheter Care", "GU — Stable"] },
  { parent: "BEHAVIORAL / PSYCHIATRIC", items: ["Acute Psychosis", "Suicidal Ideation", "Homicidal Ideation", "Manic Episode", "Acute Anxiety / Panic", "Substance Intoxication", "Substance Withdrawal", "Behavioral Agitation", "Depression with Functional Impairment", "Psychiatric — Stable"] },
  { parent: "ENDOCRINE", items: ["Diabetes — Controlled", "Diabetes — Uncontrolled (Hyper/Hypoglycemia)", "Endocrine — Stable"] },
  { parent: "ENVIRONMENTAL", items: ["Hypothermia", "Hyperthermia"] },
  { parent: "INFECTIOUS DISEASE", items: ["Sepsis", "Active Infection (Pneumonia / UTI / Cellulitis)", "Isolation Precautions — Stable"] },
  { parent: "PAIN", items: ["Pain — Acute", "Pain — Chronic"] },
  { parent: "SENSORY", items: ["Sensory — Stable"] },
  { parent: "SKIN / WOUND", items: ["Chronic Wound Care", "Pressure Ulcer (specify stage)", "Surgical Wound — Healing", "Burn"] },
  { parent: "TRAUMA", items: ["Trauma — Minor", "Trauma — Significant", "Post-Trauma Stable"] },
  { parent: "GENERAL / SYSTEMIC", items: ["Oncology — Active Treatment", "Hospice / Palliative", "General Debility / Deconditioned", "Bariatric — Stable", "Transfer — No Acute Complaint", "No Acute Findings — Routine Transport"] },
  { parent: "OTHER", items: ["Other"] },
];

export const PRIMARY_IMPRESSIONS: string[] = PRIMARY_IMPRESSION_GROUPS.flatMap((g) => g.items);

// Per-transport-type defaults (auto-applied when patient template and PCR fields are blank)
export interface TransportTypeDefaults {
  chief_complaint: string;
  primary_impression: string;
  icd10_codes: string[];
}

export const TRANSPORT_TYPE_DEFAULTS: Record<string, TransportTypeDefaults> = {
  dialysis:           { chief_complaint: "ESRD — Scheduled Dialysis Transport", primary_impression: "ESRD on Dialysis",                      icd10_codes: ["Z99.2", "N18.6"] },
  wound_care:         { chief_complaint: "Wound Check / Dressing Change",        primary_impression: "Chronic Wound Care",                   icd10_codes: ["L97.909", "L89.90"] },
  psych_transport:    { chief_complaint: "Behavioral / Psychiatric Emergency",   primary_impression: "Psychiatric — Stable",                 icd10_codes: ["F32.9", "F41.9"] },
  ift:                { chief_complaint: "Transfer — No Acute Complaint",        primary_impression: "Transfer — No Acute Complaint",        icd10_codes: ["Z09"] },
  discharge:          { chief_complaint: "No Complaint — Routine Transport",     primary_impression: "No Acute Findings — Routine Transport", icd10_codes: ["Z09", "Z51.89"] },
  outpatient:         { chief_complaint: "No Complaint — Routine Transport",     primary_impression: "No Acute Findings — Routine Transport", icd10_codes: ["Z09"] },
  bariatric:          { chief_complaint: "Bariatric Transport",                  primary_impression: "Bariatric — Stable",                   icd10_codes: ["E66.01", "Z68.45"] },
  als_non_emergency:  { chief_complaint: "General Weakness / Debility",          primary_impression: "Cardiovascular — Stable for Transport", icd10_codes: ["R53.1"] },
};

// ─────────────────────────────────────────────────────────────────────
// Patient-record required fields for clean-claim submission.
// Source: 42 CFR 410.40 + CMS MLN ambulance services guidance.
// These are evaluated AT THE PATIENT LEVEL — separate from PCR-completion
// gates (see pcr-field-requirements.ts). Both must pass at submit-for-billing.
// ─────────────────────────────────────────────────────────────────────
export interface PatientRequiredField {
  field: string;            // column name on patients
  label: string;            // human-readable label for UI / toast
  check: (p: any) => boolean; // returns true if satisfied
}

const hasStr  = (v: any) => typeof v === "string" && v.trim().length > 0;
const hasArr  = (v: any) => Array.isArray(v) && v.length > 0;
const isTrue  = (v: any) => v === true;

const BASE_FIELDS: PatientRequiredField[] = [
  { field: "default_chief_complaint",          label: "Default chief complaint",          check: p => hasStr(p?.default_chief_complaint) },
  { field: "default_primary_impression",       label: "Default primary impression",       check: p => hasStr(p?.default_primary_impression) },
  { field: "icd10_codes",                      label: "At least one ICD-10 code",         check: p => hasArr(p?.icd10_codes) },
  { field: "primary_payer",                    label: "Primary payer",                    check: p => hasStr(p?.primary_payer) },
];

const MOBILITY: PatientRequiredField = {
  field: "mobility", label: "Mobility level",
  // "ambulatory" is the column default — treat as "not set" so admin
  // is forced to explicitly confirm mobility level on non-ambulatory patients.
  check: p => hasStr(p?.mobility) && p.mobility !== "ambulatory",
};
const PCS: PatientRequiredField = {
  field: "pcs_on_file", label: "PCS on file (Physician Certification Statement)",
  check: p => isTrue(p?.pcs_on_file),
};
const NECESSITY: PatientRequiredField = {
  field: "default_medical_necessity_reason", label: "Medical necessity reason",
  check: p => hasStr(p?.default_medical_necessity_reason),
};
const WOUND_FIELDS: PatientRequiredField[] = [
  { field: "default_wound_type",     label: "Wound type",     check: p => hasStr(p?.default_wound_type) },
  { field: "default_wound_location", label: "Wound location", check: p => hasStr(p?.default_wound_location) },
  { field: "default_wound_stage",    label: "Wound stage",    check: p => hasStr(p?.default_wound_stage) },
];

export const TRANSPORT_TYPE_CLAIM_REQUIREMENTS: Record<string, PatientRequiredField[]> = {
  dialysis:           [...BASE_FIELDS, MOBILITY, PCS, NECESSITY],
  wound_care:         [...BASE_FIELDS, MOBILITY, PCS, NECESSITY, ...WOUND_FIELDS],
  ift:                [...BASE_FIELDS, MOBILITY, PCS, NECESSITY],
  ift_discharge:      [...BASE_FIELDS, MOBILITY, PCS, NECESSITY],
  discharge:          [...BASE_FIELDS, MOBILITY, PCS, NECESSITY],
  outpatient:         [...BASE_FIELDS, PCS],
  outpatient_specialty: [...BASE_FIELDS, PCS],
  psych_transport:    [...BASE_FIELDS],  // BH auth fields gated separately by payer
  // Emergency: PCS NOT required; payer often missing/self-pay → omit payer too.
  emergency:          [BASE_FIELDS[0], BASE_FIELDS[1], BASE_FIELDS[2]],
  private_pay:        [BASE_FIELDS[0], BASE_FIELDS[1]],
};

/**
 * Frequency-based payer overlay. Per CMS RSNAT model:
 * If primary_payer=medicare AND patient runs >=3 round trips/10 days OR
 * >=1/week for >=3 weeks, prior authorization (UTN from MAC) is required.
 *
 * We detect the threshold via the patient's recurring schedule config:
 *   - dialysis MWF / TTS = 3 days/week (auto-triggers)
 *   - any recurrence_days array with >=1 day on a standing/recurring order
 */
export function getFrequencyPayerRequirements(p: any): PatientRequiredField[] {
  if (!p) return [];
  const payer = String(p.primary_payer ?? "").toLowerCase().trim();
  if (payer !== "medicare") return [];

  const schedDays = String(p.schedule_days ?? "").trim();
  const recDays = Array.isArray(p.recurrence_days) ? p.recurrence_days : [];
  const isHighFrequency =
    schedDays === "MWF" || schedDays === "TTS" ||
    recDays.length >= 1 ||
    isTrue(p.standing_order);

  if (!isHighFrequency) return [];

  return [{
    field: "prior_auth_utn",
    label: "Prior authorization UTN (Medicare RSNAT)",
    check: q => hasStr(q?.prior_auth_utn),
  }];
}

/** Combined evaluator: returns the list of missing required fields for a patient. */
export function getMissingPatientRequirements(p: any): PatientRequiredField[] {
  if (!p) return [];
  const tType = String(p.transport_type ?? "").trim();
  const base = TRANSPORT_TYPE_CLAIM_REQUIREMENTS[tType] ?? [];
  const freq = getFrequencyPayerRequirements(p);
  return [...base, ...freq].filter(f => !f.check(p));
}

/**
 * Display helper: if a vocabulary value is "Other" and an _other text exists,
 * format as "Other — <text>". Otherwise return the value as-is.
 */
export function formatOtherDisplay(value: string | null | undefined, other: string | null | undefined): string {
  if (!value) return "";
  if (value === "Other" && other && other.trim()) return `Other — ${other.trim()}`;
  return value;
}

export const MEDICAL_NECESSITY_REASONS = [
  "Patient cannot sit safely in upright position",
  "Patient requires monitoring enroute",
  "Patient has contractures preventing safe positioning in wheelchair or car",
  "Patient has open wounds or burns requiring positioning or sterile environment",
  "Patient is unconscious or requires airway management",
  "Patient requires restraints for safety",
  "Patient is morbidly obese requiring bariatric equipment",
  "Patient has severe weakness — unable to ambulate",
  "Patient is bedbound",
  "Patient requires IV access or medication administration enroute",
  "Patient requires continuous oxygen titration during transport",
  "Patient at risk for aspiration without maintained positioning",
  "Patient requires suctioning en route",
  "Patient on continuous cardiac monitoring",
  "Wheelchair cannot accommodate patient's medical equipment",
  "Severe pain that worsens with any position change other than supine",
  "Patient is behaviorally agitated and requires monitoring for safety of patient and crew",
  "Patient is on involuntary psychiatric hold and requires secure transport",
  "Other",
];

export const WOUND_CARE_NECESSITY_REASONS = [
  "Patient cannot maintain safe positioning in standard vehicle due to wound location",
  "Wound requires monitoring or sterile dressing maintenance during transport",
  "Patient on wound VAC or has active drainage requiring oversight during transit",
  "Patient condition (diabetic neuropathy, peripheral vascular disease, osteomyelitis, post-surgical) creates risk of wound injury or dehiscence during movement",
  "Patient requires stretcher positioning that cannot be achieved in a wheelchair van or standard vehicle",
  "Other",
];

export const WOUND_TYPES = [
  "Diabetic ulcer",
  "Venous stasis ulcer",
  "Arterial ulcer",
  "Pressure ulcer",
  "Surgical wound",
  "Traumatic wound",
  "Burn",
  "Other",
];

export const PRESSURE_ULCER_STAGES = [
  "Stage 1",
  "Stage 2",
  "Stage 3",
  "Stage 4",
  "Unstageable",
];

export const LEVEL_OF_CONSCIOUSNESS = [
  { value: "alert_ox4", label: "Alert and Oriented x4 (person, place, time, event)", narrative: "alert and oriented to person, place, time, and event" },
  { value: "alert_ox3", label: "Alert and Oriented x3", narrative: "alert and oriented to person, place, and time" },
  { value: "alert_ox2", label: "Alert and Oriented x2", narrative: "alert and oriented to person and place" },
  { value: "alert_ox1", label: "Alert and Oriented x1", narrative: "alert and oriented to person only" },
  { value: "baseline_self_only", label: "Baseline cognitive impairment — oriented to self only", narrative: "at baseline cognitive impairment, oriented to self only" },
  { value: "non_verbal_baseline", label: "Non-verbal at baseline", narrative: "non-verbal at baseline" },
  { value: "sedated", label: "Sedated", narrative: "sedated" },
  { value: "sleeping_arousable", label: "Sleeping but arousable", narrative: "sleeping but arousable" },
  { value: "combative", label: "Combative", narrative: "combative" },
  { value: "confused", label: "Confused", narrative: "confused" },
  { value: "verbal_only", label: "Verbal Response Only", narrative: "responsive to verbal stimuli only" },
  { value: "unresponsive_verbal_only", label: "Unresponsive to verbal stimuli only", narrative: "unresponsive to verbal stimuli only" },
  { value: "pain_only", label: "Pain Response Only", narrative: "responsive to painful stimuli only" },
  { value: "unresponsive", label: "Unresponsive", narrative: "unresponsive" },
];

export const SKIN_CONDITIONS = [
  { value: "normal", label: "Normal (warm, dry, pink)", narrative: "warm, dry, and pink" },
  { value: "dry_intact", label: "Dry, intact", narrative: "dry and intact" },
  { value: "pale", label: "Pale", narrative: "pale" },
  { value: "cyanotic", label: "Cyanotic", narrative: "cyanotic" },
  { value: "diaphoretic", label: "Diaphoretic", narrative: "diaphoretic" },
  { value: "flushed", label: "Flushed", narrative: "flushed" },
  { value: "mottled", label: "Mottled", narrative: "mottled" },
  { value: "jaundiced", label: "Jaundiced", narrative: "jaundiced" },
  { value: "cool_dry", label: "Cool and Dry", narrative: "cool and dry" },
  { value: "hot_dry", label: "Hot and Dry", narrative: "hot and dry" },
  { value: "fragile_tears", label: "Fragile, tears noted", narrative: "fragile with skin tears noted" },
  { value: "bruising", label: "Bruising present", narrative: "bruising present" },
  { value: "rash", label: "Rash", narrative: "rash present" },
  { value: "edematous", label: "Edematous", narrative: "edematous" },
  { value: "surgical_dressing_intact", label: "Surgical site visible — dressing intact", narrative: "surgical site visible with dressing intact" },
  { value: "tenting", label: "Tenting / poor turgor", narrative: "skin tenting noted, poor turgor" },
  { value: "petechiae", label: "Petechiae", narrative: "petechiae present" },
];

export const RESPIRATORY_QUALITY = [
  { value: "normal", label: "Normal and Unlabored", narrative: "normal and unlabored" },
  { value: "shallow", label: "Shallow", narrative: "shallow" },
  { value: "labored", label: "Labored", narrative: "labored" },
  { value: "rapid", label: "Rapid", narrative: "rapid" },
  { value: "slow", label: "Slow", narrative: "slow" },
  { value: "absent", label: "Absent", narrative: "absent" },
  { value: "irregular", label: "Irregular", narrative: "irregular" },
  { value: "assisted", label: "Assisted (BVM/oxygen)", narrative: "assisted via BVM/oxygen" },
  { value: "trach_patent", label: "Tracheostomy patent", narrative: "tracheostomy patent" },
  { value: "trach_secretions", label: "Tracheostomy with secretions", narrative: "tracheostomy with secretions noted" },
  { value: "vent_dependent", label: "Ventilator dependent", narrative: "ventilator dependent" },
  { value: "accessory_muscle", label: "Accessory muscle use", narrative: "accessory muscle use noted" },
  { value: "retractions", label: "Retractions", narrative: "retractions noted" },
  { value: "nasal_flaring", label: "Nasal flaring", narrative: "nasal flaring noted" },
  { value: "pursed_lip", label: "Pursed lip breathing", narrative: "pursed lip breathing" },
  { value: "apneic", label: "Apneic episodes", narrative: "apneic episodes observed" },
];

export const PULSE_QUALITY = [
  { value: "strong_regular", label: "Strong and Regular", narrative: "strong and regular" },
  { value: "weak_regular", label: "Weak and Regular", narrative: "weak and regular" },
  { value: "strong_irregular", label: "Strong and Irregular", narrative: "strong and irregular" },
  { value: "weak_irregular", label: "Weak and Irregular", narrative: "weak and irregular" },
  { value: "bounding", label: "Bounding", narrative: "bounding" },
  { value: "thready", label: "Thready", narrative: "thready" },
  { value: "palpated_radial", label: "Palpated only — radial", narrative: "palpated only at radial" },
  { value: "per_monitor", label: "Per monitor only", narrative: "per cardiac monitor only" },
  { value: "absent", label: "Absent", narrative: "absent" },
];

export const OXYGEN_DELIVERY = [
  "Nasal Cannula", "Simple Face Mask", "Non-Rebreather Mask", "Venturi Mask",
  "Blow-By", "Trach Collar (humidified)", "BiPAP",
  "BVM Assisted Ventilation", "Tracheostomy Mask", "CPAP", "High Flow Nasal Cannula",
  "Patient's own home oxygen — continued", "Vent circuit",
];

// SINGLE source of truth for patient position (replaces both PATIENT_POSITIONS and StretcherMobilityCard.POSITION_OPTIONS)
export const PATIENT_POSITIONS = [
  "Supine (flat)",
  "Semi-Fowlers (30°)",
  "Fowlers (45°)",
  "High Fowlers (90°)",
  "Left lateral recovery position",
  "Trendelenburg",
  "Reverse Trendelenburg",
  "Position of comfort",
];

export const TRANSPORT_CONDITIONS = [
  "Condition Unchanged", "Condition Improved", "Condition Deteriorated",
  "Patient Refused Treatment", "Patient Became Unresponsive Enroute",
  "Tolerated transport well", "Anxious during transport", "Motion sickness",
  "Required suctioning", "Required additional oxygen during transport",
  "Vital signs deteriorated requiring intervention",
];

export const DISPOSITIONS = [
  "Transported to Destination Without Incident",
  "Patient Refused Transport",
  "Patient Transferred to Higher Level of Care",
  "Patient Deceased on Scene",
  "Cancelled Prior to Arrival",
  "AMA — Against Medical Advice",
  "Diverted to Different Destination",
  "Patient Eloped",
  "Released at Scene to Family",
  "Transferred to Law Enforcement",
  "Cancelled at Scene — No Patient Contact",
  "Cancelled by Sending Facility",
];

export const STRETCHER_TYPES = ["Power Stretcher", "Manual Stretcher", "Bariatric Stretcher"];

// --- Centralized lists previously declared inline in components ---

// From StretcherMobilityCard.tsx
export const STRETCHER_OPTIONS = [
  "Draw Sheet",
  "Manual Lift",
  "Mechanical Lift",
  "Backboard",
  "First Responders / Fire / Rescue",
  "Slider Board",
  "Hover Mat (air-assisted lateral transfer)",
  "Patient self-transferred with assist",
  "Pivot transfer",
  "Two-person lift",
  "Stand and pivot",
];

// From StretcherMobilityCard.tsx
export const MOBILITY_OPTIONS = [
  "Requires Maximum Assistance",
  "Unable to Ambulate",
  "Assisted Ambulation",
  "Independent with Device",
  "Bedbound",
  "Wheelchair-bound — cannot transfer",
  "Walker — independent",
  "Cane",
  "One-person assist",
  "Two-person assist",
  "Hoyer / mechanical lift required",
];

// From IsolationPrecautionsCard.tsx — expanded
export const PRECAUTION_TYPES = [
  "MRSA", "VRE", "C-Diff", "Hepatitis", "COVID-19", "HIV",
  "Tuberculosis (airborne)", "Influenza", "RSV", "ESBL", "CRE",
  "Norovirus", "Shingles / Zoster", "Pertussis", "Measles", "Other",
];

// New — precaution level (Contact / Droplet / Airborne / Standard)
export const PRECAUTION_LEVELS = ["Standard", "Contact", "Droplet", "Airborne"];

// From ConditionCard.tsx
export const DESTINATION_CONDITIONS = [
  "Alert/Oriented",
  "Confused",
  "Unresponsive",
  "Unchanged from arrival",
  "Improved from arrival",
  "Deteriorated from arrival",
];

// From FacilityCards.tsx (discharge destination)
export const DISCHARGE_DESTINATION_TYPES = [
  "Home",
  "SNF / Nursing Facility",
  "Assisted Living",
  "Another Hospital",
  "Hospice",
  "Group Home",
  "Acute Rehab (IRF)",
  "Other",
];

// From TimesCard.tsx — expanded
export const LOCATION_TYPE_OPTIONS = [
  "Residence",
  "SNF",
  "Assisted Living",
  "Hospital",
  "Dialysis Facility",
  "Outpatient Specialty",
  "Mental Health Facility",
  "Hospice",
  "Acute Rehab (IRF)",
  "LTACH",
  "Wound Care Center",
  "Cancer Center / Infusion",
  "Independent Living",
  "Group Home",
  "Correctional Facility",
  "Scene of Injury",
  "Other",
];

// --- Behavioral Health Transport options ---

export const BH_AUTHORIZATION_TYPES = [
  "Voluntary",
  "Involuntary — 1013 (Georgia form)",
  "Involuntary — 2013 (Georgia form)",
  "Law enforcement custody",
  "Court ordered",
];

export const BH_BEHAVIORAL_ASSESSMENT = [
  "Calm / cooperative",
  "Agitated — verbal only",
  "Agitated — physical threats",
  "Actively combative",
  "Passively resistant",
  "Unresponsive",
  "Psychotic features present",
  "Suicidal ideation reported",
  "Homicidal ideation reported",
  "Disorganized thought",
  "Responding to internal stimuli",
];

export const BH_RESTRAINT_TYPES = [
  "Soft wrist restraints",
  "Hard restraints",
  "Sheet wrap",
  "Law enforcement restraints",
  "Chemical restraint — medication given",
];

// Physical exam findings by body system
export const PHYSICAL_EXAM_SYSTEMS: Record<string, { findings: { value: string; label: string; narrative: string; abnormal: boolean }[] }> = {
  neurological: {
    findings: [
      { value: "wnl", label: "Intact / Within Normal Limits", narrative: "neurological exam intact and within normal limits", abnormal: false },
      { value: "headache", label: "Headache", narrative: "patient complains of headache", abnormal: true },
      { value: "dizziness", label: "Dizziness", narrative: "patient reports dizziness", abnormal: true },
      { value: "ams", label: "Altered Mental Status", narrative: "altered mental status noted", abnormal: true },
      { value: "facial_droop", label: "Facial Droop", narrative: "facial droop observed", abnormal: true },
      { value: "arm_drift", label: "Arm Drift", narrative: "arm drift noted on exam", abnormal: true },
      { value: "speech_difficulty", label: "Speech Difficulty", narrative: "speech difficulty observed", abnormal: true },
      { value: "seizure", label: "Seizure Activity", narrative: "seizure activity observed", abnormal: true },
      { value: "loc", label: "Loss of Consciousness", narrative: "loss of consciousness reported", abnormal: true },
      { value: "paralysis", label: "Paralysis / Weakness", narrative: "paralysis or focal weakness noted", abnormal: true },
    ],
  },
  respiratory: {
    findings: [
      { value: "clear", label: "Clear and Equal Bilaterally", narrative: "lung sounds clear and equal bilaterally", abnormal: false },
      { value: "wheezing", label: "Wheezing", narrative: "bilateral wheezing on auscultation", abnormal: true },
      { value: "crackles", label: "Crackles / Rales", narrative: "crackles/rales noted on auscultation", abnormal: true },
      { value: "diminished", label: "Diminished", narrative: "diminished lung sounds noted", abnormal: true },
      { value: "absent", label: "Absent", narrative: "absent lung sounds", abnormal: true },
      { value: "rhonchi", label: "Rhonchi", narrative: "rhonchi noted on auscultation", abnormal: true },
      { value: "stridor", label: "Stridor", narrative: "stridor observed", abnormal: true },
    ],
  },
  cardiovascular: {
    findings: [
      { value: "rrr", label: "Regular Rate and Rhythm", narrative: "heart sounds regular rate and rhythm", abnormal: false },
      { value: "irregular", label: "Irregular Rhythm", narrative: "irregular cardiac rhythm noted", abnormal: true },
      { value: "tachycardic", label: "Tachycardic", narrative: "tachycardic", abnormal: true },
      { value: "bradycardic", label: "Bradycardic", narrative: "bradycardic", abnormal: true },
      { value: "edema", label: "Peripheral Edema", narrative: "peripheral edema present", abnormal: true },
      { value: "jvd", label: "Jugular Vein Distension", narrative: "jugular vein distension noted", abnormal: true },
    ],
  },
  abdomen: {
    findings: [
      { value: "soft", label: "Soft and Non-tender", narrative: "abdomen soft and non-tender on palpation", abnormal: false },
      { value: "tender", label: "Tender", narrative: "abdominal tenderness noted on palpation", abnormal: true },
      { value: "rigid", label: "Rigid", narrative: "rigid abdomen on palpation", abnormal: true },
      { value: "distended", label: "Distended", narrative: "abdominal distension noted", abnormal: true },
      { value: "guarding", label: "Guarding", narrative: "guarding noted on abdominal exam", abnormal: true },
      { value: "pain", label: "Pain on Palpation", narrative: "pain elicited on palpation", abnormal: true },
    ],
  },
  extremities: {
    findings: [
      { value: "normal", label: "Normal Range of Motion", narrative: "extremities with normal range of motion, pulses present and equal bilaterally", abnormal: false },
      { value: "weakness", label: "Weakness", narrative: "weakness noted in extremities", abnormal: true },
      { value: "paralysis", label: "Paralysis", narrative: "paralysis of extremity noted", abnormal: true },
      { value: "edema", label: "Edema", narrative: "edema present in extremities", abnormal: true },
      { value: "deformity", label: "Deformity", narrative: "deformity observed", abnormal: true },
      { value: "lacerations", label: "Lacerations / Abrasions", narrative: "lacerations/abrasions noted", abnormal: true },
      { value: "pulses_present", label: "Pulses Present and Equal", narrative: "peripheral pulses present and equal", abnormal: false },
      { value: "pulses_diminished", label: "Pulses Diminished", narrative: "diminished peripheral pulses", abnormal: true },
    ],
  },
  mental_status: {
    findings: [
      { value: "calm", label: "Calm and Cooperative", narrative: "patient calm and cooperative", abnormal: false },
      { value: "anxious", label: "Anxious", narrative: "patient appears anxious", abnormal: true },
      { value: "agitated", label: "Agitated", narrative: "patient agitated", abnormal: true },
      { value: "combative", label: "Combative", narrative: "patient combative", abnormal: true },
      { value: "depressed", label: "Depressed", narrative: "patient appears depressed", abnormal: true },
      { value: "confused", label: "Confused", narrative: "patient confused", abnormal: true },
      { value: "unresponsive", label: "Unresponsive", narrative: "patient unresponsive", abnormal: true },
    ],
  },
};

// Cards configuration by transport type
export type PCRCardType =
  | "times" | "patient_info" | "vitals" | "condition_on_arrival" | "equipment"
  | "signatures" | "narrative" | "billing" | "sending_facility" | "assessment"
  | "physical_exam" | "hospital_outcome" | "chief_complaint" | "airway"
  | "procedures" | "medications" | "iv_access" | "medical_necessity"
  | "stretcher_mobility" | "isolation_precautions" | "behavioral_health";

export interface PCRCardConfig {
  type: PCRCardType;
  label: string;
  required: boolean;
}

const COMMON_END: PCRCardConfig[] = [
  { type: "signatures", label: "Signatures", required: true },
  { type: "narrative", label: "Narrative", required: false },
  { type: "billing", label: "Billing", required: false },
];

export const PCR_CARDS_BY_TRANSPORT: Record<string, PCRCardConfig[]> = {
  dialysis: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: false },
    { type: "vitals", label: "Vitals", required: true },
    { type: "condition_on_arrival", label: "Condition on Arrival", required: true },
    { type: "medical_necessity", label: "Medical Necessity", required: true },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: true },
    { type: "equipment", label: "Equipment in Use", required: false },
    ...COMMON_END,
  ],
  outpatient: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: false },
    { type: "vitals", label: "Vitals", required: true },
    { type: "condition_on_arrival", label: "Condition on Arrival", required: true },
    { type: "medical_necessity", label: "Medical Necessity", required: true },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: false },
    { type: "equipment", label: "Equipment in Use", required: false },
    ...COMMON_END,
  ],
  wound_care: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: false },
    { type: "vitals", label: "Vitals", required: true },
    { type: "condition_on_arrival", label: "Condition on Arrival", required: true },
    { type: "medical_necessity", label: "Medical Necessity", required: true },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: false },
    { type: "equipment", label: "Equipment in Use", required: false },
    ...COMMON_END,
  ],
  ift_discharge: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: false },
    { type: "sending_facility", label: "Sending Facility Info", required: true },
    { type: "vitals", label: "Vitals", required: true },
    { type: "assessment", label: "Assessment", required: true },
    { type: "physical_exam", label: "Physical Exam", required: true },
    { type: "medical_necessity", label: "Medical Necessity", required: true },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: true },
    { type: "equipment", label: "Equipment in Use", required: true },
    { type: "hospital_outcome", label: "Hospital Outcome", required: true },
    ...COMMON_END,
  ],
  emergency: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: true },
    { type: "chief_complaint", label: "Chief Complaint", required: true },
    { type: "vitals", label: "Vitals — Multiple Sets", required: true },
    { type: "assessment", label: "Assessment / Primary Impression", required: true },
    { type: "physical_exam", label: "Physical Exam", required: true },
    { type: "airway", label: "Airway / Interventions", required: true },
    { type: "procedures", label: "Procedures", required: true },
    { type: "medications", label: "Medications", required: true },
    { type: "iv_access", label: "IV Access", required: true },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: true },
    { type: "equipment", label: "Equipment in Use", required: true },
    { type: "hospital_outcome", label: "Hospital Outcome", required: true },
    ...COMMON_END,
  ],
  discharge: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: true },
    { type: "sending_facility", label: "Sending Facility Info", required: true },
    { type: "vitals", label: "Vitals", required: true },
    { type: "assessment", label: "Assessment", required: true },
    { type: "physical_exam", label: "Physical Exam", required: true },
    { type: "medical_necessity", label: "Medical Necessity", required: true },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: false },
    { type: "equipment", label: "Equipment in Use", required: true },
    { type: "hospital_outcome", label: "Hospital Outcome", required: false },
    ...COMMON_END,
  ],
  outpatient_specialty: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: true },
    { type: "vitals", label: "Vitals", required: true },
    { type: "condition_on_arrival", label: "Condition on Arrival", required: true },
    { type: "medical_necessity", label: "Medical Necessity", required: true },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: false },
    { type: "equipment", label: "Equipment in Use", required: false },
    ...COMMON_END,
  ],
  private_pay: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: true },
    { type: "vitals", label: "Vitals", required: false },
    { type: "condition_on_arrival", label: "Condition on Arrival", required: false },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: false },
    { type: "equipment", label: "Equipment in Use", required: false },
    ...COMMON_END,
  ],
  ift: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: true },
    { type: "sending_facility", label: "Sending Facility Info", required: true },
    { type: "vitals", label: "Vitals", required: true },
    { type: "assessment", label: "Assessment", required: true },
    { type: "physical_exam", label: "Physical Exam", required: true },
    { type: "medical_necessity", label: "Medical Necessity", required: true },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: true },
    { type: "equipment", label: "Equipment in Use", required: true },
    { type: "hospital_outcome", label: "Hospital Outcome", required: true },
    ...COMMON_END,
  ],
  psych_transport: [
    { type: "times", label: "Times", required: true },
    { type: "patient_info", label: "Patient Info", required: true },
    { type: "behavioral_health", label: "Behavioral Health Transport", required: true },
    { type: "vitals", label: "Vitals", required: true },
    { type: "assessment", label: "Assessment / Primary Impression", required: true },
    { type: "medical_necessity", label: "Medical Necessity", required: true },
    { type: "stretcher_mobility", label: "Stretcher & Mobility", required: true },
    { type: "isolation_precautions", label: "Isolation Precautions", required: false },
    { type: "equipment", label: "Equipment in Use", required: true },
    ...COMMON_END,
  ],
};

// Get the transport type key for PCR cards lookup
export function getPCRTransportKey(tripType: string | null): string {
  if (!tripType) return "dialysis";
  const t = tripType.toLowerCase();
  if (t.includes("psych") || t.includes("behavioral")) return "psych_transport";
  if (t.includes("ift") || t.includes("discharge")) return "ift_discharge";
  if (t.includes("emergency") || t.includes("complex")) return "emergency";
  if (t.includes("outpatient") || t.includes("appointment")) return "outpatient";
  if (t.includes("wound")) return "wound_care";
  return "dialysis";
}
