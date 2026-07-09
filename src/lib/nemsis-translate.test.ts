import { describe, it, expect } from "vitest";
import { E_OXYGEN_DELIVERY, E_AIRWAY_STATUS } from "@/lib/nemsis-code-sets";
import { toDisplay, toCode, toPair, isNemsisMapped } from "@/lib/nemsis-translate";

describe("nemsis-translate", () => {
  describe("toDisplay — billing readers must get the same string from code OR legacy display", () => {
    it("resolves a NEMSIS code to its display", () => {
      expect(toDisplay(E_OXYGEN_DELIVERY, "3406003")).toBe("Nasal cannula");
    });
    it("passes through a matching legacy display unchanged", () => {
      expect(toDisplay(E_OXYGEN_DELIVERY, "Nasal cannula")).toBe("Nasal cannula");
    });
    it("is case-insensitive on legacy displays (backfill safety)", () => {
      expect(toDisplay(E_OXYGEN_DELIVERY, "nasal cannula")).toBe("Nasal cannula");
    });
    it("returns unmapped free-text as-is so historical PCRs render", () => {
      expect(toDisplay(E_OXYGEN_DELIVERY, "Some odd device")).toBe("Some odd device");
    });
    it("returns null for empty/null", () => {
      expect(toDisplay(E_OXYGEN_DELIVERY, null)).toBeNull();
      expect(toDisplay(E_OXYGEN_DELIVERY, "")).toBeNull();
      expect(toDisplay(E_OXYGEN_DELIVERY, "   ")).toBeNull();
    });
  });

  describe("toCode — future NEMSIS export must resolve either form to a code", () => {
    it("resolves a legacy display to its NEMSIS code", () => {
      expect(toCode(E_OXYGEN_DELIVERY, "Non-rebreather mask")).toBe("3406007");
    });
    it("passes a NEMSIS code through unchanged", () => {
      expect(toCode(E_OXYGEN_DELIVERY, "3406007")).toBe("3406007");
    });
    it("returns null for unmapped free-text (so export can flag it)", () => {
      expect(toCode(E_OXYGEN_DELIVERY, "Some odd device")).toBeNull();
    });
  });

  describe("round-trip invariant — the property billing depends on", () => {
    it("toDisplay(code) === toDisplay(display) for every entry in every code set", () => {
      for (const set of [E_OXYGEN_DELIVERY, E_AIRWAY_STATUS]) {
        for (const entry of set) {
          expect(toDisplay(set, entry.code)).toBe(toDisplay(set, entry.display));
        }
      }
    });
  });

  describe("toPair + isNemsisMapped", () => {
    it("toPair returns both halves for a mapped value", () => {
      expect(toPair(E_OXYGEN_DELIVERY, "3406003")).toEqual({ code: "3406003", display: "Nasal cannula" });
      expect(toPair(E_OXYGEN_DELIVERY, "Nasal cannula")).toEqual({ code: "3406003", display: "Nasal cannula" });
    });
    it("toPair returns null code and pass-through display for unmapped", () => {
      expect(toPair(E_OXYGEN_DELIVERY, "Some odd device")).toEqual({ code: null, display: "Some odd device" });
    });
    it("isNemsisMapped is true for both forms, false for free-text", () => {
      expect(isNemsisMapped(E_OXYGEN_DELIVERY, "3406003")).toBe(true);
      expect(isNemsisMapped(E_OXYGEN_DELIVERY, "Nasal cannula")).toBe(true);
      expect(isNemsisMapped(E_OXYGEN_DELIVERY, "Some odd device")).toBe(false);
    });
  });
});