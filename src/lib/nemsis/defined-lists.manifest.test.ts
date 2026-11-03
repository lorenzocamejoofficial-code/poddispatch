import { describe, expect, it } from "vitest";
import manifest from "./defined-lists.manifest.json";
import { DEM_DEFINED_LISTS } from "./dem-schema.generated";
import { EMS_DEFINED_LISTS } from "./ems-schema.generated";

// The manifest is produced by scripts/nemsis/gen-defined-list-manifest.py, which
// compares every DEM/EMS entry-screen list with the full NEMSIS 3.5.1 XSD enumeration.
describe("NEMSIS defined-list manifest", () => {
  it("records every list as complete against NEMSIS 3.5.1", () => {
    expect(manifest.nemsis_version).toBe("3.5.1.251001CP2");
    expect(manifest.all_complete).toBe(true);
    expect(manifest.partial).toEqual([]);
    for (const l of manifest.lists) expect(l.interface_count, l.list).toBe(l.official_count);
  });

  it("value lists in the screens carry the manifest's full count", () => {
    const all: Record<string, [string, string][]> = { ...DEM_DEFINED_LISTS, ...EMS_DEFINED_LISTS };
    for (const l of manifest.lists) {
      if (l.list.startsWith("NV:") || l.list.startsWith("PN:") || !all[l.list]) continue;
      expect(new Set(all[l.list].map(([v]) => v)).size, l.list).toBe(l.official_count);
    }
  });

  it("CodeType unions offer every member code system", () => {
    const codes = DEM_DEFINED_LISTS["CodeType.RxNorm+CodeType.SNOMED"].map(([v]) => v);
    expect(codes).toEqual(expect.arrayContaining(["9924003", "9924005"]));
  });
});
