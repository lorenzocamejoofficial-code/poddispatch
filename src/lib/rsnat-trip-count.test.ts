import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  company: vi.fn(),
  from: vi.fn(),
  result: { count: 81 as number | null, error: null as unknown },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: mocks.from } }));
vi.mock("@/lib/company-scope", () => ({
  getActiveCompanyId: mocks.company,
  NO_COMPANY: "00000000-0000-0000-0000-000000000000",
}));
import { countRsnatRoundTrips, countRsnatOneWayTrips } from "./rsnat-trip-count";

function makeQuery() {
  const query = {
    select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    then: (resolve: (value: typeof mocks.result) => unknown) => Promise.resolve(mocks.result).then(resolve),
  };
  mocks.from.mockReturnValue(query);
  return query;
}

describe("RSNAT shared period counter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.company.mockResolvedValue("company-a");
    mocks.result = { count: 81, error: null };
  });
  it("floors linked trips / 2 with exact counts and inclusive company/patient scope", async () => {
    const query = makeQuery();
    expect(await countRsnatRoundTrips("patient-a", "2026-10-01", "2026-11-30")).toBe(40);
    expect(query.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(query.eq).toHaveBeenCalledWith("company_id", "company-a");
    expect(query.eq).toHaveBeenCalledWith("patient_id", "patient-a");
    expect(query.gte).toHaveBeenCalledWith("run_date", "2026-10-01");
    expect(query.lte).toHaveBeenCalledWith("run_date", "2026-11-30");
    expect(query.not).toHaveBeenCalledWith("leg_id", "is", null);
  });
  it("keeps unlinked one-way trips for the original backstop threshold", async () => {
    const query = makeQuery();
    expect(await countRsnatOneWayTrips("p", "2026-10-01", "2026-11-30")).toBe(81);
    expect(query.not).not.toHaveBeenCalled();
  });
  it("uses NO_COMPANY instead of an unscoped read", async () => {
    mocks.company.mockResolvedValue(null);
    const query = makeQuery();
    await countRsnatRoundTrips("p", "2026-10-01", "2026-11-30");
    expect(query.eq).toHaveBeenCalledWith("company_id", "00000000-0000-0000-0000-000000000000");
  });
  it("does not report zero usage on a failed read", async () => {
    makeQuery();
    mocks.result = { count: null, error: new Error("unavailable") };
    await expect(countRsnatRoundTrips("p", "2026-10-01", "2026-11-30")).rejects.toThrow("unavailable");
  });
});