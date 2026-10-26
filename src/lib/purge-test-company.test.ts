import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isPurgeableTestTenant } from "../../supabase/functions/_shared/test-tenant";

const migration = readFileSync("drizzle/migrations/0005_purge_test_company.sql", "utf8");
const listed = new Set(
  [...(migration.match(/_tables text\[\] := ARRAY\[([\s\S]*?)\];/)?.[1] ?? "").matchAll(/'([a-z_]+)'/g)].map((m) => m[1]),
);
const hasDb = !!process.env.PGHOST;
const psql = (q: string) =>
  execSync(`psql -At -c "${q}"`, { encoding: "utf8" }).trim().split("\n").filter(Boolean);

describe("purge_test_company FK coverage guard", () => {
  it.skipIf(!hasDb)("every RESTRICT/NO ACTION FK to companies(id) is purged", () => {
    const tables = psql(
      "select distinct conrelid::regclass::text from pg_constraint where contype='f' and confrelid='public.companies'::regclass and confdeltype in ('a','r')",
    ).map((t) => t.replace(/^public\./, ""));
    expect(tables.length).toBeGreaterThan(50);
    expect(tables.filter((t) => !listed.has(t))).toEqual([]);
  });

  it.skipIf(!hasDb)("deployed function body matches the migration's table list", () => {
    const body = psql("select pg_get_functiondef('public.purge_test_company(uuid,boolean)'::regprocedure)").join("\n");
    for (const t of listed) expect(body).toContain(`'${t}'`);
  });

  it("orders children before parents for known NO ACTION edges", () => {
    const order = [...listed];
    const before = (a: string, b: string) => expect(order.indexOf(a)).toBeLessThan(order.indexOf(b));
    before("qa_reviews", "claim_records");
    before("trip_events", "crews");
    before("trip_records", "crews");
    before("hold_timers", "truck_run_slots");
    before("schedule_change_log", "scheduling_legs");
    before("eligibility_checks", "patients");
    before("incident_reports", "patients");
    before("comms_events", "facilities");
    before("operational_alerts", "trucks");
    // profiles are handled after the loop, so every profile-referencing table is listed
    for (const t of ["claim_creation_failures", "crews", "trip_records", "schedule_change_log"]) {
      expect(listed.has(t)).toBe(true);
    }
  });
});

describe("purge refusal for real companies", () => {
  it("SQL function raises unless the tenant is test/sandbox", () => {
    expect(migration).toMatch(/IF NOT \(COALESCE\(_co\.is_sandbox,false\) OR COALESCE\(_co\.creator_test_tenant,false\)\) THEN\s+RAISE EXCEPTION/);
  });
  it("execute is service_role only", () => {
    expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.purge_test_company\(uuid, boolean\) FROM PUBLIC, anon, authenticated/);
  });
  it("edge guard refuses real companies and accepts test/sandbox", () => {
    expect(isPurgeableTestTenant({ is_sandbox: false, creator_test_tenant: false })).toBe(false);
    expect(isPurgeableTestTenant({ is_sandbox: null, creator_test_tenant: null })).toBe(false);
    expect(isPurgeableTestTenant(null)).toBe(false);
    expect(isPurgeableTestTenant({ is_sandbox: true })).toBe(true);
    expect(isPurgeableTestTenant({ creator_test_tenant: true })).toBe(true);
  });
  it("manage-company never hard-deletes on delete/archive", () => {
    const src = readFileSync("supabase/functions/manage-company/index.ts", "utf8");
    expect(src).not.toMatch(/from\("companies"\)\.delete\(\)/);
    expect(src).toContain('if (!trimmedReason) return json({ error: "Archive reason required" }, 400);');
  });
});
