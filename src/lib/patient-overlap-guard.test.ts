import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
const migration = readFileSync("drizzle/migrations/0022_qualify_overlap_guard_bounds.sql", "utf8");
describe("patient overlap concurrency and tenancy guard", () => {
  it("serializes same company/patient writes before reading occupied windows", () => {
    const lock = migration.indexOf("PERFORM pg_advisory_xact_lock(hashtextextended(company::text||':'||patient::text,0))");
    expect(lock).toBeGreaterThan(0);
    expect(lock).toBeLessThan(migration.indexOf("public.patient_transport_windows(company,patient,day)"));
    expect(migration).toContain("ALTER FUNCTION public.patient_transport_windows(uuid,uuid,date) VOLATILE");
  });
  it("uses strict overlap boundaries and excludes the edited record and its leg", () => {
    expect(migration).toContain("w.start_at<target_end AND target_start<w.end_at");
    expect(migration).toContain("w.trip_id IS DISTINCT FROM ignore_trip");
    expect(migration).toContain("w.leg_id IS DISTINCT FROM ignore_leg");
    expect(migration).toContain("p.id=patient AND p.company_id=company");
  });
});
