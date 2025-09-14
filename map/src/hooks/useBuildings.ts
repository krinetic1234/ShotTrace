import { useState, useEffect } from 'react';
import type { Place } from '../types/places';
import buildingsData from '../../buildings_200m.json';

// OSM types matching the JSON structure
type OSMNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OSMWayOrRelCenter = { lat: number; lon: number };

type OSMWay = {
  type: "way";
  id: number;
  center?: OSMWayOrRelCenter;
  tags?: Record<string, string>;
};

type OSMRelation = {
  type: "relation";
  id: number;
  center?: OSMWayOrRelCenter;
  tags?: Record<string, string>;
};

type OSMResponse = {
  elements: Array<OSMNode | OSMWay | OSMRelation>;
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

// Helper function to calculate distance (simplified for sorting)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dx = lat2 - lat1;
  const dy = lon2 - lon1;
  return dx * dx + dy * dy; // Squared distance for sorting purposes
}

export function useBuildings(
  location: { lat: number; lng: number } | null,
  maxResults: number = 60
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

        if (element.type === "node") {
          latLng = { lat: (element as OSMNode).lat, lng: (element as OSMNode).lon };
          idStr = `osm:node:${element.id}`;
        } else if (element.type === "way") {
          const center = (element as OSMWay).center;
          if (center) latLng = { lat: center.lat, lng: center.lon };
          idStr = `osm:way:${element.id}`;
        } else if (element.type === "relation") {
          const center = (element as OSMRelation).center;
          if (center) latLng = { lat: center.lat, lng: center.lon };
          idStr = `osm:relation:${element.id}`;
        }

        if (!latLng || seen.has(idStr)) continue;
        seen.add(idStr);

        const formatted_address = formatOSMAddress(tags);

        const place: Place = {
          name: tags["name"] || formatted_address,
          formatted_address,
          geometry: { location: latLng },
          place_id: idStr,
          types: ["building", tags["building"] ? `building:${tags["building"]}` : "building:unknown"],
        };

        places.push(place);
        if (places.length >= maxResults) break;
      }

      // Sort by distance from the gunshot location
      places.sort((a, b) => {
        const distA = calculateDistance(
          location.lat, location.lng,
          a.geometry.location.lat, a.geometry.location.lng
        );
        const distB = calculateDistance(
          location.lat, location.lng,
          b.geometry.location.lat, b.geometry.location.lng
        );
        return distA - distB;
      });

      setPlaces(places);
    } catch (err) {
      setError(`Failed to process buildings data: ${err}`);
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, [location?.lat, location?.lng, maxResults]);

  return { places, loading, error };
}