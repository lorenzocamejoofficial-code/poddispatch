import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import BillingAndClaims from "./BillingAndClaims";

const { generate, claims, patients } = vi.hoisted(() => ({
  generate: vi.fn(),
  claims: Array.from({ length: 5 }, (_, i) => ({
    id: `claim-${i}`, trip_id: `trip-${i}`, patient_id: `patient-${i}`,
    run_date: "2026-11-19", status: "paid", payer_type: "medicare",
    total_charge: 340, base_charge: 300, mileage_charge: 40, extras_charge: 0,
    amount_paid: 272, patient_responsibility_amount: i === 1 ? 25.5 : 68,
    secondary_claim_generated: false,
  })),
  patients: Array.from({ length: 5 }, (_, i) => ({
    id: `patient-${i}`, first_name: "Synthetic", last_name: `Patient ${i}`,
    secondary_payer: i === 4 ? null : i === 1 ? "Other Payer" : "GA Medicaid",
    secondary_member_id: "synthetic-member",
  })),
}));

vi.mock("@/lib/create-secondary-claim", () => ({ createSecondaryClaim: generate }));
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
      const query: any = new Proxy({}, {
        get: (_, key) => {
          if (key === "then") return (resolve: (value: unknown) => void) => resolve({
            data: head ? null : table === "claim_records" ? claims : table === "patients" ? patients : [],
            count: claims.length, error: null,
          });
          return (...args: any[]) => { if (key === "select") head = !!args[1]?.head; return query; };
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

async function openBoard() {
  render(<MemoryRouter><BillingAndClaims /></MemoryRouter>);
  await screen.findByRole("button", { name: "Review" });
}

describe("secondary review and paid-card generation", () => {
  beforeEach(() => {
    generate.mockReset();
    generate.mockResolvedValue({ ok: true, newClaimId: "synthetic-secondary" });
    claims.forEach(c => { c.secondary_claim_generated = false; });
  });

  it("Review from Denied switches to the four eligible Paid claims, including after other tab selections", async () => {
    await openBoard();
    fireEvent.click(screen.getByRole("button", { name: "Denied 0" }));
    expect(screen.getByText("No claims in Denied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.queryByText("No claims in Denied")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(4);
    expect(screen.queryByText("Synthetic Patient 4")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Denied 0" }));
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });

  it("runs the existing generator once from the card without opening the editor, then reads back the refreshed list", async () => {
    await openBoard();
    fireEvent.click(screen.getByRole("button", { name: "Review" }));
    generate.mockImplementationOnce(async (id: string) => {
      const claim = claims.find(c => c.id === id);
      if (claim) claim.secondary_claim_generated = true;
      return { ok: true, newClaimId: "synthetic-secondary" };
    });
    const card = screen.getAllByRole("article")[0];
    fireEvent.click(within(card).getByRole("button", { name: "Generate secondary to GA Medicaid" }));
    await waitFor(() => expect(generate).toHaveBeenCalledExactlyOnceWith("claim-0"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(3));
  });

  it("leaves ineligible paid claims without a generation action", async () => {
    await openBoard();
    fireEvent.click(screen.getByRole("button", { name: "Paid 5" }));
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(within(screen.getAllByRole("article")[4]).queryByRole("button", { name: /Generate secondary/ })).not.toBeInTheDocument();
  });
});