// osm.ts
import type { Place } from "../types/places";

// Compose a readable address from OSM tags (best-effort)
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

type OverpassResponse = {
  elements: Array<OSMNode | OSMWay | OSMRelation>;
};

/**
 * Fetch buildings around a point from OSM/Overpass
 * and return them as Google-Places-shaped Place[].
 *
 * @param location { lat, lng }
 * @param radiusMeters e.g. 200
 * @param opts
 *  - kinds: restrict to building types (e.g., ["house","residential","apartments"])
 *  - apiPath: your server route that proxies to Overpass (recommended)
 *  - maxResults: cap results after mapping
 */
export async function fetchOSMBuildingsAsPlaces(
  location: { lat: number; lng: number },
  radiusMeters = 200,
  opts: {
    kinds?: string[];
    apiPath?: string; // e.g. "/api/osm/overpass"
    maxResults?: number;
  } = {}
): Promise<Place[]> {
  const { kinds = ["house", "residential", "apartments", "detached", "semidetached_house", "terrace"], apiPath = "/api/osm/overpass", maxResults = 200 } = opts;

  const { lat, lng } = location;
  const r = Math.max(1, Math.floor(radiusMeters));

  // Overpass QL: buildings within radius, return center + tags for light payload
  const query = `
[out:json][timeout:25];
(
  node["building"](around:${r},${lat},${lng});
  way["building"](around:${r},${lat},${lng});
  relation["building"](around:${r},${lat},${lng});
);
out center tags;
`;

  // Call your backend proxy (recommended to avoid CORS/quota issues)
  const res = await fetch(apiPath, {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: query,
  });

  if (!res.ok) {
    throw new Error(`Overpass proxy failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as OverpassResponse;
  const seen = new Set<string>();
  const places: Place[] = [];

  for (const el of data.elements ?? []) {
    const tags = (el as any).tags || {};
    const buildingType = tags["building"];

    // If restricting to kinds, skip others
    if (kinds.length && buildingType && !kinds.includes(buildingType)) {
      // allow; comment out the following 'continue' to include all building types
      // continue;
    }

    let latLng: { lat: number; lng: number } | null = null;
    let idStr = "";

    if (el.type === "node") {
      latLng = { lat: (el as OSMNode).lat, lng: (el as OSMNode).lon };
      idStr = `osm:node:${el.id}`;
    } else if (el.type === "way") {
      const c = (el as OSMWay).center;
      if (c) latLng = { lat: c.lat, lng: c.lon };
      idStr = `osm:way:${el.id}`;
    } else if (el.type === "relation") {
      const c = (el as OSMRelation).center;
      if (c) latLng = { lat: c.lat, lng: c.lon };
      idStr = `osm:relation:${el.id}`;
    }

    if (!latLng) continue;
    if (seen.has(idStr)) continue;
    seen.add(idStr);

    const formatted_address = formatOSMAddress(tags);

    const place: Place = {
      formatted_address,
      geometry: { location: latLng },
      place_id: idStr,
      types: ["building", buildingType ? `building:${buildingType}` : "building:unknown"],
    };

    places.push(place);
    if (places.length >= maxResults) break;
  }

  // Optional: sort by distance to match your Google path
  places.sort((a, b) => {
    const d = (p: Place) => {
      const dx = p.geometry.location.lat - lat;
      const dy = p.geometry.location.lng - lng;
      // planar rank is fine for ordering; you already have haversine if you prefer exact
      return dx * dx + dy * dy;
    };
    return d(a) - d(b);
  });

  return places;
}
