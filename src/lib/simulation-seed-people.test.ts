import { describe, it, expect } from "vitest";
import { personKey, seedPeople, seedPickupMinute } from "../../supabase/functions/simulation-lab/seed-people";
const templates = [{ first_name: "Synthetic", last_name: "Person", dob: "1940-01-01", transport_type: "dialysis" }, { first_name: "Synthetic", last_name: "Person", dob: "1940-01-01", transport_type: "wound_care" }];
describe("seed identities", () => {
  it("collapses template variants for a single person independently of transport", () => {
    const people = seedPeople(templates, 2, ["Extra Person", "Another Person"]);
    expect(people[0].last_name).toBe("Person Demo");
    expect(people[1].first_name).toBe("Another");
    expect(new Set(people.map(personKey)).size).toBe(2);
  });
  it("keeps different transport types sequential on one patient without moving another patient", () => {
    const next = new Map<string, number>();
    expect(seedPickupMinute(480, "patient-a", next)).toBe(480);
    expect(seedPickupMinute(480, "patient-a", next)).toBe(570);
    expect(seedPickupMinute(480, "patient-b", next)).toBe(480);
    expect(seedPickupMinute(480, "patient-a", next)).toBe(660);
  });
  it("is stable across reseeds and distinct beyond the name pool", () => {
    const people = seedPeople(templates, 120, ["Extra Person"]);
    expect(people).toEqual(seedPeople(templates, 120, ["Extra Person"]));
    expect(new Set(people.map(personKey)).size).toBe(120);
  });
});
