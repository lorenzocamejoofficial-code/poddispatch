import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunicationsSection } from "@/components/dispatch/CommunicationsSection";

// Every supabase call resolves to "no rows" so the panel renders in a quiet state.
const { supabaseMock } = vi.hoisted(() => {
  const supabaseMock: any = new Proxy(function () {}, {
    get: (_t, prop) => {
      if (prop === "then") {
        return (resolve: (v: any) => void) => resolve({ data: [], error: null, count: 0 });
      }
      if (prop === "removeChannel" || prop === "on") return () => supabaseMock;
      return (..._a: any[]) => supabaseMock;
    },
    apply: () => supabaseMock,
  });
  return { supabaseMock };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));
vi.mock("@/lib/company-scope", () => ({
  getActiveCompanyId: async () => null,
  NO_COMPANY: "00000000-0000-0000-0000-000000000000",
  clearActiveCompanyIdCache: () => {},
}));

const trucksWith = (runs: { id: string; patient_name: string; status: string }[]) => [
  {
    id: "truck-1",
    name: "Truck 12",
    runs: runs.map((r) => ({
      id: r.id,
      patient_name: r.patient_name,
      pickup_time: "09:00",
      status: r.status,
      leg_id: null,
      destination_name: null,
    })),
  },
];

describe("CommunicationsSection visibility", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stays visible with no active runs, Place Call disabled", async () => {
    render(<CommunicationsSection selectedDate="2026-10-10" trucks={[]} />);

    expect(await screen.findByText(/^communications$/i)).toBeInTheDocument();
    expect(screen.getByText(/no active runs to call right now/i)).toBeInTheDocument();

    const btn = screen.getByRole("button", { name: /place call/i });
    expect(btn).toBeDisabled();
  });

  it("stays visible when every run on the day is already finished", async () => {
    render(
      <CommunicationsSection
        selectedDate="2026-10-10"
        trucks={trucksWith([
          { id: "s1", patient_name: "Alicia Monroe", status: "ready_for_billing" },
          { id: "s2", patient_name: "Caleb Foster", status: "completed" },
        ])}
      />,
    );

    expect(await screen.findByText(/^communications$/i)).toBeInTheDocument();
    expect(screen.getByText(/no active runs to call right now/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /place call/i })).toBeDisabled();
  });

  it("enables Place Call when the day has an active run", async () => {
    render(
      <CommunicationsSection
        selectedDate="2026-10-10"
        trucks={trucksWith([{ id: "s1", patient_name: "Alicia Monroe", status: "scheduled" }])}
      />,
    );

    expect(await screen.findByText(/^communications$/i)).toBeInTheDocument();
    expect(screen.getByText(/pick a truck, then a run/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /place call/i })).toBeEnabled();
  });
});
