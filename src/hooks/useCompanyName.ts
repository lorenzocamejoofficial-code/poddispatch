import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useCompanyName() {
  const { activeCompanyId } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompanyId) {
      setCompanyName(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("companies")
      .select("name")
      .eq("id", activeCompanyId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.warn("useCompanyName fetch error:", error.message);
        setCompanyName(data?.name ?? null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  return { companyName: companyName ?? "PodDispatch", loading };
}
