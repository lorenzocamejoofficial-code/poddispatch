/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useCrewLocations } from "@/hooks/useCrewLocations";
import { useTruckTripStatus, type TruckTripStatus } from "@/hooks/useTruckTripStatus";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, RefreshCw, Truck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface MapMarker {
  id: string;
  userId: string;
  name: string;
  label: string;
  lat: number;
  lng: number;
  recordedAt: string;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  trail: google.maps.LatLngLiteral[];
  stale: boolean;
  truckId: string | null;
  run: TruckTripStatus | null;
}

/** Same status vocabulary the Dispatch Board uses, mapped to map colors. */
const STATUS_COLORS: Record<string, string> = {
  gray: "#94A3B8",
  amber: "#F59E0B",
  blue: "#3B82F6",
  green: "#22C55E",
};

/** A unit is "live" if it pinged within the last 5 minutes. */
const LIVE_WINDOW_MS = 5 * 60_000;

export default function FleetMap() {
  const { activeCompanyId } = useAuth();
  const { ready, error: mapError, google } = useGoogleMaps();
  const { locations, loading, error: feedError, refresh } = useCrewLocations(activeCompanyId);
  const { byTruck, refresh: refreshRuns } = useTruckTripStatus(activeCompanyId);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const trailsRef = useRef<Map<string, google.maps.Polyline>>(new Map());
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [addressState, setAddressState] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const geocodeCacheRef = useRef<Map<string, string>>(new Map());
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  // Re-render periodically so "last seen" and stale styling stay accurate
  // even when no new pings arrive.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Group pings by user/truck and build markers + trails
  const markers: MapMarker[] = [];
  const grouped = new Map<string, EnrichedLocation[]>();
  for (const ping of locations) {
    const key = ping.truck_id ?? ping.user_id;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(ping);
  }
  for (const [key, pings] of grouped) {
    const sorted = [...pings].sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());
    const latest = sorted[sorted.length - 1];
    const name =
      latest.truck?.name ??
      latest.truck?.vehicle_id ??
      latest.profile?.full_name ??
      "Unknown";
    const label = latest.truck ? `Truck ${latest.truck.vehicle_id || latest.truck.name || "—"}` : latest.profile?.full_name || "Crew";
    markers.push({
      id: key,
      userId: latest.user_id,
      name,
      label,
      lat: latest.latitude,
      lng: latest.longitude,
      recordedAt: latest.recorded_at,
      accuracy: latest.accuracy_m,
      speed: latest.speed_mps,
      heading: latest.heading,
      trail: sorted.map((p) => ({ lat: p.latitude, lng: p.longitude })),
      stale: Date.now() - new Date(latest.recorded_at).getTime() > LIVE_WINDOW_MS,
      truckId: latest.truck_id,
      run: latest.truck_id ? byTruck[latest.truck_id] ?? null : null,
    });
  }
  // Live units first, then most recently seen.
  markers.sort((a, b) =>
    Number(a.stale) - Number(b.stale) ||
    new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
  );

  // Initialize map
  useEffect(() => {
    if (!ready || !mapRef.current || !google) return;
    if (mapInstanceRef.current) return;

    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 33.749, lng: -84.388 }, // Atlanta default
      zoom: 10,
      mapTypeId: "roadmap",
      fullscreenControl: false,
      streetViewControl: false,
    });
    mapInstanceRef.current = map;
  }, [ready, google]);

  // Reverse-geocode the selected unit's position into a street address.
  // Keyed on rounded coordinates + cached, so re-renders and 30s refreshes
  // don't restart the lookup and leave the card stuck on "Locating…".
  const geoKey = selected ? `${selected.lat.toFixed(4)},${selected.lng.toFixed(4)}` : null;
  useEffect(() => {
    if (!google || !geoKey || !selected) {
      setAddress(null);
      setAddressState("idle");
      return;
    }
    const cached = geocodeCacheRef.current.get(geoKey);
    if (cached) {
      setAddress(cached);
      setAddressState("done");
      return;
    }
    let cancelled = false;
    setAddress(null);
    setAddressState("loading");
    const timeout = setTimeout(() => {
      if (!cancelled) setAddressState((s) => (s === "loading" ? "failed" : s));
    }, 8000);
    try {
      if (!geocoderRef.current) geocoderRef.current = new google.maps.Geocoder();
      const geocoder = geocoderRef.current;
      geocoder.geocode({ location: { lat: selected.lat, lng: selected.lng } }, (results, status) => {
        if (cancelled) return;
        if (status === "OK" && results && results[0]) {
          geocodeCacheRef.current.set(geoKey, results[0].formatted_address);
          setAddress(results[0].formatted_address);
          setAddressState("done");
        } else {
          console.warn("Reverse geocode failed:", status);
          setAddressState("failed");
        }
      });
    } catch {
      // Geocoding unavailable for this key — fall back to coordinates.
      setAddressState("failed");
    }
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [google, geoKey]);

  // Update markers and trails
  useEffect(() => {
    if (!google || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const existingMarkers = markersRef.current;
    const existingTrails = trailsRef.current;
    const seenKeys = new Set<string>();

    for (const m of markers) {
      seenKeys.add(m.id);
      let marker = existingMarkers.get(m.id);
      const icon: google.maps.Symbol = {
        path: google.maps.SymbolPath.CIRCLE,
        fillColor: m.stale
          ? "#94A3B8"
          : STATUS_COLORS[m.run?.color ?? "blue"] ?? "#3B82F6",
        fillOpacity: m.stale ? 0.65 : 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
        scale: 10,
      };
      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position: { lat: m.lat, lng: m.lng },
          title: m.label,
          icon,
          label: {
            text: m.name.slice(0, 2).toUpperCase(),
            color: "#ffffff",
            fontSize: "10px",
            fontWeight: "bold",
          },
        });
        marker.addListener("click", () => setSelected(m));
        existingMarkers.set(m.id, marker);
      } else {
        marker.setPosition({ lat: m.lat, lng: m.lng });
        marker.setIcon(icon);
        marker.setTitle(m.run ? `${m.label} — ${m.run.label}` : m.label);
      }

      let trail = existingTrails.get(m.id);
      if (!trail) {
        trail = new google.maps.Polyline({
          map,
          path: m.trail,
          geodesic: true,
          strokeColor: m.stale ? "#94A3B8" : STATUS_COLORS[m.run?.color ?? "blue"] ?? "#3B82F6",
          strokeOpacity: m.stale ? 0.35 : 0.6,
          strokeWeight: 2,
        });
        existingTrails.set(m.id, trail);
      } else {
        trail.setPath(m.trail);
        trail.setOptions({
          strokeColor: m.stale ? "#94A3B8" : STATUS_COLORS[m.run?.color ?? "blue"] ?? "#3B82F6",
          strokeOpacity: m.stale ? 0.35 : 0.6,
        });
      }
    }

    // Remove markers/trails for users no longer reporting
    for (const key of existingMarkers.keys()) {
      if (!seenKeys.has(key)) {
        existingMarkers.get(key)!.setMap(null);
        existingMarkers.delete(key);
      }
    }
    for (const key of existingTrails.keys()) {
      if (!seenKeys.has(key)) {
        existingTrails.get(key)!.setMap(null);
        existingTrails.delete(key);
      }
    }
  }, [google, markers]);

  const error = mapError || feedError;

  return (
    <AdminLayout>
      <div className="flex h-[calc(100vh-3.5rem)] flex-col gap-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Live Fleet Map</h1>
            <p className="text-sm text-muted-foreground">
              Real-time crew and truck locations, colored by the same PCR run signals the
              Dispatch Board reads, updated every 30 seconds. Units stay on the map
              for the rest of the service day at their last known position — greyed out — if a crew
              signs out or their device sleeps.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { refresh(); refreshRuns(); }} disabled={loading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-1 gap-4 overflow-hidden">
          <Card className="relative flex-1 overflow-hidden">
            <div ref={mapRef} className="absolute inset-0 bg-muted" />
            {!ready && (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-5 w-5 animate-bounce" />
                  Loading map...
                </div>
              </div>
            )}
          </Card>

          <aside className="flex w-72 flex-col gap-3 overflow-hidden">
            <Card className="flex-1 overflow-y-auto p-3">
              <h3 className="mb-2 text-sm font-semibold text-foreground">Units ({markers.length})</h3>
              {markers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No crew locations today. Locations start reporting once a crew member assigned to a
                  truck opens the crew workspace and allows location access.
                </p>
              ) : (
                <div className="space-y-2">
                  {markers.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSelected(m)}
                      className={cn(
                        "w-full rounded-md border p-3 text-left transition-colors",
                        selected?.id === m.id ? "border-primary bg-primary/5" : "border-border hover:bg-accent"
                      )}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <Truck className={cn("h-4 w-4", m.stale ? "text-muted-foreground" : "text-primary")} />
                        {m.label}
                        <span
                          className={cn(
                            "ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                            m.stale ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                          )}
                        >
                          {m.stale ? "Last known" : "Live"}
                        </span>
                      </div>
                      {m.run && (
                        <div className="mt-1 text-xs font-medium" style={{ color: STATUS_COLORS[m.run.color] }}>
                          {m.run.label}
                          {m.run.lastSignalLabel && m.run.lastSignalAt && (
                            <span className="font-normal text-muted-foreground">
                              {" "}· {m.run.lastSignalLabel}{" "}
                              {formatDistanceToNow(new Date(m.run.lastSignalAt), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        Ping {formatDistanceToNow(new Date(m.recordedAt), { addSuffix: true })}
                      </div>
                      {m.speed !== null && m.speed !== undefined && (
                        <div className="text-xs text-muted-foreground">{Math.round(m.speed * 2.23694)} mph</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {selected && (
              <Card className="p-3">
                <h3 className="mb-2 text-sm font-semibold text-foreground">{selected.label}</h3>
                <div className="space-y-1 text-sm">
                  {selected.run && (
                    <>
                      <div className="font-medium" style={{ color: STATUS_COLORS[selected.run.color] }}>
                        {selected.run.label}
                      </div>
                      {selected.run.patientName && (
                        <div className="text-muted-foreground">Patient: {selected.run.patientName}</div>
                      )}
                      {selected.run.destination && (
                        <div className="text-muted-foreground">To: {selected.run.destination}</div>
                      )}
                      {selected.run.lastSignalLabel && selected.run.lastSignalAt && (
                        <div className="text-muted-foreground">
                          Last PCR signal: {selected.run.lastSignalLabel} ·{" "}
                          {formatDistanceToNow(new Date(selected.run.lastSignalAt), { addSuffix: true })}
                        </div>
                      )}
                    </>
                  )}
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {address ??
                        (addressState === "failed"
                          ? "Address unavailable for this location"
                          : "Locating address…")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Navigation className="h-4 w-4" />
                    {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                  </div>
                  <div className="text-muted-foreground">
                    {selected.speed !== null && selected.speed !== undefined && selected.speed > 1
                      ? `Moving · ${Math.round(selected.speed * 2.23694)} mph`
                      : "Stopped"}
                  </div>
                  <div className="text-muted-foreground">
                    Last seen: {formatDistanceToNow(new Date(selected.recordedAt), { addSuffix: true })}
                  </div>
                </div>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </AdminLayout>
  );
}

interface EnrichedLocation {
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
  profile?: { full_name: string | null } | null;
  truck?: { name: string | null; vehicle_id: string | null } | null;
}
