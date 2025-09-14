export interface Place {
  name?: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  place_id: string;
  types?: string[];
}