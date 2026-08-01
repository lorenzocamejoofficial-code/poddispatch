/// <reference types="google.maps" />

import { useEffect, useRef, useState } from "react";

let loaderPromise: Promise<typeof google> | null = null;

function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  if (window.google?.maps) return Promise.resolve(window.google);

  if (!loaderPromise) {
    loaderPromise = new Promise((resolve, reject) => {
      // The Lovable-managed key is referrer-locked to *.lovable.app /
      // *.lovableproject.com; our own key is locked to thepoddispatch.com.
      // Pick whichever matches the host we're actually running on.
      const host = window.location.hostname;
      const isLovableHost =
        host.endsWith(".lovable.app") ||
        host.endsWith(".lovableproject.com") ||
        host === "localhost";
      const ownKey = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY;
      const managedKey = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
      const key = isLovableHost ? managedKey || ownKey : ownKey || managedKey;
      const channel = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
      if (!key) {
        reject(new Error("Google Maps browser key is not configured"));
        return;
      }

      const scriptId = "google-maps-script";
      if (document.getElementById(scriptId)) {
        // If the script tag exists but maps isn't ready yet, wait for callback.
        return;
      }

      (window as any).initPoddispatchMap = () => {
        resolve(window.google);
      };

      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async&callback=initPoddispatchMap${
        channel ? `&channel=${channel}` : ""
      }`;
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load Google Maps script"));
      document.head.appendChild(script);
    });
  }

  return loaderPromise;
}

export function useGoogleMaps() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const googleRef = useRef<typeof google | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps()
      .then((g) => {
        if (!cancelled) {
          googleRef.current = g;
          setReady(true);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Google Maps failed to load");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { ready, error, google: googleRef.current };
}
