import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const UPLOAD_INTERVAL_MS = 30_000; // 30 seconds
const MAX_AGE_MS = 10 * 60_000; // ignore stale positions > 10 min

export function useCrewLocationTracking(enabled: boolean) {
  const lastUploadRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) return;

    let watchId: number | null = null;
    let latestPosition: GeolocationPosition | null = null;

    const uploadLatest = async () => {
      if (!latestPosition) return;
      const now = Date.now();
      if (now - latestPosition.timestamp > MAX_AGE_MS) return;
      if (now - lastUploadRef.current < UPLOAD_INTERVAL_MS) return;

      const { latitude, longitude, accuracy, speed, heading } = latestPosition.coords;
      const { error: companyError } = await supabase.rpc("get_my_company_id");
      if (companyError) return;

      const companyId = await supabase.rpc("get_my_company_id").then(({ data }) => data as string | null);
      if (!companyId) return;

      const { error: insertError } = await supabase.from("crew_locations").insert({
        company_id: companyId,
        latitude,
        longitude,
        accuracy_m: accuracy || null,
        speed_mps: speed || null,
        heading: heading || null,
      });

      if (!insertError) {
        lastUploadRef.current = now;
      }
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        latestPosition = pos;
        uploadLatest();
      },
      (err) => {
        console.warn("Geolocation watch error:", err.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 20_000,
      }
    );

    const interval = setInterval(uploadLatest, UPLOAD_INTERVAL_MS);

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      clearInterval(interval);
    };
  }, [enabled]);
}
