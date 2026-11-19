import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { applyCoverageReview } from "./coverage-apply";

function fakeClient(opts: { checkRows?: any[] } = {}) {
  const calls: { table: string; update: any; filters: [string, any][] }[] = [];
  const client: any = {
    from(table: string) {
      const call = { table, update: null as any, filters: [] as [string, any][] };
      calls.push(call);
      const b: any = {
        update(v: any) { call.update = v; return b; },
        eq(k: string, v: any) { call.filters.push([k, v]); return b; },
        select() { return Promise.resolve({ data: opts.checkRows ?? [{ id: "c1" }], error: null }); },
        then(res: any) { return Promise.resolve({ error: null }).then(res); },
      };
      return b;
    },
  };
  return { client, calls };
}
const row = { id: "c1", patient_id: "p1", check_type: "discovery" as const, status: "coverage_found",
  payer_name: "Sample Payer", payer_member_id: "SAMPLE1", reviewed: false, review_action: null };

describe("Coverage panel review wiring", () => {
  it("confirm secondary writes patient secondary fields then marks reviewed, company-scoped", async () => {
    const { client, calls } = fakeClient();
    const res = await applyCoverageReview({ row, action: "confirmed_secondary", userId: "u1", companyId: "co1", client });
    expect(res.ok).toBe(true);
    expect(calls[0].table).toBe("patients");
    expect(calls[0].update).toEqual({ secondary_payer: "Sample Payer", secondary_member_id: "SAMPLE1" });
    expect(calls[0].filters).toContainEqual(["company_id", "co1"]);
    expect(calls[1].table).toBe("coverage_checks");
    expect(calls[1].update.review_action).toBe("confirmed_secondary");
    expect(calls[1].filters).toContainEqual(["reviewed", false]);
  });
  it("confirm primary writes primary payer and member_id", async () => {
    const { client, calls } = fakeClient();
    await applyCoverageReview({ row, action: "confirmed_primary", userId: "u1", companyId: "co1", client });
    expect(calls[0].update).toEqual({ primary_payer: "Sample Payer", member_id: "SAMPLE1" });
  });
  it("dismiss never touches the patient", async () => {
    const { client, calls } = fakeClient();
    await applyCoverageReview({ row, action: "dismissed", userId: "u1", companyId: "co1", client });
    expect(calls.map((c) => c.table)).toEqual(["coverage_checks"]);
  });
  it("already-reviewed result is refused with no writes", async () => {
    const { client, calls } = fakeClient();
    const res = await applyCoverageReview({ row: { ...row, reviewed: true }, action: "confirmed_secondary", userId: "u1", companyId: "co1", client });
    expect(res.ok).toBe(false);
    expect(calls).toHaveLength(0);
  });
  it("reports failure when the row was reviewed concurrently", async () => {
    const { client } = fakeClient({ checkRows: [] });
    const res = await applyCoverageReview({ row, action: "dismissed", userId: "u1", companyId: "co1", client });
    expect(res.ok).toBe(false);
  });
});
