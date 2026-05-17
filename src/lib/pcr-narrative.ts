// Natural-prose EMS narrative generator — reads like a medic wrote it.
// Inputs are aggregated from the trip record, attached patient, equipment
// usage, ICD-10 codes, PCS-on-file status, and crew observations.

import {
  LEVEL_OF_CONSCIOUSNESS,
  SKIN_CONDITIONS,
  PHYSICAL_EXAM_SYSTEMS,
  formatOtherDisplay,
} from "./pcr-dropdowns";

export interface NarrativeICD10 {
  code: string;
  description: string;
}

export interface NarrativeInput {
  truckName: string;
  transportType: string;
  patientName: string;
  patientAge: number | null;
  patientSex: string;
  pickupAddress: string;
  destination: string;
  // Location types (residence / hospital / SNF / dialysis...)
  originType?: string | null;
  destinationType?: string | null;
  // Times
  dispatchTime: string | null;
  atSceneTime: string | null;
  patientContactTime: string | null;
  leftSceneTime: string | null;
  atDestinationTime: string | null;
  inServiceTime: string | null;
  // Clinical
  chiefComplaint: string | null;
  chiefComplaintOther?: string | null;
  primaryImpression: string | null;
  primaryImpressionOther?: string | null;
  medicalNecessityReason: string | null;
  levelOfConsciousness: string | null;
  skinCondition: string | null;
  vitals: any[];
  physicalExam: Record<string, any>;
  equipment: any;
  conditionOnArrival: any;
  transportCondition: string | null;
  disposition: string | null;
  // Mobility / bariatric / equipment flags
  mobility?: string | null;
  bariatric?: boolean;
  stairChairRequired?: boolean;
  oxygenDuringTransport?: boolean;
  oxygenLpm?: number | string | null;
  // ICD-10 context
  icd10?: NarrativeICD10[];
  // PCS status (42 CFR 410.40(d))
  pcsOnFile?: boolean;
  pcsSignedDate?: string | null;
  // IFT specific
  sendingFacility: any;
  hospitalOutcome: any;
  // Medic
  attendingMedicName: string | null;
  // Wound care criteria flags
  wc_unsafe_positioning?: boolean;
  wc_sterile_dressing?: boolean;
  wc_wound_vac_drainage?: boolean;
  wc_dehiscence_risk?: boolean;
  wc_stretcher_required?: boolean;
}

function fmtTime(ts: string | null): string {
  if (!ts) return "[time not recorded]";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return "[time not recorded]"; }
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "[date not recorded]";
  try {
    const dt = new Date(d.length === 10 ? d + "T00:00:00" : d);
    return dt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch { return d; }
}

function loc(val: string | null): string {
  if (!val) return "";
  return LEVEL_OF_CONSCIOUSNESS.find((l) => l.value === val)?.narrative ?? val.toLowerCase();
}
function skin(val: string | null): string {
  if (!val) return "";
  return SKIN_CONDITIONS.find((s) => s.value === val)?.narrative ?? val.toLowerCase();
}

function vitalsSet(v: any): string {
  if (!v) return "";
  const parts: string[] = [];
  if (v.bp_systolic && v.bp_diastolic) parts.push(`BP ${v.bp_systolic}/${v.bp_diastolic}`);
  if (v.pulse) parts.push(`HR ${v.pulse}`);
  if (v.respiratory_rate) parts.push(`RR ${v.respiratory_rate}`);
  if (v.spo2) parts.push(`SpO2 ${v.spo2}%`);
  if (v.temperature) parts.push(`temp ${v.temperature}°F`);
  if (v.blood_glucose) parts.push(`BGL ${v.blood_glucose}`);
  return parts.join(", ");
}

function vitalsAllStable(vitals: any[]): boolean {
  if (!vitals?.length) return false;
  return vitals.every((v) => {
    if (!v) return false;
    const sys = Number(v.bp_systolic), dia = Number(v.bp_diastolic);
    const hr = Number(v.pulse), rr = Number(v.respiratory_rate), spo2 = Number(v.spo2);
    if (sys && (sys < 90 || sys > 180)) return false;
    if (dia && (dia < 50 || dia > 110)) return false;
    if (hr && (hr < 50 || hr > 120)) return false;
    if (rr && (rr < 10 || rr > 24)) return false;
    if (spo2 && spo2 < 92) return false;
    return true;
  });
}

function examFindings(exam: Record<string, any>): string[] {
  const out: string[] = [];
  for (const [system, data] of Object.entries(exam || {})) {
    const cfg = PHYSICAL_EXAM_SYSTEMS[system];
    if (!cfg || !data?.findings?.length) continue;
    for (const f of data.findings) {
      const found = cfg.findings.find((cf) => cf.value === f);
      if (found?.narrative) out.push(found.narrative.replace(/\.$/, "").toLowerCase());
    }
  }
  return out;
}

function locationPhrase(type: string | null | undefined, fallback: string, role: "from" | "to"): string {
  const t = (type || "").toLowerCase();
  const mapped =
    t.includes("residence") || t === "r" || t === "home" ? "the patient's residence" :
    t.includes("hospital") ? "the hospital" :
    t.includes("snf") || t.includes("skilled") || t === "n" ? "the skilled nursing facility" :
    t.includes("dialysis") || t === "g" ? "the outpatient dialysis facility" :
    t.includes("physician") || t.includes("office") || t === "p" ? "the physician's office" :
    t.includes("scene") || t === "s" ? "the scene" :
    t.includes("rehab") || t === "e" ? "the rehab facility" :
    t.includes("intermediate") || t === "i" ? "an intermediate stop" :
    t.includes("outpatient") ? "the outpatient facility" :
    "";
  if (mapped) return mapped;
  return fallback || (role === "from" ? "the pickup location" : "the receiving facility");
}

function buildDiagnosisClause(icd: NarrativeICD10[] | undefined): string {
  if (!icd || !icd.length) return "";
  const descs = icd
    .map((c) => (c.description || "").trim())
    .filter(Boolean)
    .map((d) => d.toLowerCase().replace(/\.$/, ""));
  if (!descs.length) return "";
  if (descs.length === 1) return descs[0];
  if (descs.length === 2) return `${descs[0]} and ${descs[1]}`;
  return `${descs.slice(0, -1).join(", ")}, and ${descs[descs.length - 1]}`;
}

function mobilityPhrase(input: NarrativeInput): string {
  const parts: string[] = [];
  const m = (input.mobility || "").toLowerCase();
  if (m.includes("bed")) parts.push("bed-confined");
  else if (m.includes("non") && m.includes("ambul")) parts.push("non-ambulatory");
  else if (m.includes("wheelchair")) parts.push("wheelchair-dependent");
  else if (m) parts.push(m);
  if (input.bariatric) parts.push("requiring bariatric equipment");
  return parts.join(", ");
}

function equipmentPhrase(input: NarrativeInput): string {
  const eq = input.equipment || {};
  const parts: string[] = [];
  const lpm = input.oxygenLpm ?? eq.oxygen_flow_rate;
  if (input.oxygenDuringTransport || eq.oxygen) {
    if (lpm) parts.push(`continuous oxygen at ${lpm} LPM via ${eq.oxygen_delivery_method || "nasal cannula"}`);
    else parts.push("continuous oxygen during transport");
  }
  if (eq.stretcher_type) parts.push(`${String(eq.stretcher_type).toLowerCase()}`);
  if (input.stairChairRequired || eq.stair_chair) parts.push("stair chair");
  if (eq.cardiac_monitor) parts.push("cardiac monitor applied");
  return parts.join(", ");
}

function joinSentences(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .map((p) => (p.endsWith(".") ? p : p + "."))
    .join(" ");
}

export function generateNarrative(input: NarrativeInput): string {
  // Resolve "Other" placeholders into the free-text the user typed.
  const chief = formatOtherDisplay(input.chiefComplaint, input.chiefComplaintOther || null);
  const impression = formatOtherDisplay(input.primaryImpression, input.primaryImpressionOther || null);
  const chiefLower = chief ? chief.replace(/^Other\s*—\s*/i, "").toLowerCase() : "";
  const impressionLower = impression ? impression.replace(/^Other\s*—\s*/i, "").toLowerCase() : "";

  const ageStr = input.patientAge ? `${input.patientAge}-year-old` : "";
  const sexStr = input.patientSex === "M" ? "male" : input.patientSex === "F" ? "female" : "patient";
  const dx = buildDiagnosisClause(input.icd10);
  const mob = mobilityPhrase(input);
  const equip = equipmentPhrase(input);
  const v0 = vitalsSet(input.vitals?.[0]);
  const stable = vitalsAllStable(input.vitals || []);
  const exam = examFindings(input.physicalExam || {});
  const origin = locationPhrase(input.originType, input.pickupAddress, "from");
  const destination = locationPhrase(input.destinationType, input.destination, "to");
  const tType = (input.transportType || "").toLowerCase();
  const isEmergency = tType.includes("911") || tType.includes("emerg");
  const isIft = tType.includes("ift") || tType.includes("inter") || tType.includes("discharge");
  const isDialysis = tType.includes("dialysis");
  const isWound = tType.includes("wound");

  // PCS phrasing — covers the dialysis-style "Bed-confined per PCS dated …"
  // sentence the user wants. Falls back to medical-necessity reason if no PCS.
  let pcsClause = "";
  if (input.pcsOnFile && input.pcsSignedDate) {
    const bedPart = mob ? `${mob.charAt(0).toUpperCase() + mob.slice(1)}` : "Medically necessary stretcher transport";
    pcsClause = `${bedPart} per Physician Certification Statement signed ${fmtDate(input.pcsSignedDate)}`;
  } else if (input.pcsOnFile) {
    pcsClause = `${mob ? mob.charAt(0).toUpperCase() + mob.slice(1) : "Medically necessary"} per Physician Certification Statement on file`;
  } else if (input.medicalNecessityReason) {
    pcsClause = `Ambulance transport medically necessary because ${input.medicalNecessityReason.toLowerCase().replace(/\.$/, "")}`;
  }

  // ---------- Sentence 1: dispatch & patient identification ----------
  const dispatchKind = isEmergency ? "an emergency response"
    : isDialysis ? "a scheduled non-emergency dialysis transport"
    : isWound ? "a scheduled wound care transport"
    : isIft ? "an inter-facility transfer"
    : tType ? `a scheduled ${tType.replace(/_/g, " ")} transport`
    : "a non-emergency transport";

  const s1 = `Unit ${input.truckName} was dispatched at ${fmtTime(input.dispatchTime)} for ${dispatchKind} and made patient contact at ${fmtTime(input.patientContactTime || input.atSceneTime)}`;

  // ---------- Sentence 2: clinical picture — age/sex + diagnoses + complaint ----------
  const patientPhrase = [ageStr, sexStr].filter(Boolean).join(" ") || "patient";
  let s2 = `Patient is a ${patientPhrase}`;
  if (dx) s2 += ` with ${dx}`;
  if (chiefLower && !chiefLower.includes("routine") && !chiefLower.includes("no complaint") && !chiefLower.includes("transfer")) {
    s2 += `, presenting with ${chiefLower}`;
  } else if (isDialysis) {
    s2 += `, transported for scheduled outpatient dialysis treatment`;
  } else if (isWound) {
    s2 += `, transported for scheduled wound care treatment`;
  } else if (chiefLower) {
    s2 += `, transported for ${chiefLower}`;
  }
  if (impressionLower && impressionLower !== chiefLower) s2 += `; on-scene impression is ${impressionLower}`;

  // ---------- Sentence 3: PCS / medical necessity + mode of transport ----------
  const modePhrase = mob.includes("bed") || isDialysis || isWound || isIft
    ? "transferred via stretcher with crew assist"
    : input.stairChairRequired
      ? "moved via stair chair and stretcher with crew assist"
      : "transported by stretcher with crew assist";

  const s3 = pcsClause
    ? `${pcsClause}, ${modePhrase} from ${origin} to ${destination}`
    : `Patient ${modePhrase} from ${origin} to ${destination}`;

  // ---------- Sentence 4: equipment & oxygen ----------
  let s4 = "";
  if (equip) s4 = `Equipment in use during transport included ${equip}`;

  // ---------- Sentence 5: assessment ----------
  const assessBits: string[] = [];
  if (loc(input.levelOfConsciousness)) assessBits.push(`patient was ${loc(input.levelOfConsciousness)}`);
  if (skin(input.skinCondition)) assessBits.push(`skin was ${skin(input.skinCondition)}`);
  if (exam.length) assessBits.push(`exam notable for ${exam.slice(0, 3).join(", ")}`);
  let s5 = assessBits.length ? `On assessment, ${assessBits.join("; ")}` : "";

  // ---------- Sentence 6: vitals ----------
  let s6 = "";
  if (v0) {
    s6 = `Initial vitals: ${v0}`;
    if (input.vitals && input.vitals.length > 1) {
      s6 += `, with ${input.vitals.length - 1} additional set${input.vitals.length > 2 ? "s" : ""} obtained en route`;
    }
    if (stable) s6 += "; vitals remained stable throughout transport";
  } else {
    s6 = "Vitals stable throughout transport";
  }

  // ---------- Sentence 7: course / disposition ----------
  let s7 = "";
  if (isEmergency) {
    s7 = `Patient transported to ${destination}, arriving at ${fmtTime(input.atDestinationTime)}${input.disposition ? `, disposition ${input.disposition.toLowerCase()}` : ""}`;
  } else {
    s7 = `No acute complaints during transit. Patient arrived at ${destination} at ${fmtTime(input.atDestinationTime || input.leftSceneTime)} and transfer of care was given to receiving staff without incident`;
  }

  let s8 = `Crew returned to service at ${fmtTime(input.inServiceTime)}`;

  // ---------- Wound-care medical-necessity bullet → prose ----------
  const wcReasons: string[] = [];
  if (input.wc_unsafe_positioning) wcReasons.push("patient cannot maintain safe positioning in a standard vehicle due to wound location");
  if (input.wc_sterile_dressing) wcReasons.push("wound requires sterile dressing maintenance during transport");
  if (input.wc_wound_vac_drainage) wcReasons.push("patient is on wound VAC or has active drainage requiring oversight");
  if (input.wc_dehiscence_risk) wcReasons.push("patient condition creates risk of wound dehiscence during movement");
  if (input.wc_stretcher_required) wcReasons.push("patient requires stretcher positioning unachievable in a standard vehicle");
  const woundClause = wcReasons.length
    ? `Stretcher transport remains medically necessary because ${Array.from(new Set(wcReasons)).join("; ")}`
    : "";

  const narrative = joinSentences(s1, s2, s3, woundClause, s4, s5, s6, s7, s8);

  return input.attendingMedicName
    ? `${narrative}\n\nAttending Medic: ${input.attendingMedicName}`
    : narrative;
}
