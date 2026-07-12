/**
 * NEMSIS 3.5.1 validation harness.
 *
 *  1. Build EMSDataSet XML for a synthetic Pod Dispatch trip
 *  2. Validate the output against the real NEMSIS XSD via xmllint
 *  3. Print the delta so we can fix remaining gaps
 *
 * Run: bun scripts/nemsis-validate.ts
 * Requires: /tmp/nemsis-xsd populated with 3.5.1.251001CP2 XSDs and xmllint in PATH.
 */
import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { buildEmsDataSet, type ExportContext, type PcrExportInput } from "../src/lib/nemsis/exporter";

const ctx: ExportContext = {
  agency: {
    npi: "1234567893",
    name: "Pod Dispatch Sample Agency",
    state_ems_agency_number: "351-11261",
    state_ems_license_state: "GA",
  },
  vehicle: { vehicle_id: "T-17", unit_number: "17", vin: "1FDW01", license_plate: "GA-777" },
  personnel: [
    { crew_member_id: "E23560", full_name: "Jane Medic", state_license_number: "P12345", certification_level: "2403001" },
    { crew_member_id: "E23561", full_name: "John Basic", state_license_number: "E67890", certification_level: "2403003" },
  ],
  state: "GA",
  test_mode: true,
  software: { name: "Pod Dispatch", version: "3.5.1" },
};

const input: PcrExportInput = {
  trip: {
    id: "2026-EMS-1-Sample",
    company_id: "351-11261",
    company_name: "Pod Dispatch Sample Agency",
    service_level: "2205005",
    incident_number: "351-25844",
    run_number: "351-25844-1",
    unit_number: "17",
    shift: "A",
    psap_call_time: "2026-01-01T09:59:00Z",
    dispatch_notified_time: "2026-01-01T09:59:30Z",
    dispatch_time: "2026-01-01T10:00:00Z",
    unit_enroute_time: "2026-01-01T10:01:00Z",
    at_scene_time: "2026-01-01T10:12:00Z",
    patient_contact_time: "2026-01-01T10:13:00Z",
    left_scene_time: "2026-01-01T10:25:00Z",
    arrived_at_destination_time: "2026-01-01T10:45:00Z",
    in_service_time: "2026-01-01T10:55:00Z",
    scene_address: "1 Main St",
    scene_city: "Dover",
    scene_state: "GA",
    scene_zip: "30301",
    scene_county: "Fulton",
    dispatch_complaint: "2301071",
    chief_complaint: "Shortness of breath",
    level_of_consciousness: "alert_ox4",
    skin_condition: "pale",
    disposition: "Transported to Destination Without Incident",
    destination_name: "General Hospital",
    destination_address: "500 Hospital Rd",
    destination_city: "Atlanta",
    destination_state: "GA",
    destination_zip: "30303",
    destination_type: "4821017",
    level_of_care: "4216003",
    evaluation_care: "4217005",
    transferred_care_to: "4228015",
    patient_condition_at_destination: "4227005",
    loaded_miles: 12.4,
    wait_time_minutes: 8,
    vitals_json: [
      { timestamp: "2026-01-01T10:14:00Z", bp_systolic: "120", bp_diastolic: "80", pulse: "72", pulse_quality: "strong_regular", respiratory_rate: "16", respiratory_quality: "normal", spo2: "98", gcs_eyes: "4", gcs_verbal: "5", gcs_motor: "6" },
    ],
    airway_json: { status: "Patent and self-maintained", interventions: ["None required"], oxygen_delivery: "Nasal cannula" },
    medications_json: { none_administered: true },
    procedures_json: { performed: [] },
    narrative: "Routine interfacility transfer completed without incident.",
  },
  patient: { first_name: "John", last_name: "Doe", gender: "M", date_of_birth: "1970-05-01" },
};

mkdirSync("/tmp/nemsis-out", { recursive: true });
const xml = buildEmsDataSet(input, ctx);
const outPath = "/tmp/nemsis-out/pod-dispatch-sample.xml";
writeFileSync(outPath, xml);
console.log(`wrote ${outPath} (${xml.length} bytes)`);

const result = spawnSync(
  "xmllint",
  ["--noout", "--schema", "/tmp/nemsis-xsd/EMSDataSet_v3.xsd", outPath],
  { encoding: "utf8" },
);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
