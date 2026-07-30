import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Crew-UI eligibility == real "cleared to ride" rule.
 * Calls public.crew_assignable(auth user id): 3 distinct approved,
 * unexpired (or manually verified) crew_certifications rows.
 * On top of that, anything the employer entered must have been reviewed and
 * confirmed by the crew member themselves before the crew tools unlock.
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

        let unreviewed = 0;
        if (!error && data === true) {
          const { count } = await supabase
            .from("crew_certifications" as any)
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .is("confirmed_by_user_at", null);
          unreviewed = count ?? 0;
        }

        if (!cancelled) {
          setEligible(!error && data === true && unreviewed === 0);
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
