import { useMemo, useEffect, useState } from "react";
import Map, { Marker, NavigationControl, ScaleControl } from "react-map-gl/maplibre";
import type { Gunshot, Mic } from "../types";
import "./ShotMap.css";

interface ShotMapProps {
  mics: Mic[];
  gunshot: Gunshot;
}

const DEFAULT_ZOOM = 15;
const API_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const TOP_N = 60;

// ---- Types ----
interface Place {
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  place_id: string;
  types?: string[];
  rating?: number;
  price_level?: number;
}
interface GooglePlacesResponse {
  results: Place[];
  status: "OK" | "ZERO_RESULTS" | "OVER_DAILY_LIMIT" | "REQUEST_DENIED" | "INVALID_REQUEST" | string;
  error_message?: string;
  next_page_token?: string;
}

// ---- helpers ----
const toRad = (x: number) => (x * Math.PI) / 180;
function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
function rankPlaces(origin: { lat: number; lng: number }, results: Place[]): Place[] {
  // Unique by place_id and sort by distance
  const seen = new Set<string>();
  const ranked = results.map((r) => ({
    place: r,
    dist: haversineMeters(origin, r.geometry.location),
  }));
  ranked.sort((a, b) => a.dist - b.dist);
  const deduped: Place[] = [];
  for (const r of ranked) {
    if (!seen.has(r.place.place_id)) {
      seen.add(r.place.place_id);
      deduped.push(r.place);
    }
    if (deduped.length >= TOP_N) break;
  }
  return deduped;
}

export default function ShotMap({ mics, gunshot }: ShotMapProps) {
  const [places, setPlaces] = useState<Place[]>([]);

  const initialViewState = useMemo(
    () => ({ longitude: gunshot.lng, latitude: gunshot.lat, zoom: DEFAULT_ZOOM }),
    [gunshot.lng, gunshot.lat]
  );

  useEffect(() => {
    if (!API_KEY) {
      console.warn("No Google Maps API key found in VITE_GOOGLE_MAPS_API_KEY");
      return;
    }

    const origin = { lat: gunshot.lat, lng: gunshot.lng };
    const ac = new AbortController();

    const buildPlacesUrl = () => {
      const params = new URLSearchParams({
        location: `${origin.lat},${origin.lng}`,
        radius: "5000", // 5km radius
        type: "lodging", // This will find hotels, B&Bs, and residential accommodations
        key: API_KEY!,
      });
      return `/api/google/maps/api/place/nearbysearch/json?${params.toString()}`;
    };

    async function fetchPlaces() {
      try {
        const url = buildPlacesUrl();
        const res = await fetch(url, { signal: ac.signal });
        const data = (await res.json()) as GooglePlacesResponse;
        console.log(data);
        if (data.status === "OK") {
          const ranked = rankPlaces(origin, data.results || []);
          setPlaces(ranked);
        } else if (data.status === "OVER_DAILY_LIMIT") {
          console.error("Places API OVER_DAILY_LIMIT. Consider server-side key, quotas, or caching.", data.error_message);
          setPlaces([]);
        } else if (data.status === "REQUEST_DENIED") {
          console.error("Places API REQUEST_DENIED. Check referrer restrictions / billing.", data.error_message);
          setPlaces([]);
        } else if (data.status === "ZERO_RESULTS") {
          console.warn("No places found near the gunshot location");
          setPlaces([]);
        } else {
          console.error("Places API error:", data.status, data.error_message);
          setPlaces([]);
        }
      } catch (err) {
        if ((err as any).name !== "AbortError") {
          console.error("❌ Places API fetch failed:", err);
          setPlaces([]);
        }
      }
    }

    fetchPlaces();

    return () => ac.abort();
  }, [gunshot.lat, gunshot.lng]);

  return (
    <div className="shotmap-root">
      <Map initialViewState={initialViewState} mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" reuseMaps>
        <NavigationControl position="top-left" />
        <ScaleControl position="bottom-left" />

        {/* Gunshot marker */}
        <Marker longitude={gunshot.lng} latitude={gunshot.lat} anchor="bottom">
          <div className="marker-gunshot" title={`Gunshot ${new Date(gunshot.t).toLocaleString()}`} />
        </Marker>

        {/* Microphones */}
        {mics.map((mic) => (
          <Marker key={mic.micId} longitude={mic.lng} latitude={mic.lat} anchor="bottom">
            <div className="marker-mic" title={`Mic ${mic.micId}`} />
          </Marker>
        ))}

        {/* Nearest places */}
        {places.map((p) => (
          <Marker
            key={p.place_id}
            longitude={p.geometry.location.lng}
            latitude={p.geometry.location.lat}
            anchor="bottom"
          >
            <div className="marker-place" title={`${p.name || 'Unknown'} - ${p.formatted_address}`} />
          </Marker>
        ))}
      </Map>
    </div>
  );
}
