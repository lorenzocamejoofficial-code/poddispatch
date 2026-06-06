import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getDenialTranslation, isRecoverable } from "@/lib/denial-code-translations";
import { useAuth } from "@/hooks/useAuth";
import { useIsSimulationCompany } from "@/hooks/useIsSimulationCompany";
import { useSimulationSession } from "@/hooks/useSimulationSession";

export interface MissingMoneyItem {
  id: string;
  category: MissingMoneyCategory;
  patientName: string;
  payerName?: string;
  runDate: string;
  truckName?: string;
  amount: number;
  daysOutstanding?: number;
  denialCode?: string;
  denialExplanation?: string;
  claimId?: string;
  tripId?: string;
  status?: string;
}

export type MissingMoneyCategory =
  | "no_pcr"
  | "pcr_not_billed"
  | "no_followup"
  | "secondary_not_billed"
  | "denial_no_action";

export interface MissingMoneyCategorySummary {
  category: MissingMoneyCategory;
  label: string;
  count: number;
  amount: number;
  items: MissingMoneyItem[];
  route: string;
}

export function useMissingMoneyScan() {
  const { activeCompanyId } = useAuth();
  const isSimulationCompany = useIsSimulationCompany();
  const { simulationRunId, refreshToken } = useSimulationSession();
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<MissingMoneyCategorySummary[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [lastScanAt, setLastScanAt] = useState<Date | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setLoading(true);
    setScanError(null);
    if (!activeCompanyId) {
      setCategories([]);
      setTotalAmount(0);
      setLastScanAt(new Date());
      setLoading(false);
      return;
    }

    const applyScope = (query: any) => {
      let scoped = query.eq("company_id", activeCompanyId);
      if (!isSimulationCompany) {
        scoped = scoped.or("is_simulated.eq.false,is_simulated.is.null");
      }
      if (simulationRunId && !isSimulationCompany) {
        scoped = scoped.eq("simulation_run_id", simulationRunId);
      }
      return scoped;
    };

    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const fortyFiveDaysAgo = new Date(Date.now() - 45 * 86400000).toISOString();

    try {
      // Fetch charge_master for revenue estimation
      const { data: rates, error: ratesError } = await supabase
        .from("charge_master" as any)
        .select("*")
        .eq("company_id", activeCompanyId);
      if (ratesError) throw ratesError;
      const rateMap = new Map<string, any>();
      ((rates ?? []) as any[]).forEach((r: any) => rateMap.set(r.payer_type, r));
      const defaultRate = rateMap.get("default");
      const estimateRevenue = (payerType: string | null, loadedMiles: number | null) => {
        const rate = rateMap.get(payerType ?? "default") ?? defaultRate;
        if (!rate) return 0;
        const base = Number(rate.base_rate ?? 0);
        const mileage = Number(rate.mileage_rate ?? 0) * (loadedMiles ?? 8);
        return base + mileage;
      };

      // ---- CHECK 1: Completed trips with no PCR submitted ----
      const noPcrQuery = applyScope(supabase
        .from("trip_records" as any)
        .select("id, status, run_date, pcr_status, patient_id, truck_id, loaded_miles, company_id")
        .gte("run_date", ninetyDaysAgo)
        .in("status", ["completed", "ready_for_billing"])
        .or("pcr_status.is.null,and(pcr_status.neq.submitted,pcr_status.neq.complete)")
        .limit(500));
      const { data: noPcrTrips, error: noPcrError } = await noPcrQuery;
      if (noPcrError) throw noPcrError;

      // ---- CHECK 2: PCR submitted but no claim ----
      const pcrSubmittedQuery = applyScope(supabase
        .from("trip_records" as any)
        .select("id, run_date, patient_id, truck_id, loaded_miles, company_id, pcr_status, status")
        .eq("pcr_status", "submitted")
        .in("status", ["ready_for_billing", "completed"])
        .limit(500));
      const { data: pcrSubmittedTrips, error: pcrSubmittedError } = await pcrSubmittedQuery;
      if (pcrSubmittedError) throw pcrSubmittedError;

      // ---- CHECK 3: Claims past 45 days no follow-up ----
      const agingQuery = applyScope(supabase
        .from("claim_records" as any)
        .select("id, patient_id, payer_name, payer_type, total_charge, submitted_at, run_date, status")
        .eq("status", "submitted")
        .lt("submitted_at", fortyFiveDaysAgo)
        .or("is_test_submission.eq.false,is_test_submission.is.null")
        .limit(500));
      const { data: agingClaims, error: agingError } = await agingQuery;
      if (agingError) throw agingError;

      // ---- CHECK 4: Secondary not billed ----
      const secondaryQuery = applyScope(supabase
        .from("claim_records" as any)
        .select("id, patient_id, payer_name, patient_responsibility_amount, run_date, status, secondary_claim_generated")
        .eq("status", "paid")
        .eq("secondary_claim_generated", false)
        .gt("patient_responsibility_amount", 0)
        .or("is_test_submission.eq.false,is_test_submission.is.null")
        .limit(500));
      const { data: secondaryClaims, error: secondaryError } = await secondaryQuery;
      if (secondaryError) throw secondaryError;

      // ---- CHECK 5: Denied recoverable no action ----
      const deniedQuery = applyScope(supabase
        .from("claim_records" as any)
        .select("id, patient_id, payer_name, total_charge, denial_code, run_date, status")
        .eq("status", "denied")
        .or("is_test_submission.eq.false,is_test_submission.is.null")
        .limit(500));
      const { data: deniedClaims, error: deniedError } = await deniedQuery;
      if (deniedError) throw deniedError;

      // Gather all patient and truck IDs for enrichment
      const allTrips = [...(noPcrTrips ?? []) as any[], ...(pcrSubmittedTrips ?? []) as any[]];
      const allClaims = [...(agingClaims ?? []) as any[], ...(secondaryClaims ?? []) as any[], ...(deniedClaims ?? []) as any[]];

      const patientIds = [...new Set([
        ...allTrips.map((t: any) => t.patient_id),
        ...allClaims.map((c: any) => c.patient_id),
      ].filter(Boolean))];
      const truckIds = [...new Set(allTrips.map((t: any) => t.truck_id).filter(Boolean))];

      const [{ data: patients }, { data: trucks }] = await Promise.all([
        patientIds.length > 0
          ? supabase.from("patients").select("id, first_name, last_name, primary_payer, secondary_payer").in("id", patientIds)
          : Promise.resolve({ data: [] as any[] }),
        truckIds.length > 0
          ? supabase.from("trucks").select("id, name").in("id", truckIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const patMap = new Map<string, any>();
      ((patients ?? []) as any[]).forEach((p: any) => patMap.set(p.id, p));
      const truckMap = new Map<string, string>();
      ((trucks ?? []) as any[]).forEach((t: any) => truckMap.set(t.id, t.name));

      const patName = (id: string | null) => {
        if (!id) return "Unknown";
        const p = patMap.get(id);
        return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Unknown" : "Unknown";
      };

      // For Check 2, find which trips already have claims
      const pcrTripIds = ((pcrSubmittedTrips ?? []) as any[]).map((t: any) => t.id);
      let claimedTripIds = new Set<string>();
      if (pcrTripIds.length > 0) {
        const { data: existingClaims } = await supabase
          .from("claim_records" as any)
          .select("trip_id")
          .in("trip_id", pcrTripIds);
        claimedTripIds = new Set(((existingClaims ?? []) as any[]).map((c: any) => c.trip_id));
      }

      // For Check 3 and 5, find which claims have recent follow-up notes
      const agingClaimIds = ((agingClaims ?? []) as any[]).map((c: any) => c.id);
      const deniedClaimIds = ((deniedClaims ?? []) as any[]).map((c: any) => c.id);
      const allCheckClaimIds = [...agingClaimIds, ...deniedClaimIds];

      let recentNoteClaimIds = new Set<string>();
      if (allCheckClaimIds.length > 0) {
        // Get notes from last 14 days (superset of 7 days check)
        const { data: recentNotes } = await supabase
          .from("ar_followup_notes")
          .select("claim_id, created_at")
          .in("claim_id", allCheckClaimIds)
          .gte("created_at", fourteenDaysAgo);

        const notesByClaimId = new Map<string, string[]>();
        ((recentNotes ?? []) as any[]).forEach((n: any) => {
          const existing = notesByClaimId.get(n.claim_id) ?? [];
          existing.push(n.created_at);
          notesByClaimId.set(n.claim_id, existing);
        });

        // For aging claims (check 3): need note in last 7 days
        agingClaimIds.forEach((id) => {
          const notes = notesByClaimId.get(id) ?? [];
          if (notes.some((d) => d >= sevenDaysAgo)) {
            recentNoteClaimIds.add(id);
          }
        });

        // For denied claims (check 5): need note in last 14 days
        deniedClaimIds.forEach((id) => {
          const notes = notesByClaimId.get(id) ?? [];
          if (notes.length > 0) {
            recentNoteClaimIds.add(id);
          }
        });
      }

      // For Check 4, filter to patients with secondary_payer
      const secondaryFiltered = ((secondaryClaims ?? []) as any[]).filter((c: any) => {
        const pat = patMap.get(c.patient_id);
        return pat?.secondary_payer;
      });

      // Build category results
      const cat1Items: MissingMoneyItem[] = ((noPcrTrips ?? []) as any[]).map((t: any) => ({
        id: t.id,
        category: "no_pcr" as MissingMoneyCategory,
        patientName: patName(t.patient_id),
        runDate: t.run_date,
        truckName: truckMap.get(t.truck_id) ?? "Unknown",
        amount: estimateRevenue(patMap.get(t.patient_id)?.primary_payer, t.loaded_miles),
        tripId: t.id,
      }));

      const cat2Items: MissingMoneyItem[] = ((pcrSubmittedTrips ?? []) as any[])
        .filter((t: any) => !claimedTripIds.has(t.id))
        .map((t: any) => ({
          id: t.id,
          category: "pcr_not_billed" as MissingMoneyCategory,
          patientName: patName(t.patient_id),
          runDate: t.run_date,
          truckName: truckMap.get(t.truck_id) ?? "Unknown",
          amount: estimateRevenue(patMap.get(t.patient_id)?.primary_payer, t.loaded_miles),
          tripId: t.id,
        }));

      const cat3Items: MissingMoneyItem[] = ((agingClaims ?? []) as any[])
        .filter((c: any) => !recentNoteClaimIds.has(c.id))
        .map((c: any) => {
          const daysOut = c.submitted_at
            ? Math.floor((Date.now() - new Date(c.submitted_at).getTime()) / 86400000)
            : 0;
          return {
            id: c.id,
            category: "no_followup" as MissingMoneyCategory,
            patientName: patName(c.patient_id),
            payerName: c.payer_name ?? c.payer_type ?? "Unknown",
            runDate: c.run_date,
            amount: Number(c.total_charge ?? 0),
            daysOutstanding: daysOut,
            claimId: c.id,
          };
        });

      const cat4Items: MissingMoneyItem[] = secondaryFiltered.map((c: any) => ({
        id: c.id,
        category: "secondary_not_billed" as MissingMoneyCategory,
        patientName: patName(c.patient_id),
        payerName: c.payer_name ?? "Primary",
        runDate: c.run_date,
        amount: Number(c.patient_responsibility_amount ?? 0),
        claimId: c.id,
      }));

      const cat5Items: MissingMoneyItem[] = ((deniedClaims ?? []) as any[])
        .filter((c: any) => {
          if (recentNoteClaimIds.has(c.id)) return false;
          return c.denial_code ? isRecoverable(c.denial_code) : false;
        })
        .map((c: any) => {
          const translation = getDenialTranslation(c.denial_code);
          return {
            id: c.id,
            category: "denial_no_action" as MissingMoneyCategory,
            patientName: patName(c.patient_id),
            payerName: c.payer_name ?? "Unknown",
            runDate: c.run_date,
            amount: Number(c.total_charge ?? 0),
            denialCode: c.denial_code,
            denialExplanation: translation?.plain_english_explanation ?? "Unknown denial",
            claimId: c.id,
          };
        });

      const results: MissingMoneyCategorySummary[] = [
        {
          category: "no_pcr",
          label: "Completed — No PCR Submitted",
          count: cat1Items.length,
          amount: cat1Items.reduce((s, i) => s + i.amount, 0),
          items: cat1Items,
          route: "/trips",
        },
        {
          category: "pcr_not_billed",
          label: "PCR Submitted — Not Billed",
          count: cat2Items.length,
          amount: cat2Items.reduce((s, i) => s + i.amount, 0),
          items: cat2Items,
          route: "/trips",
        },
        {
          category: "no_followup",
          label: "Submitted — No Follow-Up",
          count: cat3Items.length,
          amount: cat3Items.reduce((s, i) => s + i.amount, 0),
          items: cat3Items,
          route: "/billing",
        },
        {
          category: "secondary_not_billed",
          label: "Secondary Not Billed",
          count: cat4Items.length,
          amount: cat4Items.reduce((s, i) => s + i.amount, 0),
          items: cat4Items,
          route: "/billing",
        },
        {
          category: "denial_no_action",
          label: "Denial — No Action Taken",
          count: cat5Items.length,
          amount: cat5Items.reduce((s, i) => s + i.amount, 0),
          items: cat5Items,
          route: "/billing",
        },
      ];

      const total = results.reduce((s, c) => s + c.amount, 0);
      setCategories(results);
      setTotalAmount(total);
      setLastScanAt(new Date());
    } catch (err: any) {
      console.error("Missing money scan failed:", err);
      setCategories([]);
      setTotalAmount(0);
      setScanError(err?.message ?? "Missing money scan failed");
    }
    setLoading(false);
  }, [activeCompanyId, isSimulationCompany, simulationRunId]);

  useEffect(() => {
    runScan();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") runScan();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", runScan);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", runScan);
    };
  }, [runScan, refreshToken]);

  const hasIssues = categories.some((c) => c.count > 0);

  return { loading, categories, totalAmount, lastScanAt, hasIssues, scanError, runScan };
}
