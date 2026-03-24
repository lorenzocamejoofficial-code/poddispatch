import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cachedName: string | null = null;

export function useCompanyName() {
  const [companyName, setCompanyName] = useState<string | null>(cachedName);
  const [loading, setLoading] = useState(!cachedName);

  useEffect(() => {
    if (cachedName) return;
    supabase
      .from("companies")
      .select("name")
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.warn("useCompanyName fetch error:", error.message);
        const name = data?.name ?? "PodDispatch";
        cachedName = name;
        setCompanyName(name);
        setLoading(false);
      });
  }, []);

  return { companyName: companyName ?? "PodDispatch", loading };
}
