import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface LocationPing {
  id: string;
  company_id: string;
  user_id: string;
  truck_id: string | null;
  latitude: number;
  longitude: number;
  accuracy_m: number | null;
  speed_mps: number | null;
  heading: number | null;
  recorded_at: string;
  created_at: string;
}

interface EnrichedLocation extends LocationPing {
  profile?: { full_name: string | null } | null;
  truck?: { name: string | null; vehicle_id: string | null } | null;
}

/**
 * Units stay on the map for the whole service day. A crew signing out (or their
 * phone sleeping) stops new pings, but the last known position is still shown —
 * flagged as stale — instead of the unit vanishing mid-shift.
 */
function startOfLocalDayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function useCrewLocations(companyId: string | null) {
  const [locations, setLocations] = useState<EnrichedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const since = startOfLocalDayISO();
    const { data, error: supaError } = await supabase
      .from("crew_locations")
      .select(
        `id, company_id, user_id, truck_id, latitude, longitude, accuracy_m, speed_mps, heading, recorded_at, created_at,
        profiles:user_id(full_name),
        trucks:truck_id(name, vehicle_id)`
      )
      .eq("company_id", companyId)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true });

    if (supaError) {
      setError(supaError.message);
    } else {
      setLocations((data as EnrichedLocation[]) ?? []);
    }
    setLoading(false);
  }, [companyId]);

  useEffect(() => {
    if (!companyId) {
      setLocations([]);
      setLoading(false);
      return;
    }

    fetchLocations();

    const channel = supabase
      .channel("crew_locations_live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "crew_locations",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const newPing = payload.new as LocationPing;
          setLocations((prev) => {
            // Replace stale pings for the same user/truck with this newer one
            const filtered = prev.filter(
              (p) => p.user_id !== newPing.user_id || (p.truck_id && p.truck_id !== newPing.truck_id)
            );
            return [...filtered, newPing as EnrichedLocation];
          });
          // After a short delay, enrich the new ping with names
          setTimeout(() => {
            supabase
              .from("crew_locations")
              .select(
                `id, company_id, user_id, truck_id, latitude, longitude, accuracy_m, speed_mps, heading, recorded_at, created_at,
                profiles:user_id(full_name),
                trucks:truck_id(name, vehicle_id)`
              )
              .eq("id", newPing.id)
              .single()
              .then(({ data }) => {
                if (!data) return;
                setLocations((prev) =>
                  prev.map((p) => (p.id === newPing.id ? (data as EnrichedLocation) : p))
                );
              });
          }, 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, fetchLocations]);

  return { locations, loading, error, refresh: fetchLocations };
}
