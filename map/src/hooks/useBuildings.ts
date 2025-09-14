import { useState, useEffect } from 'react';
import type { Place } from '../types/places';
import buildingsData from '../../buildings.json';
import { calculateHaversineDistance, generateRandomPhoneNumber } from '../utils/distanceUtils';

// OSM types matching the JSON structure - more flexible to handle real data
type OSMElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string | undefined>;
};

type OSMResponse = {
  elements: OSMElement[];
};

// Helper function to format OSM address from tags
function formatOSMAddress(tags: Record<string, string> = {}): string {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:neighbourhood"] || tags["addr:suburb"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"] || tags["addr:hamlet"],
    tags["addr:state"],
    tags["addr:postcode"],
    tags["addr:country"]
  ].filter(Boolean);
  
  // Fallbacks if no address tags
  if (parts.length === 0) {
    if (tags["name"]) return tags["name"];
    if (tags["building"]) return `Building (${tags["building"]})`;
    return "Building";
  }
  return parts.join(", ");
}


export function useBuildings(
  location: { lat: number; lng: number } | null,
  maxResults: number = 200
) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location) {
      setPlaces([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Process the buildings data
      const osmData = buildingsData as OSMResponse;
      const seen = new Set<string>();
      const places: Place[] = [];

      for (const element of osmData.elements ?? []) {
        const tags = element.tags || {};
        
        // Skip if not a building or if we don't have location data
        if (!tags["building"]) continue;

        let latLng: { lat: number; lng: number } | null = null;
        let idStr = "";

        if (element.type === "node" && element.lat && element.lon) {
          latLng = { lat: element.lat, lng: element.lon };
          idStr = `osm:node:${element.id}`;
        } else if (element.center) {
          latLng = { lat: element.center.lat, lng: element.center.lon };
          idStr = `osm:${element.type}:${element.id}`;
        }

        if (!latLng || seen.has(idStr)) continue;
        seen.add(idStr);

        // Filter out undefined values from tags for address formatting
        const cleanTags = Object.fromEntries(
          Object.entries(tags).filter(([_, value]) => value !== undefined) as [string, string][]
        );
        const formatted_address = formatOSMAddress(cleanTags);

        // Calculate real distance to gunshot
        const distanceToGunshot = calculateHaversineDistance(
          location.lat, location.lng,
          latLng.lat, latLng.lng
        );

        // Generate a phone number using the place ID as seed for consistency
        const phoneNumber = generateRandomPhoneNumber(idStr);

        const place: Place = {
          name: cleanTags["name"] || formatted_address,
          formatted_address,
          geometry: { location: latLng },
          place_id: idStr,
          types: ["building", tags["building"] ? `building:${tags["building"]}` : "building:unknown"],
          distanceToGunshot,
          phoneNumber,
        };

        places.push(place);
      }

      // Sort by distance from the gunshot location (using the already calculated distances)
      places.sort((a, b) => {
        return (a.distanceToGunshot || 0) - (b.distanceToGunshot || 0);
      });
      setPlaces(places.slice(0, maxResults));
    } catch (err) {
      setError(`Failed to process buildings data: ${err}`);
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [location?.lat, location?.lng, maxResults]);

  return { places, loading, error };
}