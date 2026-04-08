import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if the current user has a non-empty cert_level.
 * Truck assignment is NOT required — cert alone grants crew UI access.
 */
export function useCrewViewEligibility(profileId: string | null) {
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profileId) {
      setEligible(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("cert_level")
          .eq("id", profileId)
          .maybeSingle();

        if (!cancelled) {
          setEligible(!!profile?.cert_level);
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setEligible(false); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [profileId]);

  return { eligible, loading };
}
