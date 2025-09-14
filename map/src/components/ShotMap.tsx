import { useMemo, useState } from "react";
import Map, { Marker, NavigationControl, ScaleControl } from "react-map-gl/maplibre";
import type { Gunshot, Mic } from "../types";
import { useBuildings } from "../hooks/useBuildings";
import Sidebar, { type SelectedItem } from "./Sidebar";
import "./ShotMap.css";

interface ShotMapProps {
  mics: Mic[];
  gunshot: Gunshot | null;
}

const DEFAULT_ZOOM = 15;

export default function ShotMap({ mics, gunshot }: ShotMapProps) {
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  
  const { places } = useBuildings(
    gunshot ? { lat: gunshot.lat, lng: gunshot.lng } : null,
    20
  );

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
            <div 
              className="marker-gunshot clickable" 
              title={`Gunshot ${new Date(gunshot.t).toLocaleString()}`}
              onClick={() => setSelectedItem({ type: 'gunshot', data: gunshot })}
            />
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
