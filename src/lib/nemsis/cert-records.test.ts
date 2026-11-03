import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCertRecordXml, CertGuardError, isCertificationCompany, type CertCompany } from "./cert-records";
import { DEM1_PROFILE } from "../../../tests/nemsis/fixtures/dem1";
import { EMS1_CTX } from "../../../tests/nemsis/fixtures/ems1";

const CERT: CertCompany = { id: "c1", is_sandbox: true, creator_test_tenant: false, nemsis_certification: true };
const { raw_reference: _r, ...structuredDem } = DEM1_PROFILE;
const demRecord = { id: "r1", company_id: "c1", kind: "DEM", case_key: "DEM1", payload: { ...structuredDem, meta: { note: "x" } } };
const emsRecord = {
  id: "r2", company_id: "c1", kind: "EMS", case_key: "EMS1",
  payload: { input: { trip: { id: "t1", run_date: "2026-01-01" }, patient: null, pcr_uuid: "pcr-1" }, ctx: EMS1_CTX },
};

describe("certification company guard", () => {
  it("allows only sandbox/test companies carrying the certification flag", () => {
    expect(isCertificationCompany(CERT)).toBe(true);
    expect(isCertificationCompany({ ...CERT, is_sandbox: false, creator_test_tenant: true })).toBe(true);
  });
  it.each([
    ["real company with the flag", { ...CERT, is_sandbox: false, creator_test_tenant: false }],
    ["sandbox company without the flag", { ...CERT, nemsis_certification: false }],
    ["archived certification company", { ...CERT, deleted_at: "2026-01-01" }],
    ["missing company", null],
  ])("refuses %s before building XML", (_l, company) => {
    expect(() => buildCertRecordXml(demRecord, company as CertCompany | null)).toThrow(CertGuardError);
  });
  it("refuses a record that belongs to another company", () => {
    expect(() => buildCertRecordXml({ ...demRecord, company_id: "other" }, CERT)).toThrow(CertGuardError);
  });
});

describe("generated XML comes from the stored record, not fixtures", () => {
  it("builds DEM XML from the structured profile with the stamped time", () => {
    const { dataset, xml } = buildCertRecordXml(demRecord, CERT, { timeStamp: "2026-11-03T12:00:00-05:00" });
    expect(dataset).toBe("DEM");
    expect(xml).toContain("<DEMDataSet");
    expect(xml).toContain('timeStamp="2026-11-03T12:00:00-05:00"');
    const fixture = readFileSync("src/lib/nemsis/fixtures/dem1-submission.xml", "utf8");
    expect(xml).not.toBe(fixture);
  });
  it("reflects an edited value in the generated DEM", () => {
    const edited = structuredClone(demRecord);
    (edited.payload.agency as unknown as Record<string, unknown>).name = "Edited Agency Name";
    expect(buildCertRecordXml(edited, CERT).xml).toContain("Edited Agency Name");
  });
  it("builds EMS XML with the record's PCR UUID", () => {
    const { dataset, xml } = buildCertRecordXml(emsRecord, CERT);
    expect(dataset).toBe("EMS");
    expect(xml).toContain('<PatientCareReport UUID="pcr-1">');
  });
  it("refuses raw_reference payloads on both record kinds", () => {
    expect(() => buildCertRecordXml({ ...demRecord, payload: DEM1_PROFILE }, CERT)).toThrow(/raw_reference/);
    const raw = structuredClone(emsRecord);
    (raw.payload.input as Record<string, unknown>).raw_reference = "<EMSDataSet/>";
    expect(() => buildCertRecordXml(raw, CERT)).toThrow(/raw_reference/);
  });
});
