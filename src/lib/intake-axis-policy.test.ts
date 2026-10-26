import { describe, it, expect } from "vitest";
import { intakeAxes, legacyIntakeTransport, missingIntakeFields } from "@/lib/intake-axis-policy";
import { PAYER_CLASSES, type PayerClass } from "@/lib/payer-class";
import { TRANSPORT_KINDS, type TransportKind } from "@/lib/transport-vocabulary";

const INSURED: PayerClass[] = ["medicare", "medicaid", "commercial"];
const UNINSURED: PayerClass[] = ["self_pay", "facility"];
const VALID_NPI = "1000000004"; // Luhn-valid

/** Fully-filled recurring form for a given kind/payer — should produce zero issues. */
function completeRecurring(kind: TransportKind, payer: PayerClass): Record<string, any> {
  return {
    transport_type: legacyIntakeTransport(kind),
    primary_payer: payer,
    first_name: "Jane", last_name: "Doe", dob: "1950-01-01", sex: "F",
    member_id: "M123", pickup_address: "1 Main St, Atlanta, GA 30301",
    default_chief_complaint: "Routine", default_primary_impression: "Stable",
    icd10_codes: ["Z99.2"], mobility: "wheelchair",
    pcs_on_file: true, pcs_physician_npi: VALID_NPI, prior_auth_utn: "UTN123",
    default_medical_necessity_reason: "Cannot sit safely",
    default_wound_type: "Pressure ulcer", default_wound_location: "Sacrum", default_wound_stage: "Stage 2",
    dropoff_facility: "Dialysis Center", schedule_days: "MWF", recurrence_days: ["Mon"],
    chair_time: "08:00",
    default_bh_authorization_type: "Voluntary", default_bh_authorizing_facility: "Psych Facility",
  };
}

/** Fully-filled one-off form for a given kind/payer — should produce zero issues. */
function completeOneoff(kind: TransportKind, payer: PayerClass): Record<string, any> {
  return {
    trip_type: legacyIntakeTransport(kind),
    primary_payer: payer,
    name: "Jane Doe", dob: "1950-01-01", sex: "F",
    pickup_location: "1 Main St, Atlanta, GA 30301", destination_location: "2 Oak Ave, Atlanta, GA 30302",
    pickup_location_type: "residence", destination_type: "facility",
    member_id: "M123", chair_time: "08:00", sending_facility_name: "Sending Hospital",
    wound_type: "Pressure ulcer", wound_location: "Sacrum", wound_stage: "Stage 2",
    bh_authorization_type: "Voluntary", bh_authorizing_facility: "Psych Facility", bh_1013_received: true,
  };
}

const fields = (issues: { field: string }[]) => issues.map(i => i.field);

// Kind-specific fields per mode: field -> kinds that require it.
const RECURRING_KIND_FIELDS: [string, TransportKind[]][] = [
  ["schedule_days", ["dialysis"]],
  ["chair_time", ["dialysis", "outpatient"]],
  ["default_wound_type", ["wound_care"]],
  ["default_wound_location", ["wound_care"]],
  ["default_wound_stage", ["wound_care"]],
  ["default_bh_authorization_type", ["psych"]],
  ["default_bh_authorizing_facility", ["psych"]],
];
const ONEOFF_KIND_FIELDS: [string, TransportKind[]][] = [
  ["chair_time", ["dialysis", "outpatient"]],
  ["sending_facility_name", ["ift", "discharge"]],
  ["wound_type", ["wound_care"]],
  ["wound_location", ["wound_care"]],
  ["wound_stage", ["wound_care"]],
  ["bh_authorization_type", ["psych"]],
  ["bh_authorizing_facility", ["psych"]],
];
const ALL_KIND_FIELDS = [...new Set([...RECURRING_KIND_FIELDS, ...ONEOFF_KIND_FIELDS].map(([f]) => f))];
const INSURANCE_FIELDS = ["member_id", "pcs_physician_npi", "prior_auth_utn"];

describe("legacyIntakeTransport", () => {
  it("maps psych to the legacy psych_transport spelling", () => {
    expect(legacyIntakeTransport("psych")).toBe("psych_transport");
  });
  it("maps the other five kinds to themselves", () => {
    for (const k of TRANSPORT_KINDS.filter(k => k !== "psych")) {
      expect(legacyIntakeTransport(k)).toBe(k);
    }
  });
});

describe("intakeAxes insurance flag", () => {
  it("is true for the three insured classes", () => {
    for (const p of INSURED) expect(intakeAxes("dialysis", p).insurance).toBe(true);
  });
  it("is false for self_pay and facility", () => {
    for (const p of UNINSURED) expect(intakeAxes("dialysis", p).insurance).toBe(false);
  });
});

describe("missingIntakeFields — 30-combination matrix, both modes", () => {
  for (const kind of TRANSPORT_KINDS) {
    for (const payer of PAYER_CLASSES) {
      it(`complete ${kind}/${payer} form has no issues (recurring + oneoff)`, () => {
        expect(missingIntakeFields(completeRecurring(kind, payer), "recurring")).toEqual([]);
        expect(missingIntakeFields(completeOneoff(kind, payer), "oneoff")).toEqual([]);
      });
    }
  }
});

describe("missingIntakeFields — insurance fields gated by payer class", () => {
  for (const mode of ["recurring", "oneoff"] as const) {
    const build = mode === "recurring" ? completeRecurring : completeOneoff;
    for (const payer of UNINSURED) {
      it(`${mode}: ${payer} never reports insurance fields missing, even blank`, () => {
        const form = build("dialysis", payer);
        form.member_id = ""; form.pcs_physician_npi = ""; form.prior_auth_utn = "";
        const got = fields(missingIntakeFields(form, mode));
        for (const f of INSURANCE_FIELDS) expect(got).not.toContain(f);
      });
    }
    for (const payer of INSURED) {
      it(`${mode}: ${payer} reports member_id missing when blank`, () => {
        const form = build("dialysis", payer);
        form.member_id = "";
        expect(fields(missingIntakeFields(form, mode))).toContain("member_id");
      });
    }
  }
});

describe("missingIntakeFields — kind-specific fields required only for their kind", () => {
  for (const mode of ["recurring", "oneoff"] as const) {
    const build = mode === "recurring" ? completeRecurring : completeOneoff;
    const kindFields = mode === "recurring" ? RECURRING_KIND_FIELDS : ONEOFF_KIND_FIELDS;
    for (const kind of TRANSPORT_KINDS) {
      it(`${mode}: ${kind} requires exactly its own kind-specific fields`, () => {
        const form = build(kind, "medicare");
        for (const f of ALL_KIND_FIELDS) form[f] = ""; // blank every kind-specific field
        const got = fields(missingIntakeFields(form, mode));
        for (const [field, kinds] of kindFields) {
          if (kinds.includes(kind)) expect(got).toContain(field);
          else expect(got).not.toContain(field);
        }
      });
    }
  }
});

describe("missingIntakeFields — switching a selector drops the old kind's issues", () => {
  it("recurring: wound fields blank but kind=dialysis → no wound issues", () => {
    const form = completeRecurring("dialysis", "medicare");
    form.default_wound_type = ""; form.default_wound_location = ""; form.default_wound_stage = "";
    const got = fields(missingIntakeFields(form, "recurring"));
    expect(got).not.toContain("default_wound_type");
    expect(got).not.toContain("default_wound_location");
    expect(got).not.toContain("default_wound_stage");
  });
  it("oneoff: psych auth fields blank but kind=outpatient → no psych issues", () => {
    const form = completeOneoff("outpatient", "medicare");
    form.bh_authorization_type = ""; form.bh_authorizing_facility = "";
    const got = fields(missingIntakeFields(form, "oneoff"));
    expect(got).not.toContain("bh_authorization_type");
    expect(got).not.toContain("bh_authorizing_facility");
  });
  it("oneoff: sending facility blank but kind=wound_care → not required", () => {
    const form = completeOneoff("wound_care", "medicare");
    form.sending_facility_name = "";
    expect(fields(missingIntakeFields(form, "oneoff"))).not.toContain("sending_facility_name");
  });
});

describe("missingIntakeFields — hidden fields never emit issues", () => {
  it("recurring: self_pay hides member_id/pcs/prior_auth — blank values produce no issues", () => {
    const form = completeRecurring("dialysis", "self_pay");
    form.member_id = ""; form.pcs_on_file = false; form.pcs_physician_npi = ""; form.prior_auth_utn = "";
    expect(missingIntakeFields(form, "recurring")).toEqual([]);
  });
  it("recurring: non-dialysis kinds hide schedule_days — blank value produces no issue", () => {
    const form = completeRecurring("outpatient", "medicare");
    form.schedule_days = "";
    expect(fields(missingIntakeFields(form, "recurring"))).not.toContain("schedule_days");
  });
  it("oneoff: facility payer hides member_id — blank value produces no issue", () => {
    const form = completeOneoff("discharge", "facility");
    form.member_id = "";
    expect(missingIntakeFields(form, "oneoff")).toEqual([]);
  });
  it("oneoff: non-wound kinds hide wound fields — blank values produce no issues", () => {
    const form = completeOneoff("ift", "medicare");
    form.wound_type = ""; form.wound_location = ""; form.wound_stage = "";
    expect(missingIntakeFields(form, "oneoff")).toEqual([]);
  });
});
