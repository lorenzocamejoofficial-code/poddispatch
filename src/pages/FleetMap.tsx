/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import { useCrewLocations } from "@/hooks/useCrewLocations";
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
}

export default function FleetMap() {
  const { activeCompanyId } = useAuth();
  const { ready, error: mapError, google } = useGoogleMaps();
  const { locations, loading, error: feedError, refresh } = useCrewLocations(activeCompanyId);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
  const trailsRef = useRef<Map<string, google.maps.Polyline>>(new Map());
  const [selected, setSelected] = useState<MapMarker | null>(null);

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
    });
  }

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
      if (!marker) {
        marker = new google.maps.Marker({
          map,
          position: { lat: m.lat, lng: m.lng },
          title: m.label,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: "#3B82F6",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 10,
          },
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
      }

      let trail = existingTrails.get(m.id);
      if (!trail) {
        trail = new google.maps.Polyline({
          map,
          path: m.trail,
          geodesic: true,
          strokeColor: "#3B82F6",
          strokeOpacity: 0.6,
          strokeWeight: 2,
        });
        existingTrails.set(m.id, trail);
      } else {
        trail.setPath(m.trail);
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

    // Fit bounds if we have markers and this is the first batch
    if (markers.length > 0) {
      const center = map.getCenter();
      if (center && center.lat() === 33.749 && center.lng() === -84.388) {
        const bounds = new google.maps.LatLngBounds();
        for (const m of markers) bounds.extend({ lat: m.lat, lng: m.lng });
        map.fitBounds(bounds, 60);
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
              Real-time crew and truck locations. Updates every 30 seconds.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
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
                  No crew locations in the last 30 minutes. Crew locations update when a crew member is signed into the crew workspace with location services enabled.
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
                        <Truck className="h-4 w-4 text-primary" />
                        {m.label}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(m.recordedAt), { addSuffix: true })}
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
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Navigation className="h-4 w-4" />
                    {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}
                  </div>
                  {selected.accuracy !== null && selected.accuracy !== undefined && (
                    <div className="text-muted-foreground">Accuracy: ±{Math.round(selected.accuracy)} m</div>
                  )}
                  {selected.speed !== null && selected.speed !== undefined && (
                    <div className="text-muted-foreground">Speed: {Math.round(selected.speed * 2.23694)} mph</div>
                  )}
                  {selected.heading !== null && selected.heading !== undefined && (
                    <div className="text-muted-foreground">Heading: {Math.round(selected.heading)}°</div>
                  )}
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
