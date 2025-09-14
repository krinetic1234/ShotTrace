export interface Place {
  name?: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  place_id: string;
  types?: string[];
  distanceToGunshot?: number; // in meters
  phoneNumber?: string;
}