import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Crew-UI eligibility == real "cleared to ride" rule.
 * Calls public.crew_assignable(auth user id): 3 distinct approved,
 * unexpired (or manually verified) crew_certifications rows.
 */
export function useCrewViewEligibility(userId: string | null) {
  const [eligible, setEligible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setEligible(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase.rpc("crew_assignable", {
          _user_id: userId,
        });

        if (!cancelled) {
          setEligible(!error && data === true);
          setLoading(false);
        }
      } catch {
        if (!cancelled) { setEligible(false); setLoading(false); }
      }
    })();

    return () => { cancelled = true; };
  }, [userId]);

  return { eligible, loading };
}
