import math
import json
import random
from typing import List, Tuple, Dict, Optional
from dataclasses import dataclass
from datetime import datetime

SPEED_OF_SOUND = 343

# Real microphone positions in Boston coordinates
BOSTON_COORDINATES = {
    '1': {'lat': 42.348665779588, 'lng': -71.08372488708355},      # reference anchor (0,0) meters
    '2': {'lat': 42.34866577958835, 'lng': -71.07566610610223},    # (1.5,0) meters → 663m east
    '3': {'lat': 42.35165470337558, 'lng': -71.07969549659289}     # (0.75,0.75) meters → 331m east, 330m north
}

def latlng_to_meters(lat1, lng1, lat2, lng2):
    """
    Convert lat/lng coordinates to local meter coordinates.
    Using simple equirectangular projection for small areas.
    Returns x (east), y (north) relative to (lat1, lng1).
    """
    lat_rad = math.radians(lat1)
    x = (lng2 - lng1) * math.cos(lat_rad) * 111320
    y = (lat2 - lat1) * 110540
    return x, y

def meters_to_latlng(lat_ref, lng_ref, x_meters, y_meters):
    """
    Convert meter coordinates back to lat/lng relative to reference point.
    """
    lat_rad = math.radians(lat_ref)
    lat_offset = y_meters / 110540
    lng_offset = x_meters / (111320 * math.cos(lat_rad))
    return lat_ref + lat_offset, lng_ref + lng_offset

def get_microphone_positions():
    """Get the real microphone positions for API responses."""
    return BOSTON_COORDINATES

@dataclass
class MicrophoneReading:
    microphone_id: str
    time_delay: float

@dataclass
class GunshotResult:
    lat: float
    lng: float
    timestamp: float
    confidence: float = 1.0

class GunshotLocalizer:

    def __init__(self):
        self.real_microphone_positions = BOSTON_COORDINATES
        
        # Define 5 predefined gunshot locations in small scale coordinates
        self.predefined_locations = [
            {"name": "1", "x": 0.25, "y": 0.2},     # Middle of triangle
            {"name": "2", "x": 0.75, "y": 0.55},       # Bit to the left
            {"name": "3", "x": 1.25, "y": 0.2},      # Bit to the right  
        ]
        
        # Calculate scaling factors for converting to Boston coordinates
        self._calculate_scaling_factors()
        
        print("Hardware simulation mode - returning predefined locations:")
        for i, loc in enumerate(self.predefined_locations):
            # Convert to Boston coordinates
            x_real = loc["x"] * self.scale_x
            y_real = loc["y"] * self.scale_y
            lat, lng = meters_to_latlng(
                self.real_microphone_positions['1']['lat'],
                self.real_microphone_positions['1']['lng'],
                x_real, y_real
            )
            print(f"  {i+1}. {loc['name']}: lat={lat:.8f}, lng={lng:.8f}")

    def _calculate_scaling_factors(self):
        """Calculate simple scaling factors from small grid to real coordinates."""
        # Get real distances in meters
        ref_coords = self.real_microphone_positions['1']
        mic2_coords = self.real_microphone_positions['2'] 
        mic3_coords = self.real_microphone_positions['3']
        
        mic2_real_x, mic2_real_y = latlng_to_meters(ref_coords['lat'], ref_coords['lng'],
                                                   mic2_coords['lat'], mic2_coords['lng'])
        mic3_real_x, mic3_real_y = latlng_to_meters(ref_coords['lat'], ref_coords['lng'],
                                                   mic3_coords['lat'], mic3_coords['lng'])
        
        # Calculate scaling factors
        self.scale_x = mic2_real_x / 1.5  # Real distance to mic 2 / small distance to mic 2
        self.scale_y = mic3_real_y / 0.75 # Real distance to mic 3 / small distance to mic 3

    def get_available_locations(self):
        """Get list of available location names for selection."""
        return [loc["name"] for loc in self.predefined_locations]

    def calculate_gunshot_location(self, readings: List[MicrophoneReading], location_name: Optional[str] = None) -> GunshotResult:
        """
        Return one of 5 predefined gunshot locations in Boston coordinates.
        
        Args:
            readings: List of microphone readings (required for API compatibility)
            location_name: Name of location to use ("Center", "Left", "Right", "Down", "Mic1")
                          If None, picks randomly
        """
        if len(readings) < 3:
            raise ValueError("Exactly 3 microphone readings are required for triangulation")

        valid_mic_ids = {'1', '2', '3'}
        reading_mic_ids = {r.microphone_id for r in readings}
        if reading_mic_ids != valid_mic_ids:
            raise ValueError(f"Must have readings from exactly microphones {valid_mic_ids}.")

        # Select location based on argument or randomly
        if location_name:
            # Find location by name
            location = None
            for loc in self.predefined_locations:
                if loc["name"].lower() == location_name.lower():
                    location = loc
                    break
            
            if location is None:
                available = [loc["name"] for loc in self.predefined_locations]
                raise ValueError(f"Invalid location name '{location_name}'. Available: {available}")
        else:
            # Pick randomly if no location specified
            location = random.choice(self.predefined_locations)
        
        # Convert to real meter coordinates
        x_real_m = location["x"] * self.scale_x
        y_real_m = location["y"] * self.scale_y

        # Convert to lat/lng using mic '1' as reference
        ref_lat = self.real_microphone_positions['1']['lat']
        ref_lng = self.real_microphone_positions['1']['lng']
        lat, lng = meters_to_latlng(ref_lat, ref_lng, x_real_m, y_real_m)

        print(f"Simulated gunshot at '{location['name']}': lat={lat:.8f}, lng={lng:.8f}")

        return GunshotResult(
            lat=lat,
            lng=lng,
            timestamp=datetime.now().timestamp(),
            confidence=0.8  # Lower confidence since it's simulated
        )

def main():
    # Test the predefined locations
    localizer = GunshotLocalizer()
    
    # Create dummy readings (values don't matter since we're using predefined locations)
    dummy_readings = [
        MicrophoneReading("1", 0.0),
        MicrophoneReading("2", 0.001),
        MicrophoneReading("3", 0.002)
    ]
    
    print(f"\nAvailable locations: {localizer.get_available_locations()}")
    
    print("\nTesting specific locations:")
    for location_name in ["1", "2", "3"]:
        result = localizer.calculate_gunshot_location(dummy_readings, location_name)
        print(f"{location_name}: lat={result.lat:.8f}, lng={result.lng:.8f}")
    
    print("\nTesting random selection:")
    for i in range(3):
        result = localizer.calculate_gunshot_location(dummy_readings)  # No location specified = random
        print(f"Random {i+1}: lat={result.lat:.8f}, lng={result.lng:.8f}")

if __name__ == '__main__':
    main()