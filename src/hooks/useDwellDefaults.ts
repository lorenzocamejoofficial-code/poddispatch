import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getActiveCompanyId, NO_COMPANY } from "@/lib/company-scope";
import { DEFAULT_DWELL_MINUTES } from "@/lib/dwell-defaults";
export function useDwellDefaults() {
  const [defaults, setDefaults] = useState<unknown>(DEFAULT_DWELL_MINUTES);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const companyId = (await getActiveCompanyId()) ?? NO_COMPANY;
      const { data, error } = await supabase.from("company_settings").select("default_dwell_minutes").eq("company_id", companyId).maybeSingle();
      if (!cancelled && !error) setDefaults(data?.default_dwell_minutes ?? DEFAULT_DWELL_MINUTES);
    })();
    return () => { cancelled = true; };
  }, []);
  return defaults;
}
