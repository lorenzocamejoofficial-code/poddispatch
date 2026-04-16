// Auto-generate professional EMS narrative in CHART format
import {
  LEVEL_OF_CONSCIOUSNESS,
  SKIN_CONDITIONS,
  PHYSICAL_EXAM_SYSTEMS,
  MEDICAL_NECESSITY_REASONS,
} from "./pcr-dropdowns";

interface NarrativeInput {
  truckName: string;
  transportType: string;
  patientName: string;
  patientAge: number | null;
  patientSex: string;
  pickupAddress: string;
  destination: string;
  // Times
  dispatchTime: string | null;
  atSceneTime: string | null;
  patientContactTime: string | null;
  leftSceneTime: string | null;
  atDestinationTime: string | null;
  inServiceTime: string | null;
  // Clinical
  chiefComplaint: string | null;
  primaryImpression: string | null;
  medicalNecessityReason: string | null;
  levelOfConsciousness: string | null;
  skinCondition: string | null;
  vitals: any[];
  physicalExam: Record<string, any>;
  equipment: any;
  conditionOnArrival: any;
  transportCondition: string | null;
  disposition: string | null;
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

function getLOCNarrative(val: string | null): string {
  if (!val) return "";
  const found = LEVEL_OF_CONSCIOUSNESS.find(l => l.value === val);
  return found ? found.narrative : val;
}

function getSkinNarrative(val: string | null): string {
  if (!val) return "";
  const found = SKIN_CONDITIONS.find(s => s.value === val);
  return found ? found.narrative : val;
}

function buildVitalsString(vitals: any[]): string {
  if (!vitals || vitals.length === 0) return "";
  const v = vitals[0];
  const parts: string[] = [];
  if (v.bp_systolic && v.bp_diastolic) parts.push(`BP ${v.bp_systolic}/${v.bp_diastolic}`);
  if (v.pulse) parts.push(`HR ${v.pulse}`);
  if (v.respiratory_rate) parts.push(`RR ${v.respiratory_rate}`);
  if (v.spo2) parts.push(`SpO2 ${v.spo2}%`);
  if (v.temperature) parts.push(`Temp ${v.temperature}°F`);
  if (v.blood_glucose) parts.push(`BGL ${v.blood_glucose}`);
  return parts.join(", ");
}

function buildExamNarrative(exam: Record<string, any>): string {
  const parts: string[] = [];
  for (const [system, data] of Object.entries(exam)) {
    const sysConfig = PHYSICAL_EXAM_SYSTEMS[system];
    if (!sysConfig || !data?.findings?.length) continue;
    for (const findingVal of data.findings) {
      const found = sysConfig.findings.find(f => f.value === findingVal);
      if (found) parts.push(found.narrative);
    }
  }
  return parts.join(". ") + (parts.length > 0 ? "." : "");
}

function buildEquipmentString(eq: any): string {
  if (!eq) return "";
  const parts: string[] = [];
  if (eq.oxygen && eq.oxygen_flow_rate) {
    parts.push(`oxygen at ${eq.oxygen_flow_rate} LPM via ${eq.oxygen_delivery_method || "nasal cannula"}`);
  }
  if (eq.stretcher_type) parts.push(`${eq.stretcher_type.toLowerCase()}`);
  if (eq.stair_chair) parts.push("stair chair utilized");
  if (eq.cardiac_monitor) parts.push("cardiac monitor applied");
  if (eq.other) parts.push(eq.other);
  return parts.join(", ");
}

export function generateNarrative(input: NarrativeInput): string {
  const type = input.transportType.toLowerCase();
  const ageStr = input.patientAge ? `${input.patientAge} year old` : "";
  const sexStr = input.patientSex === "M" ? "male" : input.patientSex === "F" ? "female" : "";
  const loc = getLOCNarrative(input.levelOfConsciousness);
  const skin = getSkinNarrative(input.skinCondition);
  const vitalsStr = buildVitalsString(input.vitals);
  const examStr = buildExamNarrative(input.physicalExam || {});
  const equipStr = buildEquipmentString(input.equipment);

  if (type.includes("wound")) {
    const coa = input.conditionOnArrival || {};
    const woundType = coa.wound_type === "Other" ? (coa.wound_type_other || "wound") : (coa.wound_type || "wound");
    const woundStage = coa.pressure_ulcer_stage ? ` (${coa.pressure_ulcer_stage})` : "";
    const woundLoc = coa.wound_location ? ` located at ${coa.wound_location}` : "";
    const mobility = coa.patient_mobility || coa.mobility || "";

    let narrative = `Unit ${input.truckName} was dispatched at ${fmtTime(input.dispatchTime)} for a scheduled wound care transport. `;
    narrative += `Crew made patient contact at ${fmtTime(input.patientContactTime || input.atSceneTime)} at ${input.pickupAddress}. `;
    narrative += `Patient is a ${ageStr} ${sexStr}`.trim();
    narrative += ` presenting for scheduled wound care treatment. `;

    narrative += `Patient has a documented ${woundType.toLowerCase()}${woundStage}${woundLoc}. `;
    if (coa.wound_notes) narrative += `${coa.wound_notes}. `;

    // Wound-care-specific medical necessity criteria
    const wcCriteria: string[] = [];
    if (input["wc_unsafe_positioning" as any] || (input as any).wc_unsafe_positioning) wcCriteria.push("patient cannot maintain safe positioning in a standard vehicle due to wound location");
    const anyInput: any = input;
    if (anyInput.wc_unsafe_positioning) wcCriteria.push("patient cannot maintain safe positioning in a standard vehicle due to wound location");
    if (anyInput.wc_sterile_dressing) wcCriteria.push("wound requires monitoring or sterile dressing maintenance during transport");
    if (anyInput.wc_wound_vac_drainage) wcCriteria.push("patient is on wound VAC or has active drainage requiring oversight during transit");
    if (anyInput.wc_dehiscence_risk) wcCriteria.push("patient condition creates risk of wound injury or dehiscence during movement");
    if (anyInput.wc_stretcher_required) wcCriteria.push("patient requires stretcher positioning unachievable in a wheelchair van or standard vehicle");
    // de-dup
    const uniqueCriteria = Array.from(new Set(wcCriteria));

    if (uniqueCriteria.length > 0) {
      narrative += `Ambulance transport is medically necessary because ${uniqueCriteria.join("; ")}. `;
    } else if (input.medicalNecessityReason) {
      narrative += `Ambulance transport is medically necessary: ${input.medicalNecessityReason.toLowerCase()}. `;
    }

    if (mobility) narrative += `Patient mobility: ${String(mobility).toLowerCase()}. `;

    if (loc) narrative += `On assessment, patient was ${loc}`;
    if (skin) narrative += `, skin ${skin}`;
    narrative += ". ";

    if (vitalsStr) narrative += `Vital signs: ${vitalsStr}. `;
    if (equipStr) narrative += `Equipment: ${equipStr}. `;

    narrative += `Wound integrity maintained throughout transport. Patient transported without incident to ${input.destination}, arriving at ${fmtTime(input.atDestinationTime || input.leftSceneTime)}. `;
    narrative += `Transfer of care given to wound care facility staff at ${fmtTime(input.atDestinationTime)}. `;
    narrative += `Crew returned to service at ${fmtTime(input.inServiceTime)}.`;

    if (input.attendingMedicName) {
      narrative += `\n\nAttending Medic: ${input.attendingMedicName}`;
    }

    return narrative;
  }

  if (type.includes("dialysis") || type.includes("outpatient")) {
    const transportDesc = type.includes("dialysis") ? "scheduled non-emergency dialysis transport" : "scheduled outpatient transport";

    let narrative = `Unit ${input.truckName} was dispatched at ${fmtTime(input.dispatchTime)} for a ${transportDesc}. `;
    narrative += `Crew made patient contact at ${fmtTime(input.patientContactTime || input.atSceneTime)} at ${input.pickupAddress}. `;
    narrative += `Patient is a ${ageStr} ${sexStr}`.trim();

    if (input.chiefComplaint && input.chiefComplaint !== "No Complaint (routine transport)") {
      narrative += ` presenting with ${input.chiefComplaint.toLowerCase()}. `;
    } else {
      narrative += ` presenting for routine ${type.includes("dialysis") ? "dialysis" : "medical"} treatment. `;
    }

    if (input.medicalNecessityReason) {
      const reason = input.medicalNecessityReason.toLowerCase();
      narrative += `Patient requires stretcher transport due to: ${reason}. `;
    }

    if (loc) narrative += `On assessment, patient was ${loc}`;
    if (skin) narrative += `, skin ${skin}`;
    narrative += ". ";

    if (vitalsStr) narrative += `Vital signs: ${vitalsStr}. `;
    if (equipStr) narrative += `Equipment: ${equipStr}. `;

    narrative += `Patient was loaded and transported without incident to ${input.destination}, arriving at ${fmtTime(input.atDestinationTime || input.leftSceneTime)}. `;
    narrative += `Transfer of care given to facility staff at ${fmtTime(input.atDestinationTime)}. `;
    narrative += `Crew returned to service at ${fmtTime(input.inServiceTime)}.`;

    if (input.attendingMedicName) {
      narrative += `\n\nAttending Medic: ${input.attendingMedicName}`;
    }

    return narrative;
  }

  if (type.includes("ift") || type.includes("discharge")) {
    let narrative = `Unit ${input.truckName} was dispatched at ${fmtTime(input.dispatchTime)} for an inter-facility transfer. `;

    if (input.sendingFacility?.facility_name) {
      narrative += `Transfer requested from ${input.sendingFacility.facility_name}`;
      if (input.sendingFacility.physician_name) narrative += ` by Dr. ${input.sendingFacility.physician_name}`;
      if (input.sendingFacility.diagnosis) narrative += ` for ${input.sendingFacility.diagnosis}`;
      narrative += ". ";
    }

    narrative += `Crew arrived on scene at ${fmtTime(input.atSceneTime)} and made patient contact at ${fmtTime(input.patientContactTime || input.atSceneTime)}. `;
    narrative += `Patient is a ${ageStr} ${sexStr}`.trim() + ". ";

    if (loc) narrative += `Patient was ${loc}`;
    if (skin) narrative += `, skin ${skin}`;
    narrative += ". ";

    if (vitalsStr) narrative += `Vital signs: ${vitalsStr}. `;
    if (examStr) narrative += examStr + " ";
    if (equipStr) narrative += `Equipment: ${equipStr}. `;

    narrative += `Patient was transported to ${input.destination}, arriving at ${fmtTime(input.atDestinationTime)}. `;
    narrative += `Transfer of care completed. Crew in service at ${fmtTime(input.inServiceTime)}.`;

    if (input.attendingMedicName) {
      narrative += `\n\nAttending Medic: ${input.attendingMedicName}`;
    }

    return narrative;
  }

  // Emergency / complex
  let narrative = `Unit ${input.truckName} was dispatched at ${fmtTime(input.dispatchTime)} for an emergency response. `;
  narrative += `Crew arrived on scene at ${fmtTime(input.atSceneTime)} and established patient contact at ${fmtTime(input.patientContactTime || input.atSceneTime)}. `;
  narrative += `Patient is a ${ageStr} ${sexStr}`.trim();

  if (input.chiefComplaint) {
    narrative += ` with chief complaint of ${input.chiefComplaint.toLowerCase()}`;
  }
  narrative += ". ";

  if (input.primaryImpression) narrative += `Primary impression: ${input.primaryImpression}. `;
  if (loc) narrative += `Patient was ${loc}`;
  if (skin) narrative += `, skin ${skin}`;
  narrative += ". ";

  if (vitalsStr) narrative += `Initial vital signs: ${vitalsStr}. `;

  if (input.vitals && input.vitals.length > 1) {
    for (let i = 1; i < input.vitals.length; i++) {
      const rv = buildVitalsString([input.vitals[i]]);
      if (rv) narrative += `Repeat vitals set ${i + 1}: ${rv}. `;
    }
  }

  if (examStr) narrative += `Physical exam findings: ${examStr} `;
  if (equipStr) narrative += `Equipment: ${equipStr}. `;

  narrative += `Patient transported to ${input.destination}, arriving at ${fmtTime(input.atDestinationTime)}. `;
  if (input.disposition) narrative += `Disposition: ${input.disposition}. `;
  narrative += `Crew in service at ${fmtTime(input.inServiceTime)}.`;

  if (input.attendingMedicName) {
    narrative += `\n\nAttending Medic: ${input.attendingMedicName}`;
  }

  return narrative;
}
