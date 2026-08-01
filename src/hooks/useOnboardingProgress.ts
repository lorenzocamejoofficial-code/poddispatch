import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/** Number of steps in the Getting Started wizard (clearinghouse excluded). */
export const ONBOARDING_TOTAL_STEPS = 6;

export interface OnboardingProgress {
  step_company_info_verified: boolean;
  step_rates_verified: boolean;
  step_trucks_added: boolean;
  step_patients_added: boolean;
  step_team_invited: boolean;
  step_clearinghouse_connected: boolean;
  step_facility_added: boolean;
  step_first_trip: boolean;
  wizard_completed: boolean;
  onboarding_dismissed: boolean;
  wizard_step: number;
  loading: boolean;
}

export function useOnboardingProgress() {
  const { activeCompanyId, user } = useAuth();
  const [progress, setProgress] = useState<OnboardingProgress>({
    step_company_info_verified: false,
    step_rates_verified: false,
    step_trucks_added: false,
    step_patients_added: false,
    step_team_invited: false,
    step_clearinghouse_connected: false,
    step_facility_added: false,
    step_first_trip: false,
    wizard_completed: false,
    onboarding_dismissed: false,
    wizard_step: 0,
    loading: true,
  });

  const load = useCallback(async () => {
    if (!activeCompanyId) return;

    const { data: settings } = await supabase
      .from("migration_settings")
      .select("*")
      .eq("company_id", activeCompanyId)
      .maybeSingle();

    if (!settings) {
      setProgress(p => ({ ...p, loading: false }));
      return;
    }

    // Check real data for dynamic steps
    const [trucksRes, patientsRes, profilesRes, companyRes, clearinghouseRes, facilitiesRes, ratesRes] = await Promise.all([
      supabase.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", activeCompanyId),
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("company_id", activeCompanyId),
      // Team is "invited" only when at least one OTHER user (not the owner)
      // belongs to the company. The owner's own profile must not satisfy
      // this check, otherwise step 5 is auto-completed before any invite.
      user?.id
        ? supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("company_id", activeCompanyId)
            .neq("user_id", user.id)
        : supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("company_id", activeCompanyId),
      supabase.from("companies").select("npi_number, ein_number, state_of_operation, address_street, address_city, address_state, address_zip, payer_mix_medicare, payer_mix_medicaid, payer_mix_facility, payer_mix_private").eq("id", activeCompanyId).maybeSingle(),
      supabase.from("clearinghouse_settings" as any).select("is_configured").eq("company_id", activeCompanyId).maybeSingle(),
      supabase.from("facilities" as any).select("id", { count: "exact", head: true }).eq("company_id", activeCompanyId),
      supabase.from("charge_master").select("payer_type, base_rate, mileage_rate, needs_review").eq("company_id", activeCompanyId),
    ]);

    const trucksExist = (trucksRes.count ?? 0) > 0;
    const patientsExist = (patientsRes.count ?? 0) > 0;
    const facilitiesExist = ((facilitiesRes as any).count ?? 0) > 0;
    // teamPresent = at least one profile OTHER than the owner exists.
    const teamPresent = (profilesRes.count ?? 0) > 0;
    const c = companyRes.data as any;
    const companyInfoComplete = !!(
      c && c.npi_number && c.ein_number && c.state_of_operation &&
      c.address_street && c.address_city && c.address_state && c.address_zip
    );
    const clearinghouseConfigured = !!(clearinghouseRes.data as any)?.is_configured;

    // Option B: rates step is complete when every payer the operator ACTUALLY BILLS
    // (payer_mix_* > 0) has a confirmed charge_master row (base>0, mileage>0, not needs_review).
    // Facility Contract maps to a 'facility' charge_master row if one exists, else 'default'.
    const rateRows: any[] = (ratesRes.data as any[]) ?? [];
    const byType = new Map(rateRows.map(r => [String(r.payer_type).toLowerCase(), r]));
    const isConfirmed = (key: string) => {
      const r = byType.get(key);
      return !!(r && r.needs_review === false && Number(r.base_rate) > 0 && Number(r.mileage_rate) > 0);
    };
    const billedKeys: string[] = [];
    if (Number(c?.payer_mix_medicare ?? 0) > 0) billedKeys.push("medicare");
    if (Number(c?.payer_mix_medicaid ?? 0) > 0) billedKeys.push("medicaid");
    if (Number(c?.payer_mix_facility ?? 0) > 0) billedKeys.push(byType.has("facility") ? "facility" : "default");
    if (Number(c?.payer_mix_private ?? 0) > 0) billedKeys.push("private");
    const ratesValid = billedKeys.length > 0 && billedKeys.every(isConfirmed);

    const stepCompanyInfo = (settings as any).step_company_info_verified || companyInfoComplete;
    const stepTrucks = (settings as any).step_trucks_added || trucksExist;
    const stepPatients = (settings as any).step_patients_added || patientsExist;
    const stepInvited = (settings as any).step_team_invited || teamPresent;
    const stepFacility = (settings as any).step_facility_added || facilitiesExist;
    // step_first_trip is no longer part of the wizard. We keep the column for
    // analytics but never auto-derive it from trip_records — the column is
    // owned by whoever triggers it manually.
    const stepTrip = (settings as any).step_first_trip;
    const stepRates = (settings as any).step_rates_verified || ratesValid;
    const stepClearinghouse = (settings as any).step_clearinghouse_connected || clearinghouseConfigured;

    // Wizard steps: company info → rates → trucks → crew → facility → patient
    // (the clearinghouse step was removed from the wizard; the column is kept
    //  for analytics but no longer gates completion)
    const allComplete = stepCompanyInfo && stepRates && stepTrucks && stepInvited && stepFacility && stepPatients;

    setProgress({
      step_company_info_verified: stepCompanyInfo,
      step_rates_verified: stepRates,
      step_trucks_added: stepTrucks,
      step_patients_added: stepPatients,
      step_team_invited: stepInvited,
      step_clearinghouse_connected: stepClearinghouse,
      step_facility_added: stepFacility,
      step_first_trip: stepTrip,
      wizard_completed: (settings as any).wizard_completed || allComplete,
      onboarding_dismissed: (settings as any).onboarding_dismissed || false,
      wizard_step: (settings as any).wizard_step ?? 0,
      loading: false,
    });

    // Auto-update DB if data-driven steps changed
    const updates: Record<string, boolean> = {};
    if (stepCompanyInfo && !(settings as any).step_company_info_verified) updates.step_company_info_verified = true;
    if (stepTrucks && !(settings as any).step_trucks_added) updates.step_trucks_added = true;
    if (stepPatients && !(settings as any).step_patients_added) updates.step_patients_added = true;
    if (stepInvited && !(settings as any).step_team_invited) updates.step_team_invited = true;
    if (stepClearinghouse && !(settings as any).step_clearinghouse_connected) updates.step_clearinghouse_connected = true;
    if (stepFacility && !(settings as any).step_facility_added) updates.step_facility_added = true;
    if (ratesValid && !(settings as any).step_rates_verified) updates.step_rates_verified = true;
    if (allComplete && !(settings as any).wizard_completed) updates.wizard_completed = true;

    if (Object.keys(updates).length > 0) {
      await supabase.from("migration_settings").update(updates as any).eq("company_id", activeCompanyId);
    }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  const markStep = useCallback(async (step: string, value: boolean) => {
    if (!activeCompanyId) return;
    await supabase.from("migration_settings").update({ [step]: value } as any).eq("company_id", activeCompanyId);
    await load();
  }, [activeCompanyId, load]);

  const dismiss = useCallback(async () => {
    if (!activeCompanyId) return;
    await supabase.from("migration_settings").update({ onboarding_dismissed: true } as any).eq("company_id", activeCompanyId);
    setProgress(p => ({ ...p, onboarding_dismissed: true }));
  }, [activeCompanyId]);

  const completedCount = [
    progress.step_company_info_verified,
    progress.step_rates_verified,
    progress.step_trucks_added,
    progress.step_team_invited,
    progress.step_facility_added,
    progress.step_patients_added,
  ].filter(Boolean).length;

  return { ...progress, completedCount, totalSteps: ONBOARDING_TOTAL_STEPS, reload: load, markStep, dismiss };
}
