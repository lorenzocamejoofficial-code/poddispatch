import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const UPLOAD_INTERVAL_MS = 30_000; // 30 seconds
const MAX_AGE_MS = 10 * 60_000; // ignore stale positions > 10 min
const ELIGIBILITY_REFRESH_MS = 5 * 60_000; // re-check assignment/curfew every 5 min

function localDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "21:00:00" -> minutes since midnight */
function parseTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const [h, m] = value.split(":");
  const hours = Number(h);
  const mins = Number(m ?? 0);
  if (Number.isNaN(hours) || Number.isNaN(mins)) return null;
  return hours * 60 + mins;
}

/**
 * Crew GPS tracking.
 * Only runs when the signed-in user is assigned to a truck crew for TODAY,
 * and only before the company's nightly tracking curfew (if enabled).
 */
export function useCrewLocationTracking(enabled: boolean) {
  const lastUploadRef = useRef<number>(0);
  const [trackable, setTrackable] = useState(false);
  const [permission, setPermission] = useState<"unknown" | "granted" | "denied" | "prompt" | "unsupported">("unknown");

  // Watch the browser's geolocation permission state so the crew UI can
  // explain what's happening instead of silently failing.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setPermission("unsupported");
      return;
    }
    if (!navigator.permissions?.query) return;
    let status: PermissionStatus | null = null;
    let cancelled = false;
    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((s) => {
        if (cancelled) return;
        status = s;
        setPermission(s.state as "granted" | "denied" | "prompt");
        s.onchange = () => setPermission(s.state as "granted" | "denied" | "prompt");
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, []);

  /** Explicitly trigger the browser permission prompt. */
  const requestPermission = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => setPermission("granted"),
      (err) => {
        if (err.code === err.PERMISSION_DENIED) setPermission("denied");
      },
      { enableHighAccuracy: true, timeout: 20_000 }
    );
  };

  // Determine eligibility: scheduled today + within curfew window
  useEffect(() => {
    if (!enabled) {
      setTrackable(false);
      return;
    }
    let cancelled = false;

    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setTrackable(false);
        return;
      }

      const today = localDateString();
      const { data: crewRows } = await supabase
        .from("crews")
        .select("id")
        .eq("active_date", today)
        .or(`member1_id.eq.${user.id},member2_id.eq.${user.id},member3_id.eq.${user.id}`)
        .limit(1);

      const onScheduledTruck = !!crewRows && crewRows.length > 0;

      let withinCurfew = true;
      const { data: settings } = await supabase
        .from("company_settings")
        .select("tracking_curfew_enabled, tracking_curfew_time")
        .limit(1)
        .maybeSingle();

      if (settings && (settings as any).tracking_curfew_enabled) {
        const cutoff = parseTimeToMinutes((settings as any).tracking_curfew_time) ?? 21 * 60;
        const now = new Date();
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        withinCurfew = nowMinutes < cutoff;
      }

      if (!cancelled) setTrackable(onScheduledTruck && withinCurfew);
    };

    check();
    const interval = setInterval(check, ELIGIBILITY_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !trackable) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) return;

    let watchId: number | null = null;
    let latestPosition: GeolocationPosition | null = null;

    const uploadLatest = async () => {
      if (!latestPosition) return;
      const now = Date.now();
      if (now - latestPosition.timestamp > MAX_AGE_MS) return;
      if (now - lastUploadRef.current < UPLOAD_INTERVAL_MS) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: companyId, error: companyError } = await supabase.rpc("get_my_company_id");
      if (companyError || !companyId) return;

      const { latitude, longitude, accuracy, speed, heading } = latestPosition.coords;
      const { error: insertError } = await supabase.from("crew_locations").insert({
        company_id: companyId as string,
        user_id: user.id,
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
        if (err.code === err.PERMISSION_DENIED) setPermission("denied");
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
  }, [enabled, trackable]);

  return { trackable, permission, requestPermission };
}
