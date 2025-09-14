export interface Mic {
    micId: string;
    lat: number;
    lng: number;
    distanceToGunshot?: number; // in meters
    soundTravelTime?: number; // in seconds
}

export interface Gunshot {
  id: string;
  lng: number;
  lat: number;
  t: number; // epoch ms
  // confidence: number; // 0 to 1
  // errorEllipseRadius?: number; // meters
  // classification?: "gunshot" | "firework" | "car_alarm" | "unknown";
  // audioUrl?: string;
  // contributingMics: Mic[];
}

// export interface Building {
//   id: string;
//   lng: number;
//   lat: number; 
//   address: string;
//   distanceM: number; // distance from the gunshot
//   phone?: string;
//   email?: string;
//   camProb: number; // 0 to 1
//   camExplain?: string;
// }
  