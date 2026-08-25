import { describe, it, expect } from "vitest";
import {
  evaluateClaimReadiness,
  evaluatePcsWindow,
  evaluateRsnatAuth,
  PCS_VALIDITY_DAYS,
} from "@/lib/claim-readiness";

const baseClaim = {
  id: "claim-1",
  trip_id: "trip-1",
  patient_id: "pat-1",
  patient_name: "Doe, John",
  patient_dob: "1950-04-02",
  patient_sex: "M",
  patient_address: "100 Main St",
  patient_city: "Atlanta",
  patient_zip: "30301",
  member_id: "A123456789",
  payer_name: "MEDICARE",
  payer_type: "medicare",
  run_date: "2026-03-01",
  total_charge: 450,
  hcpcs_codes: ["A0428"],
  icd10_codes: ["N18.6", "Z99.2"],
  origin_type: "residence",
  destination_type: "dialysis",
  origin_zip: "30301",
};

const DIALYSIS_TRANSPORT = { destination_facility_type: "dialysis" };

const blockersFor = (patient: any, claimOverrides: any = {}) =>
  evaluateClaimReadiness({
    claim: { ...baseClaim, ...claimOverrides } as any,
    patient,
    transport: DIALYSIS_TRANSPORT,
  } as any).filter((i) => i.severity === "block");

const fieldSet = (issues: { field: string }[]) => new Set(issues.map((i) => i.field));

describe("evaluatePcsWindow", () => {
  it("accepts a PCS signed inside the 60-day window", () => {
    const r = evaluatePcsWindow({ patientSignedDate: "2026-02-01", runDate: "2026-03-01" });
    expect(r.status).toBe("ok");
    expect(r.ageDays).toBe(28);
  });

  it("accepts a PCS signed exactly 60 days before the DOS", () => {
    const r = evaluatePcsWindow({ patientSignedDate: "2026-01-01", runDate: "2026-03-02" });
    expect(r.ageDays).toBe(PCS_VALIDITY_DAYS);
    expect(r.status).toBe("ok");
  });

  it("expires a PCS signed 61 days before the DOS", () => {
    const r = evaluatePcsWindow({ patientSignedDate: "2026-01-01", runDate: "2026-03-03" });
    expect(r.status).toBe("expired");
  });

  it("rejects a PCS dated after the transport", () => {
    const r = evaluatePcsWindow({ patientSignedDate: "2026-03-05", runDate: "2026-03-01" });
    expect(r.status).toBe("signed_after_dos");
  });

  it("uses the claim-specific certification instead of a newer chart renewal", () => {
    const r = evaluatePcsWindow({
      patientSignedDate: "2026-03-15",
      billerCertificationDate: "2026-02-15",
      runDate: "2026-03-01",
    });
    expect(r.referenceSignedDate).toBe("2026-02-15");
    expect(r.status).toBe("ok");
  });

  it("does not apply a renewed chart PCS expiration to a claim-specific PCS", () => {
    const r = evaluatePcsWindow({
      patientSignedDate: "2026-03-15",
      patientExpirationDate: "2026-03-20",
      billerCertificationDate: "2026-02-15",
      runDate: "2026-03-25",
    });
    expect(r.referenceSignedDate).toBe("2026-02-15");
    expect(r.validThrough).toBe("2026-04-16");
    expect(r.status).toBe("ok");
  });

  it("honors an earlier explicit chart expiration date", () => {
    const r = evaluatePcsWindow({
      patientSignedDate: "2026-02-01",
      patientExpirationDate: "2026-02-20",
      runDate: "2026-03-01",
    });
    expect(r.status).toBe("expired");
  });
});

describe("PCS 60-day enforcement in claim readiness", () => {
  it("blocks submission when the PCS is stale", () => {
    const issues = blockersFor({ pcs_on_file: true, pcs_signed_date: "2025-11-01", prior_auth_utn: "UTN1" });
    expect(fieldSet(issues).has("pcs_certification_date")).toBe(true);
  });

  it("does not block when the PCS is current", () => {
    const issues = blockersFor({ pcs_on_file: true, pcs_signed_date: "2026-02-10", prior_auth_utn: "UTN1" });
    expect(fieldSet(issues).has("pcs_certification_date")).toBe(false);
  });

  it("does not block an older trip when the patient chart has since been renewed", () => {
    const issues = blockersFor(
      { pcs_on_file: true, pcs_signed_date: "2026-03-15", prior_auth_utn: "UTN1" },
      { pcs_on_file: true, pcs_certification_date: "2026-02-15" },
    );
    expect(fieldSet(issues).has("pcs_certification_date")).toBe(false);
  });

  it("does not fire at all when PCS is not asserted for the claim", () => {
    const issues = blockersFor({ pcs_on_file: false, pcs_signed_date: "2020-01-01", prior_auth_utn: "UTN1" });
    expect(fieldSet(issues).has("pcs_certification_date")).toBe(false);
  });

  it("still blocks when PCS is asserted but no signature date exists anywhere", () => {
    const issues = blockersFor({ pcs_on_file: true, prior_auth_utn: "UTN1" });
    expect(fieldSet(issues).has("pcs_certification_date")).toBe(true);
  });
});

describe("evaluateRsnatAuth", () => {
  it("flags a missing UTN", () => {
    expect(evaluateRsnatAuth({ runDate: "2026-03-01" }).status).toBe("missing");
  });

  it("flags an authorization that ended before the DOS", () => {
    expect(
      evaluateRsnatAuth({ utn: "UTN1", periodEnd: "2026-02-01", runDate: "2026-03-01" }).status,
    ).toBe("expired");
  });

  it("flags an authorization that has not started yet", () => {
    expect(
      evaluateRsnatAuth({ utn: "UTN1", periodStart: "2026-04-01", runDate: "2026-03-01" }).status,
    ).toBe("not_yet_effective");
  });

  it("accepts a DOS inside the authorized period", () => {
    const r = evaluateRsnatAuth({
      utn: "UTN1",
      periodStart: "2026-01-01",
      periodEnd: "2026-06-01",
      runDate: "2026-03-01",
    });
    expect(r.status).toBe("ok");
    expect(r.daysToExpiry).toBe(92);
  });
});

describe("RSNAT enforcement in claim readiness", () => {
  const currentPcs = { pcs_on_file: true, pcs_signed_date: "2026-02-10" };

  it("blocks a Medicare dialysis run with no UTN", () => {
    const issues = blockersFor({ ...currentPcs });
    expect(fieldSet(issues).has("prior_auth_utn")).toBe(true);
  });

  it("blocks when the auth window does not cover the date of service", () => {
    const issues = blockersFor({
      ...currentPcs,
      prior_auth_utn: "UTN1",
      prior_auth_period_start: "2026-05-01",
      prior_auth_period_end: "2026-08-01",
    });
    expect(fieldSet(issues).has("prior_auth_utn")).toBe(true);
  });

  it("clears when the auth covers the date of service", () => {
    const issues = blockersFor({
      ...currentPcs,
      prior_auth_utn: "UTN1",
      prior_auth_period_start: "2026-01-01",
      prior_auth_period_end: "2026-06-01",
    });
    expect(fieldSet(issues).has("prior_auth_utn")).toBe(false);
  });

  it("warns (does not block) when the auth expires within 14 days", () => {
    const all = evaluateClaimReadiness({
      claim: baseClaim as any,
      transport: DIALYSIS_TRANSPORT,
      patient: {
        ...currentPcs,
        prior_auth_utn: "UTN1",
        prior_auth_period_start: "2026-01-01",
        prior_auth_period_end: "2026-03-10",
      },
    });
    const auth = all.filter((i) => i.field === "prior_auth_utn");
    expect(auth).toHaveLength(1);
    expect(auth[0].severity).toBe("warn");
  });

  it("does not fire RSNAT for a non-Medicare dialysis run", () => {
    const issues = blockersFor(
      { ...currentPcs },
      { payer_type: "commercial", payer_name: "AETNA" },
    );
    expect(fieldSet(issues).has("prior_auth_utn")).toBe(false);
  });
});
