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

interface Place {
    formatted_address: string;
    geometry: {
      location: { lat: number; lng: number };
    };
    place_id: string;
}
interface GoogleGeocodeResponse {
    results: Array<Place>;
  status: "OK" | "ZERO_RESULTS" | "OVER_DAILY_LIMIT" | "REQUEST_DENIED" | "INVALID_REQUEST" | string;
}

export default function ShotMap({ mics, gunshot }: ShotMapProps) {
  const [places, setPlaces] = useState<Place[]>([]);
  const initialViewState = useMemo(
    () => ({
      longitude: gunshot.lng,
      latitude: gunshot.lat,
      zoom: DEFAULT_ZOOM,
    }),
    [gunshot.lng, gunshot.lat]
  );
  console.log("places", places);

  // Only run fetch once when gunshot changes
  useEffect(() => {
    if (!API_KEY) {
      console.warn("No Google Maps API key found in VITE_GOOGLE_MAPS_API_KEY");
      return;
    }

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${gunshot.lat},${gunshot.lng}&key=${API_KEY}`;
    console.log("Testing Google Maps API with:", url);

    fetch(url)
      .then((res) => res.json() as Promise<GoogleGeocodeResponse>)
      .then((data) => {
        if (data.status === "OK") {
          setPlaces(data.results);
        } else {
          console.error(`❌ API error: ${data.status}`, data);
        }
      })
      .catch((err: unknown) => console.error("❌ Network error:", err));
  }, [gunshot.lat, gunshot.lng]);

  return (
    <div className="shotmap-root">
      <Map
        initialViewState={initialViewState}
        mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
        reuseMaps
      >
        <NavigationControl position="top-left" />
        <ScaleControl position="bottom-left" />

        {/* Gunshot marker */}
        <Marker longitude={gunshot.lng} latitude={gunshot.lat} anchor="bottom">
          <div
            className="marker-gunshot"
            title={`Gunshot ${new Date(gunshot.t).toLocaleString()}`}
          />
        </Marker>

        {/* Microphone markers */}
        {mics.map((mic) => (
          <Marker
            key={mic.micId}
            longitude={mic.lng}
            latitude={mic.lat}
            anchor="bottom"
          >
            <div className="marker-mic" title={`Mic ${mic.micId}`} />
          </Marker>
        ))}
      </Map>
    </div>
  );
}
