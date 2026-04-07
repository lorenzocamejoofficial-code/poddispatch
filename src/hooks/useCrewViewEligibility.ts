import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns true if the current user has a non-empty cert_level
 * AND is assigned as crew on a truck for today's date.
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
        // 1. Check cert_level
        const { data: profile } = await supabase
          .from("profiles")
          .select("cert_level")
          .eq("id", profileId)
          .maybeSingle();

        if (!profile?.cert_level || cancelled) {
          if (!cancelled) { setEligible(false); setLoading(false); }
          return;
        }

        // 2. Check if assigned to a crew today
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        const { data: crews } = await supabase
          .from("crews")
          .select("id")
          .eq("active_date", dateStr)
          .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
          .limit(1);

        if (!cancelled) {
          setEligible(!!(crews && crews.length > 0));
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
