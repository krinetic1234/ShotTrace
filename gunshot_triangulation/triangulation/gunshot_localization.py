import math
import numpy as np
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

# Local microphone positions in meters (for triangulation calculations)
LOCAL_MIC_POSITIONS = {
    '1': {'x': 0.0, 'y': 0.0},      # Reference point
    '2': {'x': 1.5, 'y': 0.0},      # 1.5m east
    '3': {'x': 0.75, 'y': 0.75}     # 0.75m east, 0.75m north
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
class MicrophoneRawReading:
    microphone_id: str
    samples: List
    sample_rate: int

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
        self.local_mic_positions = LOCAL_MIC_POSITIONS
        
        # Calculate scaling factors for converting to Boston coordinates
        self._calculate_scaling_factors()
        
        print("TDOA Triangulation mode - calculating actual gunshot positions from time delays")
        print(f"Microphone positions (local meters):")
        for mic_id, pos in self.local_mic_positions.items():
            print(f"  Mic {mic_id}: x={pos['x']:.2f}m, y={pos['y']:.2f}m")

    def _calculate_scaling_factors(self):
        """Calculate scaling factors from local meter grid to Boston coordinates."""
        # Get real distances in meters
        ref_coords = self.real_microphone_positions['1']
        mic2_coords = self.real_microphone_positions['2'] 
        mic3_coords = self.real_microphone_positions['3']
        
        mic2_real_x, mic2_real_y = latlng_to_meters(ref_coords['lat'], ref_coords['lng'],
                                                   mic2_coords['lat'], mic2_coords['lng'])
        mic3_real_x, mic3_real_y = latlng_to_meters(ref_coords['lat'], ref_coords['lng'],
                                                   mic3_coords['lat'], mic3_coords['lng'])
        
        # Calculate scaling factors
        self.scale_x = mic2_real_x / 1.5  # Real distance to mic 2 / local distance to mic 2
        self.scale_y = mic3_real_y / 0.75 # Real distance to mic 3 / local distance to mic 3
        
        print(f"Scaling factors: x={self.scale_x:.1f}, y={self.scale_y:.1f}")

    def _triangulate_position(self, readings: List[MicrophoneReading]) -> Tuple[float, float]:
        """
        Triangulate gunshot position using TDOA (Time Difference of Arrival).
        Uses analytical solution for three microphones.
        
        Args:
            readings: List of microphone readings with time delays
            
        Returns:
            Tuple of (x, y) position in local meter coordinates
        """
        # Convert readings to a dict for easier access
        delays = {reading.microphone_id: reading.time_delay for reading in readings}
        
        # Get microphone positions
        x1, y1 = self.local_mic_positions['1']['x'], self.local_mic_positions['1']['y']  # (0, 0)
        x2, y2 = self.local_mic_positions['2']['x'], self.local_mic_positions['2']['y']  # (1.5, 0)
        x3, y3 = self.local_mic_positions['3']['x'], self.local_mic_positions['3']['y']  # (0.75, 0.75)
        
        print(f"Time delays: mic1={delays['1']:.6f}s, mic2={delays['2']:.6f}s, mic3={delays['3']:.6f}s")
        
        # Calculate range differences from time delays
        # Range difference = speed * time difference
        r21 = SPEED_OF_SOUND * (delays['2'] - delays['1'])  # r2 - r1
        r31 = SPEED_OF_SOUND * (delays['3'] - delays['1'])  # r3 - r1
        
        print(f"Range differences: r21={r21:.3f}m, r31={r31:.3f}m")
        
        # Use the closed-form solution for TDOA with 3 sensors
        # Based on the equations:
        # sqrt((x-x2)^2 + (y-y2)^2) - sqrt((x-x1)^2 + (y-y1)^2) = r21
        # sqrt((x-x3)^2 + (y-y3)^2) - sqrt((x-x1)^2 + (y-y1)^2) = r31
        
        # Linearization approach: solve for the intersection of hyperbolas
        # Use the Taylor-series linearization method
        
        # For numerical stability, use an iterative approach starting from centroid
        x_est = (x1 + x2 + x3) / 3  # Start at centroid
        y_est = (y1 + y2 + y3) / 3
        
        for iteration in range(10):  # Maximum 10 iterations
            # Calculate current distances to each microphone
            r1 = np.sqrt((x_est - x1)**2 + (y_est - y1)**2)
            r2 = np.sqrt((x_est - x2)**2 + (y_est - y2)**2)
            r3 = np.sqrt((x_est - x3)**2 + (y_est - y3)**2)
            
            # Calculate residuals (error in range differences)
            f1 = (r2 - r1) - r21
            f2 = (r3 - r1) - r31
            
            # If residuals are small enough, we're done
            if abs(f1) < 0.001 and abs(f2) < 0.001:
                break
                
            # Calculate Jacobian matrix for Newton-Raphson update
            if r1 > 0 and r2 > 0 and r3 > 0:  # Avoid division by zero
                J11 = (x_est - x2)/r2 - (x_est - x1)/r1
                J12 = (y_est - y2)/r2 - (y_est - y1)/r1
                J21 = (x_est - x3)/r3 - (x_est - x1)/r1
                J22 = (y_est - y3)/r3 - (y_est - y1)/r1
                
                J = np.array([[J11, J12], [J21, J22]])
                f = np.array([f1, f2])
                
                try:
                    # Newton-Raphson update: x_new = x_old - J^(-1) * f
                    delta = np.linalg.solve(J, f)
                    x_est -= delta[0]
                    y_est -= delta[1]
                except np.linalg.LinAlgError:
                    # If Jacobian is singular, use a small step
                    x_est -= 0.1 * f1
                    y_est -= 0.1 * f2
            else:
                break
        
        print(f"Triangulated position (local): x={x_est:.3f}m, y={y_est:.3f}m")
        return float(x_est), float(y_est)

    def gcc_phat(self, sig, refsig, fs=1, max_tau=None, interp=16):
        """
        Compute the time delay estimate between sig and refsig using GCC-PHAT.

        Args:
            sig (ndarray): Signal 1.
            refsig (ndarray): Signal 2 (reference).
            fs (int, optional): Sampling frequency (Hz). Default=1.
            max_tau (float, optional): Maximum delay (seconds) to search for.
            interp (int, optional): Interpolation factor for finer resolution.

        Returns:
            float: Estimated delay (in seconds).
            ndarray: Cross-correlation function.
        """

        n = sig.shape[0] + refsig.shape[0]

        # FFT of both signals
        SIG = np.fft.rfft(sig, n=n)
        REFSIG = np.fft.rfft(refsig, n=n)

        # Cross-spectral density
        R = SIG * np.conj(REFSIG)

        # Apply PHAT weighting
        R /= np.abs(R) + np.finfo(float).eps

        # Inverse FFT to get cross-correlation
        cc = np.fft.irfft(R, n=interp*n)

        max_shift = int(interp * n / 2)
        if max_tau:
            max_shift = np.minimum(int(interp*fs*max_tau), max_shift)

        cc = np.concatenate((cc[-max_shift:], cc[:max_shift+1]))

        # Find shift index
        shift = np.argmax(np.abs(cc)) - max_shift

        tau = shift / float(interp * fs)

        return -tau, cc

    def calculate_delays(self, readings: List[MicrophoneRawReading]) -> List[MicrophoneReading]:
        """
        Calculate time delays from microphone readings.
        
        Args:
            readings: List of microphone readings with raw samples
            
        Returns:
            List of microphone readings with calculated time delays
        """
        if len(readings) != 3:
            raise ValueError("Exactly 3 microphone readings are required for triangulation")

        valid_mic_ids = {'1', '2', '3'}
        reading_mic_ids = {r.microphone_id for r in readings}
        if reading_mic_ids != valid_mic_ids:
            raise ValueError(f"Must have readings from exactly microphones {valid_mic_ids}.")
        
        delays = []
    
        delay_1_2, _ = self.gcc_phat(readings[0].samples, readings[1].samples, readings[0].sample_rate)
        delay_1_3, _ = self.gcc_phat(readings[0].samples, readings[2].samples, readings[0].sample_rate)

        delays = [
            MicrophoneReading("1", 0),
            MicrophoneReading("2", delay_1_2),
            MicrophoneReading("3", delay_1_3)
        ]

        print("Delays before:", delays)

        min_delay = min(0, delay_1_2, delay_1_3)
        for delay in delays:
            delay.time_delay -= min_delay

        print("Delays after:", delays)

        return delays

    def calculate_gunshot_location(self, readings: List[MicrophoneReading]) -> GunshotResult:
        """
        Calculate gunshot location using TDOA triangulation.
        
        Args:
            readings: List of microphone readings with time delays
            
        Returns:
            GunshotResult with calculated lat/lng position
        """
        if len(readings) != 3:
            raise ValueError("Exactly 3 microphone readings are required for triangulation")

        valid_mic_ids = {'1', '2', '3'}
        reading_mic_ids = {r.microphone_id for r in readings}
        if reading_mic_ids != valid_mic_ids:
            raise ValueError(f"Must have readings from exactly microphones {valid_mic_ids}.")

        # Triangulate position in local coordinates
        x_local, y_local = self._triangulate_position(readings)
        
        # Scale up to real-world meter coordinates
        x_real_m = x_local * self.scale_x
        y_real_m = y_local * self.scale_y

        # Convert to lat/lng using mic '1' as reference
        ref_lat = self.real_microphone_positions['1']['lat']
        ref_lng = self.real_microphone_positions['1']['lng']
        lat, lng = meters_to_latlng(ref_lat, ref_lng, x_real_m, y_real_m)

        print(f"Scaled position (real meters): x={x_real_m:.1f}m, y={y_real_m:.1f}m")
        print(f"Final position (Boston coords): lat={lat:.8f}, lng={lng:.8f}")

        return GunshotResult(
            lat=lat,
            lng=lng,
            timestamp=datetime.now().timestamp(),
            confidence=0.9  # Higher confidence for actual triangulation
        )

def main():
    # Test the triangulation
    localizer = GunshotLocalizer()
    
    print("\nTesting TDOA triangulation with sample time delays:")
    
    # Test case 1: Gunshot at origin (should be near mic 1)
    print("\n=== Test 1: Gunshot near mic 1 (origin) ===")
    test_readings_1 = [
        MicrophoneReading("1", 0.0),      # Closest to mic 1
        MicrophoneReading("2", 0.004),    # Further from mic 2 (1.5m / 343 m/s ≈ 0.004s)
        MicrophoneReading("3", 0.003)     # Further from mic 3 (1.06m / 343 m/s ≈ 0.003s)
    ]
    result1 = localizer.calculate_gunshot_location(test_readings_1)
    print(f"Result: lat={result1.lat:.8f}, lng={result1.lng:.8f}")
    
    # Test case 2: Gunshot near mic 2
    print("\n=== Test 2: Gunshot near mic 2 ===")
    test_readings_2 = [
        MicrophoneReading("1", 0.004),    # Further from mic 1
        MicrophoneReading("2", 0.0),      # Closest to mic 2
        MicrophoneReading("3", 0.003)     # Medium distance from mic 3
    ]
    result2 = localizer.calculate_gunshot_location(test_readings_2)
    print(f"Result: lat={result2.lat:.8f}, lng={result2.lng:.8f}")
    
    # Test case 3: Gunshot near mic 3
    print("\n=== Test 3: Gunshot near mic 3 ===")
    test_readings_3 = [
        MicrophoneReading("1", 0.003),    # Medium distance from mic 1
        MicrophoneReading("2", 0.003),    # Medium distance from mic 2  
        MicrophoneReading("3", 0.0)       # Closest to mic 3
    ]
    result3 = localizer.calculate_gunshot_location(test_readings_3)
    print(f"Result: lat={result3.lat:.8f}, lng={result3.lng:.8f}")
    
    # Test case 4: Center of triangle
    print("\n=== Test 4: Gunshot at center of triangle ===")
    test_readings_4 = [
        MicrophoneReading("1", 0.001),    # Small delays, roughly equidistant
        MicrophoneReading("2", 0.001), 
        MicrophoneReading("3", 0.001)
    ]
    result4 = localizer.calculate_gunshot_location(test_readings_4)
    print(f"Result: lat={result4.lat:.8f}, lng={result4.lng:.8f}")

if __name__ == '__main__':
    main()