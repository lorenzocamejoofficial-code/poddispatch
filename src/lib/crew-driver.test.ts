import { describe, it, expect } from "vitest";
import { evaluateCrewComposition } from "./crew-composition";
import { deriveDriver } from "./derive-driver";

const m = (id: string, name: string, cert: any) => ({ id, full_name: name, cert_level: cert });

describe("evaluateCrewComposition (driver no longer required)", () => {
  it("is valid with two members and no driver designated", () => {
    const r = evaluateCrewComposition([m("1", "A", "EMT-B"), m("2", "B", "EMR")]);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("rejects two EMRs", () => {
    const r = evaluateCrewComposition([m("1", "A", "EMR"), m("2", "B", "EMR")]);
    expect(r.valid).toBe(false);
    expect(r.errors.join(" ")).toMatch(/no certified attendant/i);
  });

  it("rejects a crew with no certified attendant", () => {
    const r = evaluateCrewComposition([m("1", "A", null), m("2", "B", "EMR")]);
    expect(r.valid).toBe(false);
  });

  it("ignores the third member entirely — a paramedic trainee cannot make the crew ALS or valid", () => {
    // Third member is never passed in; capability comes from primaries only.
    const r = evaluateCrewComposition([m("1", "A", "EMT-B"), m("2", "B", "EMT-B")]);
    expect(r.crewCapability).toBe("BLS");
  });
});

describe("deriveDriver", () => {
  const roster = {
    member1: { id: "1", name: "Ann" },
    member2: { id: "2", name: "Ben" },
    member3: null,
    member3Role: null,
  };

  it("2-person crew: the non-attending primary drives", () => {
    expect(deriveDriver(roster, "1")).toMatchObject({ id: "2", name: "Ben", source: "not_attending_medic" });
  });

  it("returns 'not yet determined' before a PCR names an attending medic", () => {
    const d = deriveDriver(roster, null);
    expect(d.id).toBeNull();
    expect(d.label).toBe("Not yet determined");
  });

  it("explicit driver-role third member wins", () => {
    const d = deriveDriver(
      { ...roster, member3: { id: "3", name: "Cid" }, member3Role: "driver" },
      "1",
    );
    expect(d).toMatchObject({ id: "3", source: "member3_role" });
  });

  it("trainee third member never becomes the driver by default", () => {
    const d = deriveDriver(
      { ...roster, member3: { id: "3", name: "Cid" }, member3Role: "trainee" },
      "1",
    );
    expect(d.id).toBe("2");
  });
});
