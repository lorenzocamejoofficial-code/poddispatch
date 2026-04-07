import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface OnboardingProgress {
  step_rates_verified: boolean;
  step_trucks_added: boolean;
  step_patients_added: boolean;
  step_team_invited: boolean;
  step_first_trip: boolean;
  wizard_completed: boolean;
  onboarding_dismissed: boolean;
  wizard_step: number;
  loading: boolean;
}

export function useOnboardingProgress() {
  const { activeCompanyId } = useAuth();
  const [progress, setProgress] = useState<OnboardingProgress>({
    step_rates_verified: false,
    step_trucks_added: false,
    step_patients_added: false,
    step_team_invited: false,
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
    const [trucksRes, patientsRes, invitesRes, tripsRes] = await Promise.all([
      supabase.from("trucks").select("id", { count: "exact", head: true }).eq("company_id", activeCompanyId),
      supabase.from("patients").select("id", { count: "exact", head: true }).eq("company_id", activeCompanyId),
      supabase.from("company_invites").select("id", { count: "exact", head: true }).eq("company_id", activeCompanyId),
      supabase.from("trip_records").select("id", { count: "exact", head: true }).eq("company_id", activeCompanyId).eq("status", "ready_for_billing" as any),
    ]);

    const trucksExist = (trucksRes.count ?? 0) > 0;
    const patientsExist = (patientsRes.count ?? 0) > 0;
    const invitesSent = (invitesRes.count ?? 0) > 0;
    const tripReady = (tripsRes.count ?? 0) > 0;

    const stepTrucks = (settings as any).step_trucks_added || trucksExist;
    const stepPatients = (settings as any).step_patients_added || patientsExist;
    const stepInvited = (settings as any).step_team_invited || invitesSent;
    const stepTrip = (settings as any).step_first_trip || tripReady;
    const stepRates = (settings as any).step_rates_verified;

    const allComplete = stepRates && stepTrucks && stepPatients && stepInvited && stepTrip;

    setProgress({
      step_rates_verified: stepRates,
      step_trucks_added: stepTrucks,
      step_patients_added: stepPatients,
      step_team_invited: stepInvited,
      step_first_trip: stepTrip,
      wizard_completed: (settings as any).wizard_completed || allComplete,
      onboarding_dismissed: (settings as any).onboarding_dismissed || false,
      wizard_step: (settings as any).wizard_step ?? 0,
      loading: false,
    });

    // Auto-update DB if data-driven steps changed
    const updates: Record<string, boolean> = {};
    if (stepTrucks && !(settings as any).step_trucks_added) updates.step_trucks_added = true;
    if (stepPatients && !(settings as any).step_patients_added) updates.step_patients_added = true;
    if (stepInvited && !(settings as any).step_team_invited) updates.step_team_invited = true;
    if (stepTrip && !(settings as any).step_first_trip) updates.step_first_trip = true;
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
    progress.step_rates_verified,
    progress.step_trucks_added,
    progress.step_patients_added,
    progress.step_team_invited,
    progress.step_first_trip,
  ].filter(Boolean).length;

  return { ...progress, completedCount, reload: load, markStep, dismiss };
}
