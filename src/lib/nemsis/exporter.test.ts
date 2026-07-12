import { describe, expect, it } from "vitest";
import { buildERecord, buildEmsDataSet, xmlEscape } from "./exporter";
import type { ExportContext, PcrExportInput } from "./exporter";

const ctx: ExportContext = {
  agency: {
    npi: "1234567890",
    name: "Test EMS Co",
    state_ems_agency_number: "GA-EMS-9999",
    state_ems_license_state: "GA",
  },
  vehicle: { vehicle_id: "T-1", unit_number: "17", vin: "1FDW", license_plate: "GA-777" },
  personnel: [
    { crew_member_id: "c1", full_name: "Jane Medic", state_license_number: "P12345", certification_level: "Paramedic" },
  ],
  state: "GA",
  test_mode: true,
  software: { name: "Pod Dispatch", version: "1.0.0" },
};

const input: PcrExportInput = {
  trip: {
    id: "trip-uuid-1",
    company_id: "co-1",
    dispatch_time: "2026-01-01T10:00:00Z",
    at_scene_time: "2026-01-01T10:12:00Z",
    patient_contact_time: "2026-01-01T10:13:00Z",
    left_scene_time: "2026-01-01T10:25:00Z",
    in_service_time: "2026-01-01T10:55:00Z",
    chief_complaint: "Chest pain",
    level_of_consciousness: "alert_ox4",
    skin_condition: "pale",
    disposition: "Transported to Destination Without Incident",
    loaded_miles: 12.4,
    wait_time_minutes: 8,
    vitals_json: [
      { timestamp: "2026-01-01T10:14:00Z", bp_systolic: "120", bp_diastolic: "80", pulse: "72", pulse_quality: "strong_regular", respiratory_rate: "16", respiratory_quality: "normal", spo2: "98", gcs_eyes: "4", gcs_verbal: "5", gcs_motor: "6" },
    ],
    airway_json: { status: "Patent and self-maintained", interventions: ["None required"], oxygen_delivery: "Nasal cannula" },
    medications_json: { none_administered: false, entries: [{ name: "Aspirin", dose: "324", dose_unit: "mg", route: "PO (oral)", effect: "Improved", time: "10:15" }] },
    procedures_json: { performed: ["12-lead ECG performed"], patient_response: "Unchanged" },
    narrative: "Patient was <stable> & alert.",
  },
  patient: { first_name: "John", last_name: "Doe", gender: "M", date_of_birth: "1970-05-01" },
};

describe("NEMSIS eRecord exporter", () => {
  it("escapes XML-hostile characters in narratives", () => {
    expect(xmlEscape("a < b & c")).toBe("a &lt; b &amp; c");
  });

  it("renders an eRecord with expected top-level sections", () => {
    const xml = buildERecord(input, ctx);
    for (const tag of [
      "eRecord.SoftwareApplicationGroup", "eResponse", "eTimes", "ePatient", "eExam",
      "eVitals", "eAirway", "eMedications", "eProcedures", "eDisposition",
      "eNarrative", "eCustom",
    ]) {
      expect(xml.includes(`<${tag}`)).toBe(true);
    }
  });

  it("resolves display values to NEMSIS codes", () => {
    const xml = buildERecord(input, ctx);
    // Nasal cannula → 3406003
    expect(xml).toContain("3406003");
    // Aspirin PO route → 3006009
    expect(xml).toContain("3006009");
    // Patient sex M → NEMSIS 9906003
    expect(xml).toContain("9906003");
  });

  it("wraps a PCR in the EMSDataSet/Header/PatientCareReport envelope", () => {
    const xml = buildEmsDataSet(input, ctx);
    expect(xml).toContain("<EMSDataSet");
    expect(xml).toContain("<Header>");
    expect(xml).toContain("<DemographicGroup>");
    // PatientCareReport MUST carry a UUID attribute per NEMSIS 3.5.1
    expect(xml).toMatch(/<PatientCareReport UUID="[0-9a-f-]{36}">/);
  });

  it("includes GA-specific eCustom elements when state is GA", () => {
    const xml = buildERecord(input, ctx);
    expect(xml).toContain("GA-LoadedMiles");
    expect(xml).toContain("GA-WaitTimeMinutes");
    expect(xml).toContain("GA-VendorSoftware");
  });

  it("omits GA eCustom when state is not GA", () => {
    const xml = buildERecord(input, { ...ctx, state: "FL" });
    expect(xml.includes("GA-LoadedMiles")).toBe(false);
  });

  it("emits xsi:nil for missing values instead of empty elements", () => {
    const bare: PcrExportInput = { trip: { id: "x", company_id: "y" }, patient: null };
    const xml = buildERecord(bare, ctx);
    expect(xml).toContain('xsi:nil="true"');
    expect(xml).toContain('NV="7701003"');
  });
});