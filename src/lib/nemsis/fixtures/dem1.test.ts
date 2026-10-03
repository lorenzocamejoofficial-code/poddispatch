import { describe, it, expect } from "vitest";
import { DEM1_SECTIONS, resolveFacilityField } from "./dem1";

const sec = (n: string) => DEM1_SECTIONS.find((s) => s.name === n)!;
const count = (n: string, code: string) =>
  sec(n).entities.flatMap((e) => e.fields).filter((f) => f.code === code).length;

describe("DEM 1 fixture", () => {
  it("has all sections with expected entity counts", () => {
    expect(DEM1_SECTIONS.map((s) => [s.name, s.entities.length])).toEqual([
      ["dRecord", 1], ["dAgency", 1], ["dContact", 3], ["dConfiguration", 2], ["dLocation", 3],
      ["dVehicle", 5], ["dPersonnel", 5], ["dDevice", 5], ["dFacility", 4],
    ]);
  });
  it("keeps repeating groups", () => {
    expect(count("dAgency", "dAgency.05")).toBe(2);
    expect(count("dAgency", "dAgency.15")).toBe(2);
    expect(sec("dConfiguration").entities[0].fields.filter((f) => f.code === "dConfiguration.06").length).toBe(4);
    expect(sec("dPersonnel").entities[0].fields.filter((f) => f.code === "dPersonnel.22").map((f) => f.value)).toEqual(["Georgia", "South Carolina"]);
    expect(sec("dFacility").entities[1].fields.filter((f) => f.code === "dFacility.02").length).toBe(2);
  });
  it("keeps order", () => {
    const a = sec("dAgency").entities[0].fields;
    expect(a[0].code).toBe("dAgency.01");
    expect(a[8]).toEqual({ code: "dAgency.05", value: "South Carolina" });
    expect(a[a.length - 1].code).toBe("dAgency.27");
  });
  it("resolves facility placeholders", () => {
    expect(resolveFacilityField("LTC10731132", "dFacility.05")).toEqual(["1124386917"]);
    expect(resolveFacilityField("148A01", "dFacility.05")).toEqual([]);
  });
});
