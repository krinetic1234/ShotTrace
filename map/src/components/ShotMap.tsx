import { useMemo, useState } from "react";
import Map, { Marker, NavigationControl, ScaleControl, Source, Layer } from "react-map-gl/maplibre";
import type { Gunshot, Mic } from "../types";
import { useBuildings } from "../hooks/useBuildings";
import Sidebar, { type SelectedItem } from "./Sidebar";
import MenuBar from "./MenuBar";
import "./ShotMap.css";

interface ShotMapProps {
  mics: Mic[];
  gunshot: Gunshot | null;
}

const DEFAULT_ZOOM = 15;

// Calculate distance between two points in meters using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lng2-lng1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Generate circle geometry for a given center and radius
function createCircleGeoJSON(centerLng: number, centerLat: number, radiusMeters: number) {
  const points = 64;
  const coordinates = [];
  
  for (let i = 0; i <= points; i++) {
    const angle = (i * 360 / points) * Math.PI / 180;
    // Convert radius from meters to degrees (approximate)
    const radiusDegrees = radiusMeters / 111320; // 1 degree ≈ 111320 meters
    const lng = centerLng + radiusDegrees * Math.cos(angle);
    const lat = centerLat + radiusDegrees * Math.sin(angle);
    coordinates.push([lng, lat]);
  }
  
  return {
    type: 'Feature' as const,
    geometry: {
      type: 'Polygon' as const,
      coordinates: [coordinates]
    }
  };
}

export default function ShotMap({ mics, gunshot }: ShotMapProps) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [buildingCount, setBuildingCount] = useState(20);
  
  const { places } = useBuildings(
    gunshot ? { lat: gunshot.lat, lng: gunshot.lng } : null,
    buildingCount
  );

  // Create triangulation circles when gunshot exists
  const triangulationCircles = useMemo(() => {
    if (!gunshot) return [];
    
    return mics.map((mic, index) => {
      const distance = calculateDistance(mic.lat, mic.lng, gunshot.lat, gunshot.lng);
      const circleGeoJSON = createCircleGeoJSON(mic.lng, mic.lat, distance);
      
      return {
        id: `triangulation-circle-${mic.micId}`,
        data: {
          type: 'FeatureCollection',
          features: [circleGeoJSON]
        },
        micId: mic.micId,
        distance: distance,
        color: `hsl(${210 + index * 30}, 70%, 50%)` // Different shades of blue
      };
    });
  }, [mics, gunshot]);

  const initialViewState = useMemo(() => {
    if (gunshot) {
      return { longitude: gunshot.lng, latitude: gunshot.lat, zoom: DEFAULT_ZOOM };
    } else {
      // Use mic 2 as default view
      const mic2 = mics.find(mic => mic.micId === '2')!;
      return { longitude: mic2.lng, latitude: mic2.lat, zoom: DEFAULT_ZOOM };
    }
  }, [gunshot, mics]);

  return (
    <div className="shotmap-root">
      <MenuBar 
        buildingCount={buildingCount}
        onBuildingCountChange={setBuildingCount}
      />
      <Map 
        initialViewState={initialViewState} 
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" 
        reuseMaps
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-left" />
        <ScaleControl position="bottom-left" />

        {/* Gunshot marker - only show if gunshot exists */}
        {gunshot && (
          <Marker longitude={gunshot.lng} latitude={gunshot.lat} anchor="bottom">
            <div className="marker-gunshot-container">
              <div 
                className="marker-gunshot clickable" 
                title={`Gunshot ${new Date(gunshot.t).toLocaleString()}`}
                onClick={() => setSelectedItem({ type: 'gunshot', data: gunshot })}
              />
            </div>
          </Marker>
        )}

        {/* Microphones */}
        {mics.map((mic) => (
          <Marker key={mic.micId} longitude={mic.lng} latitude={mic.lat} anchor="bottom">
            <div 
              className="marker-mic clickable" 
              title={`Mic ${mic.micId}`}
              onClick={() => setSelectedItem({ type: 'mic', data: mic })}
            />
          </Marker>
        ))}

        {/* Nearest buildings */}
        {places.map((p) => (
          <Marker
            key={p.place_id}
            longitude={p.geometry.location.lng}
            latitude={p.geometry.location.lat}
            anchor="bottom"
          >
            <div 
              className="marker-place clickable" 
              title={`${p.name || 'Building'} - ${p.formatted_address}`}
              onClick={() => setSelectedItem({ type: 'building', data: p })}
            />
          </Marker>
        ))}
      </Map>
      <Sidebar 
        selectedItem={selectedItem} 
        onClose={() => setSelectedItem(null)} 
      />
    </div>
  );
}
