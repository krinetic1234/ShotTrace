import { useMemo } from "react";
import Map, { Marker, NavigationControl, ScaleControl } from "react-map-gl/maplibre";
import type { Gunshot, Mic } from "../types";
import { useBuildings } from "../hooks/useBuildings";
import "./ShotMap.css";

interface ShotMapProps {
  mics: Mic[];
  gunshot: Gunshot | null;
}

const DEFAULT_ZOOM = 15;

export default function ShotMap({ mics, gunshot }: ShotMapProps) {
  const { places, loading, error } = useBuildings(
    gunshot ? { lat: gunshot.lat, lng: gunshot.lng } : null,
    60
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
      <Map initialViewState={initialViewState} mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" reuseMaps>
        <NavigationControl position="top-left" />
        <ScaleControl position="bottom-left" />

        {/* Gunshot marker - only show if gunshot exists */}
        {gunshot && (
          <Marker longitude={gunshot.lng} latitude={gunshot.lat} anchor="bottom">
            <div className="marker-gunshot" title={`Gunshot ${new Date(gunshot.t).toLocaleString()}`} />
          </Marker>
        )}

        {/* Microphones */}
        {mics.map((mic) => (
          <Marker key={mic.micId} longitude={mic.lng} latitude={mic.lat} anchor="bottom">
            <div className="marker-mic" title={`Mic ${mic.micId}`} />
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
            <div className="marker-place" title={`${p.name || 'Building'} - ${p.formatted_address}`} />
          </Marker>
        ))}
      </Map>

      {/* Debug info */}
        <div className="places-list">
          {loading && <div>Loading buildings...</div>}
          {error && <div className="error">Error: {error}</div>}
          {places.map((p) => (
            <div key={p.place_id}>
              <strong>{p.name || 'Building'}</strong> - {p.formatted_address}
              {p.types && p.types.length > 1 && ` • Type: ${p.types[1]}`}
            </div>
          ))}
        </div>
    </div>
  );
}
