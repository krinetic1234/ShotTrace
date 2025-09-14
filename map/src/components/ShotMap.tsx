import { useMemo, useState } from "react";
import Map, { Marker, NavigationControl, ScaleControl, Source, Layer } from "react-map-gl/maplibre";
import type { Gunshot, Mic } from "../types";
import type { Place } from "../types/places";
import { useBuildings } from "../hooks/useBuildings";
import Sidebar, { type SelectedItem } from "./Sidebar";
import MenuBar from "./MenuBar";
import { sendCall } from "../utils/phoneCall";
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

// Generate circle geometry for a given center and radius using proper projection
function createCircleGeoJSON(centerLng: number, centerLat: number, radiusMeters: number) {
  const points = 64;
  const coordinates: number[][] = [];
  
  // Earth's radius in meters
  const R = 6371000;
  
  // Convert center to radians
  const centerLatRad = centerLat * Math.PI / 180;
  const centerLngRad = centerLng * Math.PI / 180;
  
  for (let i = 0; i <= points; i++) {
    const bearing = (i * 360 / points) * Math.PI / 180;
    
    // Calculate point at distance and bearing from center using spherical geometry
    const lat2 = Math.asin(
      Math.sin(centerLatRad) * Math.cos(radiusMeters / R) +
      Math.cos(centerLatRad) * Math.sin(radiusMeters / R) * Math.cos(bearing)
    );
    
    const lng2 = centerLngRad + Math.atan2(
      Math.sin(bearing) * Math.sin(radiusMeters / R) * Math.cos(centerLatRad),
      Math.cos(radiusMeters / R) - Math.sin(centerLatRad) * Math.sin(lat2)
    );
    
    // Convert back to degrees
    const lat = lat2 * 180 / Math.PI;
    const lng = lng2 * 180 / Math.PI;
    
    coordinates.push([lng, lat]);
  }
  
  return {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [coordinates]
      },
      properties: {}
    }]
  };
}

export default function ShotMap({ mics, gunshot }: ShotMapProps) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const [buildingCount, setBuildingCount] = useState(20);
  const [showSoundRadius, setShowSoundRadius] = useState(true);
  
  const { places } = useBuildings(
    gunshot ? { lat: gunshot.lat, lng: gunshot.lng } : null,
    buildingCount
  );

  // Handler for requesting camera footage from a single building
  const handleRequestCameraFootage = async (building: Place) => {
    const message = `Camera footage requested from:\n\nAddress: ${building.formatted_address}\nPhone: ${building.phoneNumber}\nDistance: ${building.distanceToGunshot ? (building.distanceToGunshot / 1000).toFixed(2) + ' km' : 'Unknown'}\n\nInitiating call...`;
    alert(message);

    try {
      const result = await sendCall({
        to: "+16508627094",
        buildingAddress: building.formatted_address,
        distanceToGunshot: String(building.distanceToGunshot) || "51 meters",
        timestamp: "2025-09-14 05:30 AM",
      });
      console.log('Call initiated successfully:', result);
    } catch (error) {
      console.error('Failed to initiate call:', error);
    }
  };

  // Handler for requesting camera footage from all nearby buildings
  const handleRequestAllFootage = async () => {
    if (places.length === 0) {
      alert('No nearby buildings found to request footage from.');
      return;
    }

    // Show first 10 in the alert message for readability, but process all buildings
    const buildingListPreview = places.slice(0, 10).map((place, index) => 
      `${index + 1}. ${place.formatted_address} (${place.phoneNumber}) - ${place.distanceToGunshot ? (place.distanceToGunshot / 1000).toFixed(2) + ' km' : 'Unknown distance'}`
    ).join('\n');

    const message = `Camera footage requested from ${places.length} displayed buildings:\n\n${buildingListPreview}${places.length > 10 ? `\n\n...and ${places.length - 10} more buildings` : ''}`;
    alert(message);
    const team_phones = ["6508627094", "9255499121", "9253754071", "4084316300"] // sophia, shubham, john, krish 

    try {
      for (let i = 0; i < team_phones.length; i++) {
        // Wait 1 second before making the next call
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const result = await sendCall({
          to: "+1" + team_phones[i],
          buildingAddress: places[i].formatted_address,
          distanceToGunshot: String(places[i].distanceToGunshot) || "51 meters",
          timestamp: "2025-09-14 05:30 AM",
        });
        console.log('Call initiated successfully:', result);
      }
    } catch (error) {
      console.error('Failed to initiate call:', error);
    }
  };

  // Create triangulation circles when gunshot exists
  const triangulationCircles = useMemo(() => {
    if (!gunshot) return [];
    
    // Speed of sound in air at 20°C (68°F) in meters per second
    const SPEED_OF_SOUND = 343; // m/s
    
    return mics.map((mic, index) => {
      const distance = calculateDistance(mic.lat, mic.lng, gunshot.lat, gunshot.lng);
      const travelTime = distance / SPEED_OF_SOUND; // time in seconds
      const circleGeoJSON = createCircleGeoJSON(mic.lng, mic.lat, distance);
      
      return {
        id: `triangulation-circle-${mic.micId}`,
        data: circleGeoJSON,
        micId: mic.micId,
        distance: distance,
        travelTime: travelTime,
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
      {gunshot && (
        <MenuBar 
          buildingCount={buildingCount}
          onBuildingCountChange={setBuildingCount}
          showSoundRadius={showSoundRadius}
          onToggleSoundRadius={setShowSoundRadius}
          onRequestAllFootage={handleRequestAllFootage}
        />
      )}
      <Map 
        initialViewState={initialViewState} 
        mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json" 
        reuseMaps
        style={{ width: '100%', height: '100%' }}
      >
        <ScaleControl position="bottom-left" />

        {/* Triangulation circles - only show when toggle is enabled */}
        {showSoundRadius && triangulationCircles.map((circle) => (
          <Source key={circle.id} id={circle.id} type="geojson" data={circle.data}>
            <Layer
              id={`${circle.id}-fill`}
              type="fill"
              paint={{
                'fill-color': circle.color,
                'fill-opacity': 0.1
              }}
            />
            <Layer
              id={`${circle.id}-stroke`}
              type="line"
              paint={{
                'line-color': circle.color,
                'line-width': 2,
                'line-opacity': 0.6
              }}
            />
          </Source>
        ))}

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
        {mics.map((mic) => {
          // Calculate distance and travel time if gunshot exists
          const micWithGunshot = gunshot ? {
            ...mic,
            distanceToGunshot: calculateDistance(mic.lat, mic.lng, gunshot.lat, gunshot.lng),
            soundTravelTime: calculateDistance(mic.lat, mic.lng, gunshot.lat, gunshot.lng) / 343 // Speed of sound
          } : mic;

          return (
            <Marker key={mic.micId} longitude={mic.lng} latitude={mic.lat} anchor="bottom">
              <div 
                className="marker-mic clickable" 
                title={`Mic ${mic.micId}`}
                onClick={() => setSelectedItem({ type: 'mic', data: micWithGunshot })}
              />
            </Marker>
          );
        })}

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
        onRequestCameraFootage={handleRequestCameraFootage}
      />
    </div>
  );
}
