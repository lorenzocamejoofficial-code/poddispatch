import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BillingAndClaims from "./BillingAndClaims";

const { claims, patients, writes } = vi.hoisted(() => ({
  claims: [] as any[], patients: [] as any[], writes: [] as any[],
}));


vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ activeCompanyId: "synthetic-company" }) }));
vi.mock("@/lib/company-scope", () => ({ getActiveCompanyId: async () => "synthetic-company", NO_COMPANY: "none" }));
vi.mock("@/hooks/useSchedulingStore", () => ({ useSchedulingStore: () => ({ selectedDate: "2026-11-19", setSelectedDate: vi.fn() }) }));
vi.mock("@/hooks/useSimulationSession", () => ({ useSimulationSession: () => ({ simulationRunId: null, refreshToken: 0 }) }));
vi.mock("@/hooks/useIsSimulationCompany", () => ({ useSimulationCompanyState: () => ({ isSim: false, resolved: true }) }));
vi.mock("@/lib/submission-mode", () => ({ fetchSubmissionMode: async () => ({ isTest: true }) }));
vi.mock("@/lib/use-focus-scroll", () => ({ useFocusScroll: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      let head = false;
      let update: any = null;
      const filters: any[] = [];
      const query: any = new Proxy({}, {
        get: (_, key) => {
          if (key === "then") return (resolve: (value: unknown) => void) => {
            let data = table === "claim_records" ? claims : table === "patients" ? patients : [];
            if (update) {
              const matching = claims.filter(c => filters.every(([op, field, value]) =>
                op === "in" ? value.includes(c[field]) : c[field] === value));
              writes.push({ table, update, filters });
              matching.forEach(c => Object.assign(c, update));
              data = matching.map(c => ({ id: c.id }));
            }
            resolve({ data: head ? null : data, count: claims.length, error: null });
          };
          return (...args: any[]) => {
            if (key === "select") head = !!args[1]?.head;
            if (key === "update") update = args[0];
            if (key === "eq" || key === "in") filters.push([key, ...args]);
            return query;
          };
        },
      });
      return query;
    },
  },
}));
vi.mock("@/components/layout/AdminLayout", () => ({ AdminLayout: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/components/billing/SubmissionQueueErrorsPanel", () => ({ SubmissionQueueErrorsPanel: () => null }));
vi.mock("@/components/billing/SubmissionPipelineStrip", () => ({ SubmissionPipelineStrip: () => null }));
vi.mock("@/components/billing/JustArrivedRibbon", () => ({ JustArrivedRibbon: () => null }));
vi.mock("@/components/billing/TimelyFilingStrip", () => ({ TimelyFilingStrip: () => null }));
vi.mock("@/components/billing/CleanTripBadge", () => ({ CleanTripBadge: () => null }));
vi.mock("@/components/billing/RemittanceActivityPanel", () => ({ RemittanceActivityPanel: () => null }));
vi.mock("@/components/billing/RemittanceHistoryPanel", () => ({ RemittanceHistoryPanel: () => null }));
vi.mock("@/components/billing/ReleaseReviewDialog", () => ({ ReleaseReviewDialog: () => null }));
vi.mock("@/components/billing/ClaimTimelineDrawer", () => ({ ClaimTimelineDrawer: () => null }));
vi.mock("@/components/billing/PreSubmitChecklist", () => ({ PreSubmitChecklist: () => null }));
vi.mock("@/components/billing/BillingQueueView", () => ({ BillingQueueView: () => null }));
vi.mock("@/components/billing/PayerDirectoryTab", () => ({ PayerDirectoryTab: () => null }));
vi.mock("@/components/billing/MissingMoneyPanel", () => ({ MissingMoneyDetail: () => null }));
vi.mock("@/components/billing/DenialRecoveryEngine", () => ({ DenialRecoveryEngine: () => null }));
vi.mock("@/components/billing/RevenueCycleTab", () => ({ RevenueCycleTab: () => null }));

const clean = {
  id: "synthetic-claim", company_id: "synthetic-company", trip_id: "synthetic-trip",
  patient_id: "synthetic-patient", run_date: "2026-11-19", status: "ready_to_bill",
  payer_type: "medicare", payer_name: "Medicare", total_charge: 400,
  base_charge: 400, mileage_charge: 0, extras_charge: 0,
  member_id: "TEST123", patient_dob: "1950-01-01", patient_sex: "F",
  hcpcs_codes: ["A0428"], icd10_codes: ["R53.1"], origin_type: "Residence",
  destination_type: "Hospital", origin_zip: "30301",
};

beforeEach(() => {
  claims.splice(0); patients.splice(0); writes.splice(0);
  patients.push({ id: "synthetic-patient", first_name: "Synthetic", last_name: "Patient",
    pickup_address: "100 Test St, Atlanta, GA 30301" });
});

describe("mount readiness reconciliation", () => {
  it.each([
    ["missing ICD-10", { icd10_codes: [] }],
    ["missing origin", { origin_type: null }],
    ["missing destination", { destination_type: null }],
    ["missing member ID", { member_id: null }],
    ["filing expired", { run_date: "2020-01-01" }],
  ])("demotes %s without requiring rates or trip reads", async (_, changes) => {
    claims.push({ ...clean, ...changes });
    render(<MemoryRouter><BillingAndClaims /></MemoryRouter>);
    await waitFor(() => expect(claims[0].status).toBe("needs_review"));
    expect(writes).toHaveLength(1);
    expect(writes[0].update).toEqual({ status: "needs_review" });
    expect(writes[0].filters).toContainEqual(["eq", "company_id", "synthetic-company"]);
    expect(writes[0].filters).toContainEqual(["eq", "status", "ready_to_bill"]);
  });

  it("never demotes clean, paid, or other-company claims", async () => {
    claims.push({ ...clean }, { ...clean, id: "paid", status: "paid", icd10_codes: [] },
      { ...clean, id: "other-company", company_id: "other", icd10_codes: [] });
    render(<MemoryRouter><BillingAndClaims /></MemoryRouter>);
    await screen.findByRole("button", { name: "Ready to Bill 2" });
    expect(writes).toEqual([]);
    expect(claims.map(c => c.status)).toEqual(["ready_to_bill", "paid", "ready_to_bill"]);
  });
});
