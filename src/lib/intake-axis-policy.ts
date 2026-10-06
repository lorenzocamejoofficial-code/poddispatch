import { normalizeTransportKind, type TransportKind } from "@/lib/transport-vocabulary";
import { normalizePayerClass } from "@/lib/payer-class";
import { getMissingPatientRequirements, type PatientRequiredField } from "@/lib/pcr-dropdowns";

export const INTAKE_TRANSPORT_OPTIONS: { value: TransportKind; label: string }[] = [
  { value: "dialysis", label: "Dialysis" }, { value: "ift", label: "IFT / Interfacility" },
  { value: "discharge", label: "Discharge" }, { value: "outpatient", label: "Outpatient" },
  { value: "wound_care", label: "Wound care" }, { value: "psych", label: "Psych / Behavioral transport" },
];
export function legacyIntakeTransport(kind: TransportKind) {
  return kind === "psych" ? "psych_transport" : kind;
}
export function intakeAxes(transport: string, payer: string) {
  const kind = normalizeTransportKind(transport);
  const payerClass = normalizePayerClass(payer);
  return { kind, payerClass, insurance: payerClass === "medicare" || payerClass === "medicaid" || payerClass === "commercial",
    dialysis: kind === "dialysis", wound: kind === "wound_care", psych: kind === "psych",
    facilities: kind === "ift" || kind === "discharge", appointment: kind === "outpatient" };
}

const INSURANCE_FIELDS = new Set(["member_id", "pcs_on_file", "pcs_physician_npi", "prior_auth_utn"]);
const present = (value: unknown) => typeof value === "string" ? value.trim().length > 0 : Array.isArray(value) ? value.length > 0 : !!value;
export interface IntakeIssue { field: string; label: string }

/** Intake-only requirements: never change downstream ePCR or billing gates. */
export function missingIntakeFields(form: Record<string, any>, mode: "recurring" | "oneoff"): IntakeIssue[] {
  const transport = mode === "recurring" ? form.transport_type : form.trip_type;
  const axes = intakeAxes(transport, form.primary_payer);
  const issues: IntakeIssue[] = [];
  const require = (field: string, label: string) => { if (!present(form[field])) issues.push({ field, label }); };
  if (!axes.kind) issues.push({ field: mode === "recurring" ? "transport_type" : "trip_type", label: "Transport kind" });
  if (!axes.payerClass) issues.push({ field: "primary_payer", label: "Payer class" });
  if (mode === "recurring") {
    const projected = { ...form, primary_payer: axes.payerClass, transport_type: axes.kind ? legacyIntakeTransport(axes.kind) : transport,
      schedule_days: axes.dialysis ? form.schedule_days : "" };
    const requirements: PatientRequiredField[] = getMissingPatientRequirements(projected);
    issues.push(...requirements.filter(r => r.field !== "primary_payer" && (axes.insurance || !INSURANCE_FIELDS.has(r.field))));
    require("dropoff_facility", axes.facilities ? "Receiving facility" : "Dropoff facility");
    if (axes.dialysis) require("schedule_days", "Dialysis schedule days");
    else require("recurrence_days", "Recurring weekdays");
    if (axes.dialysis || axes.appointment) require("chair_time", axes.dialysis ? "Chair time" : "Appointment time");
    if (axes.psych) {
      require("default_bh_authorization_type", "Behavioral authorization type");
      require("default_bh_authorizing_facility", "Authorizing facility");
    }
  } else {
    for (const [field, label] of [["name", "Patient name"], ["dob", "Date of birth"], ["sex", "Sex"],
      ["pickup_location", "Pickup address"], ["destination_location", "Destination address"],
      ["pickup_location_type", "Origin type"], ["destination_type", "Destination type"]]) require(field, label);
    if (axes.insurance) require("member_id", "Member ID");
    if (axes.dialysis || axes.appointment) require("chair_time", axes.dialysis ? "Chair time" : "Appointment time");
    if (axes.facilities) require("sending_facility_name", "Sending facility name");
    if (axes.wound) for (const [field, label] of [["wound_type", "Wound type"], ["wound_location", "Wound location"], ["wound_stage", "Wound stage"]]) require(field, label);
    if (axes.psych) {
      require("bh_authorization_type", "Behavioral authorization type");
      require("bh_authorizing_facility", "Authorizing facility");
      if (form.bh_authorization_type?.includes("1013") && !form.bh_1013_received) issues.push({ field: "bh_1013_received", label: "1013 received" });
    }
  }
  return issues.filter((r, i, rows) => rows.findIndex(x => x.field === r.field) === i);
}