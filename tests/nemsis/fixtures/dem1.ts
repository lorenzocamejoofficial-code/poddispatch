/** Dev-only lossless DEM-1 fixture; fixed certification data only. */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DemographicProfile } from "../../../src/lib/nemsis/exporter";

const REF = join(dirname(fileURLToPath(import.meta.url)), "../reference/live/2026-DEM-1_v351.xml");
export const DEM1_PROFILE: DemographicProfile = {
  raw_reference: readFileSync(REF, "utf8"),
  // Structured fields are unused on the raw path; retained for the existing input contract.
  agency: {
    state_unique_id: "04568", state_license_id: "351-073-92", state: "13",
    service_areas: [], primary_service_type: "9920001", level_of_service: "9917007",
    organization_status: "1016001", organizational_type: "9912007", tax_status: "1018001",
    npis: [], fire_department_ids: [],
  },
  configurations: [],
  software: { creator: "PodDispatch", name: "PodDispatch", version: "1.0" },
};
