import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns true when the active company is a creator_test_tenant or is_sandbox tenant.
 * Used by Billing & Claims and other queue UIs so seeded/simulated rows are visible
 * (and therefore submittable end-to-end through Office Ally) inside the App Simulator,
 * while remaining hidden inside real customer tenants.
 */
export function useIsSimulationCompany(): boolean {
  const { activeCompanyId } = useAuth();
  const [isSim, setIsSim] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!activeCompanyId) { setIsSim(false); return; }
    (async () => {
      const { data } = await supabase
        .from("companies")
        .select("creator_test_tenant, is_sandbox")
        .eq("id", activeCompanyId)
        .maybeSingle();
      if (!cancelled) {
        setIsSim(Boolean((data as any)?.creator_test_tenant || (data as any)?.is_sandbox));
      }
    })();
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  return isSim;
}
