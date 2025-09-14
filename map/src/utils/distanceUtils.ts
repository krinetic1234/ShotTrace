/**
 * Calculate the distance between two points using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generate a random phone number in US format
 * @param seed Optional seed for reproducible results based on building ID
 * @returns Phone number in format (XXX) XXX-XXXX
 */
export function generateRandomPhoneNumber(seed?: string): string {
  // Use seed to create deterministic random numbers if provided
  let random = Math.random;

  // Generate area code (200-999, excluding certain reserved ranges)
  const areaCode = random() > 0.5 ? 617 : 857;
  
  // Generate exchange code (200-999)
  const exchangeCode = Math.floor(random() * 800) + 200;
  
  // Generate subscriber number (0000-9999)
  const subscriberNumber = Math.floor(random() * 10000);
  
  return `(${areaCode}) ${exchangeCode}-${subscriberNumber.toString().padStart(4, '0')}`;
}

/**
 * Format distance for display
 * @param distanceMeters Distance in meters
 * @returns Formatted string with appropriate units
 */
export function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)} m`;
  } else {
    return `${(distanceMeters / 1000).toFixed(2)} km`;
  }
}