export interface Place {
  name: string;
  formatted_address: string;
  geometry: {
    location: { lat: number; lng: number };
  };
  place_id: string;
  types?: string[];
  rating?: number;
  price_level?: number;
}

export interface GooglePlacesResponse {
  results: Place[];
  status: "OK" | "ZERO_RESULTS" | "OVER_DAILY_LIMIT" | "REQUEST_DENIED" | "INVALID_REQUEST" | string;
  error_message?: string;
  next_page_token?: string;
}

export interface UsePlacesOptions {
  radius?: number;
  type?: string;
  maxResults?: number;
}