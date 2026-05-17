// Shared ICD-10-CM 2026 reference list used by both the ICD10Picker UI and
// the auto-narrative generator. Keep this list in sync with payer policies;
// codes here drive both the dropdown options and the natural-prose diagnosis
// clause in PCR narratives.

export interface ICD10Code {
  code: string;
  description: string;
}

export const COMMON_ICD10_CODES: readonly ICD10Code[] = [
  // Renal / Dialysis
  { code: "Z99.2", description: "Dependence on renal dialysis" },
  { code: "N18.6", description: "End stage renal disease" },
  { code: "N18.5", description: "Chronic kidney disease stage 5" },
  { code: "N18.4", description: "Chronic kidney disease stage 4" },
  // Cardiovascular
  { code: "I10", description: "Essential (primary) hypertension" },
  { code: "I50.9", description: "Heart failure, unspecified" },
  { code: "I50.32", description: "Chronic diastolic (congestive) heart failure" },
  { code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery" },
  { code: "I48.91", description: "Longstanding persistent atrial fibrillation" },
  { code: "I63.9", description: "Cerebral infarction, unspecified" },
  // Musculoskeletal & Post-Surgical
  { code: "M16.11", description: "Primary osteoarthritis, right hip" },
  { code: "M16.12", description: "Primary osteoarthritis, left hip" },
  { code: "M17.11", description: "Primary osteoarthritis, right knee" },
  { code: "M17.12", description: "Primary osteoarthritis, left knee" },
  { code: "Z96.641", description: "Presence of right artificial hip joint" },
  { code: "Z96.642", description: "Presence of left artificial hip joint" },
  { code: "Z96.651", description: "Presence of right artificial knee joint" },
  { code: "Z96.652", description: "Presence of left artificial knee joint" },
  { code: "M54.5", description: "Low back pain" },
  { code: "S72.001A", description: "Fracture of unspecified part of neck of right femur" },
  { code: "Z47.1", description: "Aftercare following joint replacement surgery" },
  // Neurological
  { code: "G35", description: "Multiple sclerosis" },
  { code: "G20", description: "Parkinson disease" },
  { code: "I69.351", description: "Hemiplegia affecting ambulation" },
  { code: "G81.90", description: "Hemiplegia, unspecified" },
  { code: "R41.3", description: "Other amnesia" },
  { code: "G30.9", description: "Alzheimer disease, unspecified" },
  { code: "F03.90", description: "Unspecified dementia without behavioral disturbance" },
  { code: "F01.50", description: "Vascular dementia, unspecified severity, without behavioral disturbance" },
  // Respiratory
  { code: "J44.1", description: "COPD with acute exacerbation" },
  { code: "J44.0", description: "COPD with lower respiratory infection" },
  { code: "J45.51", description: "Severe persistent asthma with acute exacerbation" },
  { code: "J96.00", description: "Acute respiratory failure, unspecified" },
  { code: "J96.10", description: "Chronic respiratory failure, unspecified" },
  { code: "J95.03", description: "Malfunction of tracheostomy stoma" },
  { code: "J95.04", description: "Tracheo-esophageal fistula following tracheostomy" },
  { code: "Z93.0", description: "Tracheostomy status" },
  { code: "Z99.11", description: "Dependence on respirator [ventilator] status" },
  // Diabetes / Endocrine
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications" },
  { code: "E11.65", description: "Type 2 diabetes mellitus with hyperglycemia" },
  { code: "E11.649", description: "Type 2 diabetes mellitus with hypoglycemia without coma" },
  { code: "E10.9", description: "Type 1 diabetes mellitus without complications" },
  { code: "E10.65", description: "Type 1 diabetes mellitus with hyperglycemia" },
  { code: "E10.649", description: "Type 1 diabetes mellitus with hypoglycemia without coma" },
  { code: "E16.2", description: "Hypoglycemia, unspecified" },
  { code: "R73.9", description: "Hyperglycemia, unspecified" },
  { code: "Z79.4", description: "Long term (current) use of insulin" },
  { code: "E87.1", description: "Hyponatremia" },
  { code: "E66.01", description: "Morbid (severe) obesity due to excess calories" },
  { code: "Z68.45", description: "Body mass index (BMI) 70 or greater, adult" },
  // Mobility & Functional Status
  { code: "R26.89", description: "Other abnormalities of gait and mobility" },
  { code: "R26.9", description: "Unspecified abnormalities of gait and mobility" },
  { code: "Z74.09", description: "Other reduced mobility / dependence on enabling machines" },
  { code: "R53.1", description: "Weakness" },
  { code: "M62.50", description: "Muscle weakness (generalized)" },
  // Wound Care / Skin
  { code: "L89.90", description: "Pressure ulcer of unspecified site, unspecified stage" },
  { code: "L89.159", description: "Pressure ulcer of sacral region, unspecified stage" },
  { code: "L89.314", description: "Pressure ulcer of right buttock, stage 4" },
  { code: "L97.909", description: "Non-pressure chronic ulcer of unspecified lower leg" },
  { code: "L98.499", description: "Non-pressure chronic ulcer of skin of other sites, unspecified severity" },
  { code: "E11.621", description: "Type 2 diabetes mellitus with foot ulcer" },
  { code: "I83.90", description: "Varicose veins of unspecified lower extremity without complications" },
  { code: "T81.31XA", description: "Disruption of external operation (surgical) wound, NEC, initial encounter" },
  { code: "Z48.817", description: "Encounter for surgical aftercare following surgery on the skin and subcutaneous tissue" },
  { code: "Z48.815", description: "Encounter for surgical aftercare following surgery on the circulatory system" },
  { code: "Z48.89", description: "Encounter for other specified surgical aftercare" },
  // GU / Catheter
  { code: "T83.090A", description: "Other mechanical complication of indwelling urethral catheter, initial encounter" },
  { code: "Z93.6", description: "Other artificial openings of urinary tract status" },
  { code: "Z46.6", description: "Encounter for fitting and adjustment of urinary device" },
  { code: "N39.0", description: "Urinary tract infection, site not specified" },
  // Cancer / Oncology
  { code: "C80.1", description: "Malignant (primary) neoplasm, unspecified" },
  { code: "Z51.11", description: "Encounter for antineoplastic chemotherapy" },
  { code: "Z51.12", description: "Encounter for antineoplastic immunotherapy" },
  { code: "Z79.899", description: "Other long-term (current) drug therapy" },
  // Hospice / Palliative
  { code: "Z51.5", description: "Encounter for palliative care" },
  { code: "Z66", description: "Do not resuscitate" },
  // Isolation / Infectious
  { code: "Z29.0", description: "Encounter for isolation" },
  { code: "Z20.828", description: "Contact with and (suspected) exposure to other viral communicable diseases" },
  { code: "Z20.9", description: "Contact with and (suspected) exposure to unspecified communicable disease" },
  // Psychiatric & Behavioral
  { code: "F20.9", description: "Schizophrenia, unspecified" },
  { code: "F31.9", description: "Bipolar disorder, unspecified" },
  { code: "F32.9", description: "Major depressive disorder, single episode, unspecified" },
  { code: "F41.9", description: "Anxiety disorder, unspecified" },
  { code: "F10.20", description: "Alcohol dependence, uncomplicated" },
  { code: "F10.929", description: "Alcohol use, unspecified with intoxication, unspecified" },
  { code: "F19.929", description: "Other psychoactive substance use, unspecified with intoxication, unspecified" },
  { code: "F43.10", description: "Post-traumatic stress disorder, unspecified" },
  { code: "R45.1", description: "Restlessness and agitation" },
  { code: "R45.6", description: "Violent behavior" },
  { code: "Z03.89", description: "Encounter for observation for other suspected diseases and conditions ruled out" },
  // Routine Transport & Status
  { code: "Z09", description: "Encounter for follow-up examination after completed treatment" },
  { code: "Z51.89", description: "Encounter for other specified aftercare" },
  { code: "Z87.39", description: "Personal history of other diseases of the musculoskeletal system" },
  { code: "Z96.29", description: "Presence of other orthopedic joint implants" },
  { code: "Z95.810", description: "Presence of automatic (implantable) cardiac defibrillator" },
];

// Map chief complaint values (lowercased trimmed) → suggested ICD-10 codes.
// 2-4 high-frequency codes per complaint. Keys MUST match the chief-complaint
// strings in pcr-dropdowns.ts (compared after .toLowerCase().trim()).
export const COMPLAINT_SUGGESTIONS: Record<string, string[]> = {
  // Routine / transfer
  "no complaint — routine transport": ["Z09", "Z51.89", "Z87.39"],
  "transfer — no acute complaint": ["Z09", "Z51.89", "Z87.39"],
  // Weakness
  "weakness (extremity / focal)": ["R53.1", "M62.50", "R26.89", "G81.90"],
  "general weakness / debility": ["R53.1", "M62.50", "R26.89", "G81.90"],
  // Neurological
  "cva / stroke symptoms": ["I63.9", "I69.351", "G81.90"],
  "altered mental status": ["R41.3", "G30.9", "F03.90"],
  "seizure": ["G20", "G35", "F20.9"],
  // Cardio
  "chest pain": ["I50.9", "I25.10", "I10"],
  // Respiratory
  "breathing difficulty / dyspnea": ["J44.1", "J44.0", "J96.00"],
  "respiratory distress": ["J44.1", "J44.0", "J96.00"],
  "tracheostomy concern": ["Z93.0", "J95.03", "J95.04"],
  // Endocrine
  "hyperglycemia": ["E11.65", "E10.65", "R73.9"],
  "hypoglycemia": ["E16.2", "E11.649", "E10.649"],
  "diabetic routine care transport": ["E11.9", "Z79.4", "E11.65"],
  // Trauma / pain
  "fall — with injury": ["S72.001A", "M54.5", "R26.89"],
  "generalized pain — specify location": ["M54.5", "M16.11", "M17.11", "R26.89"],
  "back pain": ["M54.5", "M16.11", "M17.11", "R26.89"],
  // NEMSIS / routine NEMT
  "esrd — scheduled dialysis transport": ["Z99.2", "N18.6", "N18.5"],
  "wound check / dressing change": ["L97.909", "L89.90", "E11.621"],
  "active wound — drainage / vac": ["T81.31XA", "L98.499", "Z48.817"],
  "pressure ulcer care": ["L89.90", "L89.159", "L89.314"],
  "hospice / palliative transport": ["Z51.5", "Z66", "C80.1"],
  "post-op recovery transport": ["Z48.89", "Z48.815", "Z47.1"],
  "isolation transport (known infectious precaution)": ["Z29.0", "Z20.828", "Z20.9"],
  "catheter / urostomy concern": ["T83.090A", "Z93.6", "Z46.6", "N39.0"],
  "behavioral / psychiatric emergency": ["F32.9", "F41.9"],
  "bariatric transport": ["E66.01", "Z68.45"],
  // Primary-impression-only items (mapped here too in case the picker is
  // ever wired up to primary_impression as well as chief_complaint).
  "ventilator dependent — stable": ["Z99.11", "J96.10", "Z93.0"],
  "dementia / cognitive impairment — baseline": ["F03.90", "G30.9", "F01.50"],
};

// O(1) code → description lookup for the narrative generator.
export const ICD10_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  COMMON_ICD10_CODES.map((c) => [c.code, c.description])
);
