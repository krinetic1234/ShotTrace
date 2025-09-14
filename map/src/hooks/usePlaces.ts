import { useState, useEffect } from 'react';
import type { Place, UsePlacesOptions } from '../types/places';

const API_KEY: string | undefined = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

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

function rankPlaces(origin: { lat: number; lng: number }, results: Place[], maxResults: number): Place[] {
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
    if (deduped.length >= maxResults) break;
  }
  return deduped;
}

export function usePlaces(
  location: { lat: number; lng: number } | null,
  options: UsePlacesOptions = {}
) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    radius = .05, // 500m radius
    type = "lodging",
    maxResults = 60,
  } = options;

  useEffect(() => {
    if (!location) {
      setPlaces([]);
      return;
    }

    if (!API_KEY) {
      setError("No Google Maps API key found in VITE_GOOGLE_MAPS_API_KEY");
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    const buildPlacesUrl = () => {
      const params = new URLSearchParams({
        location: `${location.lat},${location.lng}`,
        radius: radius.toString(),
        type,
        key: API_KEY!,
      });
      return `/api/google/maps/api/place/nearbysearch/json?${params.toString()}`;
    };

    async function fetchPlaces() {
      try {
        const url = buildPlacesUrl();
        const res = await fetch(url, { signal: ac.signal });
        const data = await res.json();

        console.log(data);
        
        if (data.status === "OK") {
          if (!location) {
              setError("No location found");
              setPlaces([]);
              return;
          }
          const ranked = rankPlaces(location, data.results || [], maxResults);
          setPlaces(ranked);
        } else if (data.status === "OVER_DAILY_LIMIT") {
          setError("Places API OVER_DAILY_LIMIT. Consider server-side key, quotas, or caching.");
          setPlaces([]);
        } else if (data.status === "REQUEST_DENIED") {
          setError("Places API REQUEST_DENIED. Check referrer restrictions / billing.");
          setPlaces([]);
        } else if (data.status === "ZERO_RESULTS") {
          setError("No places found near the specified location");
          setPlaces([]);
        } else {
          setError(`Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
          setPlaces([]);
        }
      } catch (err) {
        if ((err as any).name !== "AbortError") {
          setError(`❌ Places API fetch failed: ${err}`);
          setPlaces([]);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPlaces();

    return () => ac.abort();
  }, [location?.lat, location?.lng, radius, type, maxResults]);

  return { places, loading, error };
}