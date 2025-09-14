import { useMemo } from "react";
import Map, { Marker, NavigationControl, ScaleControl } from "react-map-gl/maplibre";
import type { Gunshot, Mic } from "../types";
import "./ShotMap.css";

interface ShotMapProps {
	mics: Mic[];
	gunshot: Gunshot;
}

const DEFAULT_ZOOM = 15;

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;


export default function ShotMap({ mics, gunshot }: ShotMapProps) {
	const initialViewState = useMemo(() => ({
		longitude: gunshot.lng,
		latitude: gunshot.lat,
		zoom: DEFAULT_ZOOM,
	}), [gunshot.lng, gunshot.lat]);

        // Reverse geocode Times Square
        console.log(API_KEY);
        fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=40.758,-73.9855&key=${API_KEY}`
        )
        .then((res) => res.json())
        .then((data) => console.log("✅ API works:", data))
        .catch((err) => console.error("❌ Error:", err));


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
					<div className="marker-gunshot" title={`Gunshot ${new Date(gunshot.t).toLocaleString()}`} />
				</Marker>

				{/* Microphone markers */}
				{mics.map((mic) => (
					<Marker key={mic.micId} longitude={mic.lng} latitude={mic.lat} anchor="bottom">
						<div className="marker-mic" title={`Mic ${mic.micId}`} />
					</Marker>
				))}
			</Map>
		</div>
	);
}