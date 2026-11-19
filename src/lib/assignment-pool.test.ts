import { describe, expect, it } from "vitest";
import { availableCrewOptions, type PoolCrew } from "./assignment-pool";

const options = ["one", "two", "three", "free"].map(id => ({ id }));
const crews: PoolCrew[] = [{ id: "crew", active_date: "2026-11-19", member1_id: "one", member2_id: "two", member3_id: "three" }];
describe("exclusive assignment pool", () => {
  it("removes all three assigned seats on the same date", () => {
    expect(availableCrewOptions(options, crews, "2026-11-19")).toEqual([{ id: "free" }]);
  });
  it("makes resources available after unassignment", () => {
    expect(availableCrewOptions(options, [], "2026-11-19")).toEqual(options);
  });
  it("does not exclude another day's crew", () => {
    expect(availableCrewOptions(options, crews, "2026-11-20")).toEqual(options);
  });
  it("retains the edited crew but removes selected sibling seats", () => {
    expect(availableCrewOptions(options, crews, "2026-11-19", "crew", ["two", "three", "none"])).toEqual([{ id: "one" }, { id: "free" }]);
  });
});