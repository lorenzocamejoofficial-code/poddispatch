import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { CREATOR_TEST_COMPANY_ID, enterCreatorSimulation } from "./creator-simulation-entry";

describe("creator simulation entry", () => {
  const assign = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("window", { location: { assign } });
  });
  it("uses guarded membership entry then dispatch, regardless of expired subscription", async () => {
    rpc.mockResolvedValue({ data: CREATOR_TEST_COMPANY_ID, error: null });
    await enterCreatorSimulation();
    expect(rpc).toHaveBeenCalledWith("enter_creator_simulation", { _company_id: CREATOR_TEST_COMPANY_ID });
    expect(assign).toHaveBeenCalledWith("/dispatch");
  });
  it("does not navigate after failed entry", async () => {
    rpc.mockResolvedValue({ error: { message: "unavailable" } });
    await expect(enterCreatorSimulation()).rejects.toThrow("Unable to enter");
    expect(assign).not.toHaveBeenCalled();
  });
});