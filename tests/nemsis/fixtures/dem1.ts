/**
 * Dev-only fixture: the NEMSIS 2026 DEM 1 test agency's demographic profile,
 * as structured data for buildDemDataSet(). Scalar values are transcribed;
 * the long code lists (tracts, ZIPs, SNOMED/RxNorm codes, protocols, call
 * signs) are extracted from the official reference XML when this module loads.
 * No tenant data, no PHI.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DemographicProfile, ConfigurationMedication } from "../../../src/lib/nemsis/exporter";

const REF = join(dirname(fileURLToPath(import.meta.url)), "../reference/2026-DEM-1_v351.xml");
const xml = readFileSync(REF, "utf8").replace(/<!--[\s\S]*?-->/g, "");

/** Inner XML of every <tag ...>...</tag> occurrence, in order. */
function blocks(src: string, tag: string): string[] {
  const re = new RegExp(`<${tag.replace(/\./g, "\\.")}\\b[^>]*>([\\s\\S]*?)</${tag.replace(/\./g, "\\.")}>`, "g");
  return [...src.matchAll(re)].map((m) => m[1]);
}
function values(src: string, tag: string): string[] {
  return blocks(src, tag).map((v) => v.trim());
}
function meds(src: string): ConfigurationMedication[] {
  return [...src.matchAll(/<dConfiguration\.09\b([^>]*)>([\s\S]*?)<\/dConfiguration\.09>/g)].map((m) => {
    const ct = m[1].match(/CodeType="([^"]*)"/)?.[1];
    return ct ? { code: m[2].trim(), code_type: ct } : { code: m[2].trim() };
  });
}

const areas = blocks(xml, "dAgency.AgencyServiceGroup");
const configs = blocks(xml, "dConfiguration.ConfigurationGroup");
const cfgLists = configs.map((c) => ({
  procs: blocks(c, "dConfiguration.ProcedureGroup").map((p) => values(p, "dConfiguration.07")),
  meds: blocks(c, "dConfiguration.MedicationGroup").map(meds),
  protocols: values(c, "dConfiguration.10"),
  callSigns: values(c, "dConfiguration.16"),
}));

export const DEM1_PROFILE: DemographicProfile = {
  agency: {
    state_unique_id: "11261",
    state_license_id: "351-11261",
    state: "10",
    service_areas: [
      { state: "10", counties: ["10001"], census_tracts: values(areas[0], "dAgency.07"), zip_codes: values(areas[0], "dAgency.08") },
      { state: "24", counties: ["24011", "24035"], census_tracts: values(areas[1], "dAgency.07"), zip_codes: values(areas[1], "dAgency.08") },
    ],
    primary_service_type: "9920001",
    level_of_service: "9917007",
    organization_status: "1016001",
    organizational_type: "9912007",
    tax_status: "1018001",
    npis: ["1801884507"],
    fire_department_ids: [{ nv: "7701001" }],
  },
  configurations: [
    {
      state: "10",
      procedure_groups: [
        { certification_level: "9917005", procedures: cfgLists[0].procs[0] },
        { certification_level: "9917007", procedures: cfgLists[0].procs[1] },
        { certification_level: "9917031", procedures: cfgLists[0].procs[2] },
      ],
      medication_groups: [
        { certification_level: "9917005", medications: cfgLists[0].meds[0] },
        { certification_level: "9917007", medications: cfgLists[0].meds[1] },
        { certification_level: "9917031", medications: cfgLists[0].meds[2] },
      ],
      protocols: cfgLists[0].protocols,
      emd_provided: "1213003",
      call_signs: cfgLists[0].callSigns,
    },
    {
      state: "24",
      procedure_groups: [
        { certification_level: "9917005", procedures: cfgLists[1].procs[0] },
        { certification_level: "9917007", procedures: cfgLists[1].procs[1] },
      ],
      medication_groups: [
        { certification_level: "9917005", medications: cfgLists[1].meds[0] },
        { certification_level: "9917007", medications: cfgLists[1].meds[1] },
      ],
      protocols: cfgLists[1].protocols,
      emd_provided: "1213005",
      call_signs: cfgLists[1].callSigns,
    },
  ],
  software: { creator: "Pod Dispatch", name: "Pod Dispatch", version: "1.0" },
};
