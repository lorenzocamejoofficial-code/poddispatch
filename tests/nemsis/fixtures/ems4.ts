/** Dev-only fixture: NEMSIS 2026 EMS 4 (Seizure) live certification case, emitted
 *  losslessly via raw_reference (only software identity is stamped). No PHI. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExportContext, PcrExportInput } from "../../../src/lib/nemsis/exporter";

const REF = join(dirname(fileURLToPath(import.meta.url)), "../reference/live/2026-EMS-4-Seizure_v351.xml");

export const EMS4_CTX: ExportContext = {
  agency: { npi: null, name: "", state_unique_id: "", state_ems_agency_number: "", state_ems_license_state: "" },
  vehicle: null,
  personnel: [],
  state: "GA",
  test_mode: true,
  software: { name: "Pod Dispatch", version: "1.0" },
  custom_configuration_registered: false,
};

export const EMS4_INPUT: PcrExportInput = { trip: {}, patient: null, raw_reference: readFileSync(REF, "utf8") };
