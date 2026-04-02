import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_PREFIX = "pd_crew_badge_seen_";

function getSeenKey(profileId: string, tab: string) {
  return `${STORAGE_PREFIX}${profileId}_${tab}`;
}

function getLastSeen(profileId: string, tab: string): string {
  return localStorage.getItem(getSeenKey(profileId, tab)) || new Date(0).toISOString();
}

function markSeen(profileId: string, tab: string) {
  localStorage.setItem(getSeenKey(profileId, tab), new Date().toISOString());
}

interface CrewBadges {
  dashboard: boolean;
  schedule: boolean;
  pcr: boolean;
  checklist: boolean;
}

/**
 * Monitors realtime changes for the crew's truck today and exposes
 * notification badges per tab. Badges clear when the user visits the tab.
 */
export function useCrewBadges(profileId: string | null): CrewBadges {
  const location = useLocation();
  const [badges, setBadges] = useState<CrewBadges>({ dashboard: false, schedule: false, pcr: false });
  const truckIdRef = useRef<string | null>(null);
  const todayRef = useRef<string>("");
  const profileIdRef = useRef(profileId);
  profileIdRef.current = profileId;

  // Resolve today's date once
  const today = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();
  todayRef.current = today;

  // Check for unseen changes by comparing updated_at timestamps against last-seen
  const checkForChanges = useCallback(async (truckId: string, pid: string) => {
    const dashSeen = getLastSeen(pid, "dashboard");
    const schedSeen = getLastSeen(pid, "schedule");
    const pcrSeen = getLastSeen(pid, "pcr");
    const currentToday = todayRef.current;

    // Check trip_records for changes (affects all 3 tabs)
    const [
      { count: dashTripCount },
      { count: schedSlotCount },
      { count: pcrKickbackCount },
      { count: pcrTripCount },
    ] = await Promise.all([
      // Dashboard: any trip updated after last dashboard visit
      supabase
        .from("trip_records")
        .select("id", { count: "exact", head: true })
        .eq("run_date", currentToday)
        .eq("truck_id", truckId)
        .gt("updated_at", dashSeen),
      // Schedule: any slot changes (we check scheduling_legs updated after last schedule visit)
      supabase
        .from("truck_run_slots")
        .select("id", { count: "exact", head: true })
        .eq("run_date", currentToday)
        .eq("truck_id", truckId)
        .gt("created_at", schedSeen),
      // PCR: kickbacks
      supabase
        .from("trip_records")
        .select("id", { count: "exact", head: true })
        .eq("run_date", currentToday)
        .eq("truck_id", truckId)
        .eq("pcr_status", "kicked_back"),
      // PCR: new trips added after last PCR visit
      supabase
        .from("trip_records")
        .select("id", { count: "exact", head: true })
        .eq("run_date", currentToday)
        .eq("truck_id", truckId)
        .gt("created_at", pcrSeen),
    ]);

    setBadges({
      dashboard: (dashTripCount ?? 0) > 0,
      schedule: (schedSlotCount ?? 0) > 0,
      pcr: (pcrKickbackCount ?? 0) > 0 || (pcrTripCount ?? 0) > 0,
    });
  }, []);

  // Initial load: find crew's truck, then check
  useEffect(() => {
    if (!profileId) return;

    let cancelled = false;

    (async () => {
      const { data: crewRow } = await supabase
        .from("crews")
        .select("truck_id")
        .eq("active_date", today)
        .or(`member1_id.eq.${profileId},member2_id.eq.${profileId},member3_id.eq.${profileId}`)
        .maybeSingle();

      if (cancelled || !crewRow) return;
      truckIdRef.current = crewRow.truck_id;
      await checkForChanges(crewRow.truck_id, profileId);
    })();

    return () => { cancelled = true; };
  }, [profileId, today, checkForChanges]);

  // Realtime: subscribe to trip_records and truck_run_slots changes
  useEffect(() => {
    if (!profileId) return;

    // We subscribe to all trip_records changes and filter in the handler
    const channel = supabase
      .channel("crew-badges")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_records" },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (!row || !truckIdRef.current) return;
          if (row.truck_id !== truckIdRef.current) return;
          if (row.run_date !== todayRef.current) return;
          // A change happened — recheck
          if (truckIdRef.current && profileIdRef.current) {
            checkForChanges(truckIdRef.current, profileIdRef.current);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "truck_run_slots" },
        (payload) => {
          const row = (payload.new || payload.old) as any;
          if (!row || !truckIdRef.current) return;
          if (row.truck_id !== truckIdRef.current) return;
          if (row.run_date !== todayRef.current) return;
          if (truckIdRef.current && profileIdRef.current) {
            checkForChanges(truckIdRef.current, profileIdRef.current);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profileId, checkForChanges]);

  // Clear badge when visiting the corresponding tab
  useEffect(() => {
    if (!profileId) return;

    const path = location.pathname;
    let tabKey: string | null = null;

    if (path === "/crew-dashboard") tabKey = "dashboard";
    else if (path === "/crew-schedule") tabKey = "schedule";
    else if (path === "/pcr") tabKey = "pcr";

    if (tabKey) {
      markSeen(profileId, tabKey);
      // Re-check after marking seen so badge clears
      if (truckIdRef.current) {
        checkForChanges(truckIdRef.current, profileId);
      }
    }
  }, [location.pathname, profileId, checkForChanges]);

  return badges;
}
