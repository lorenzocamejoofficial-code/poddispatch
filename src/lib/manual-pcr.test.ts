import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { validateManualPcrSetup, legacyTripTypeForKind, type ManualPcrSetup } from "./manual-pcr";
import { buildTripInsert } from "./pcr-trip-insert";

const base: ManualPcrSetup = {
  patientId: "p1", transportKind: "ift", runDate: "2026-11-05", pickupTime: "09:00", legType: "A",
  truckId: "t1", existingCrewId: "c1", member1Id: "", member2Id: "",
  pickupLocation: "Home", destinationLocation: "Hospital", serviceLevel: "BLS",
};
const ctx = { today: "2026-11-05", patientIcd10: [] as string[], truckOutOfService: false };

describe("validateManualPcrSetup", () => {
  it("accepts a complete setup", () => {
    expect(validateManualPcrSetup(base, ctx)).toEqual({});
  });
  it("blocks dialysis without a patient ICD-10 code", () => {
    expect(validateManualPcrSetup({ ...base, transportKind: "dialysis" }, ctx).icd10).toBeTruthy();
    expect(validateManualPcrSetup({ ...base, transportKind: "dialysis" }, { ...ctx, patientIcd10: ["N18.6"] }).icd10).toBeUndefined();
  });
  it("allows up to 7 days back, not 8, and no future dates", () => {
    expect(validateManualPcrSetup({ ...base, runDate: "2026-10-29" }, ctx).runDate).toBeUndefined();
    expect(validateManualPcrSetup({ ...base, runDate: "2026-10-28" }, ctx).runDate).toBeTruthy();
    expect(validateManualPcrSetup({ ...base, runDate: "2026-11-06" }, ctx).runDate).toBeTruthy();
  });
  it("blocks an out-of-service truck", () => {
    expect(validateManualPcrSetup(base, { ...ctx, truckOutOfService: true }).truckId).toBeTruthy();
  });
  it("requires two different crew members when the truck has no crew that day", () => {
    const s = { ...base, existingCrewId: null };
    const e = validateManualPcrSetup(s, ctx);
    expect(e.member1Id).toBeTruthy();
    expect(e.member2Id).toBeTruthy();
    expect(validateManualPcrSetup({ ...s, member1Id: "a", member2Id: "a" }, ctx).member2Id).toBeTruthy();
    expect(validateManualPcrSetup({ ...s, member1Id: "a", member2Id: "b" }, ctx)).toEqual({});
  });
});

describe("transport type mapping", () => {
  it("maps psych to the legacy psych_transport value", () => {
    expect(legacyTripTypeForKind("psych")).toBe("psych_transport");
    expect(legacyTripTypeForKind("dialysis")).toBe("dialysis");
  });
});

describe("buildTripInsert", () => {
  const tb = {
    leg_id: "l", truck_id: "t", crew_id: "c", company_id: "co", patient_id: "p", run_date: "2026-11-05",
    pickup_location: "a", destination_location: "b", scheduled_pickup_time: "09:00", trip_type: "wound_care",
    origin_type: "Residence", destination_type: "Healthcare Facility", service_level: "BLS", is_unscheduled: true,
  };
  it("mirrors trip_type into pcr_type and starts not_started/scheduled", () => {
    const r = buildTripInsert(tb, null);
    expect(r.pcr_type).toBe("wound_care");
    expect(r.pcr_status).toBe("not_started");
    expect(r.status).toBe("scheduled");
  });
  it("copies patient defaults, wound stage only for wound care", () => {
    const pd = { icd10_codes: ["L89.1"], default_wound_stage: "2", default_bh_authorization_type: "1013" };
    const r = buildTripInsert(tb, pd);
    expect(r.icd10_codes).toEqual(["L89.1"]);
    expect(r.wound_stage).toBe("2");
    expect(r.bh_authorization_type).toBeUndefined();
    expect(buildTripInsert({ ...tb, trip_type: "ift" }, pd).wound_stage).toBeUndefined();
  });
});
