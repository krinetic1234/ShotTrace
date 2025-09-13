import math

def get_third_coordinate(coord1, coord2):
    """
    Given two coordinates (lon, lat) representing (0,0) and (6,0) on a 6ft baseline,
    compute the coordinate for the "tip" point representing (3,3).
    
    coord1, coord2: tuples of (lon, lat) in degrees
    coord3: returns tuple (lon, lat)
    
    Algorithm:
      1. Check that coord1 and coord2 have the same latitude.
      2. Find longitude midpoint for x=3.
      3. Convert longitudinal distance to meters, divide by 2 (scale for 3 ft height),
         convert back to degrees latitude, and add to coord1 latitude.
    """
    lon1, lat1 = coord1
    lon2, lat2 = coord2

    if abs(lat1 - lat2) > 1e-9:
        raise ValueError("coord1 and coord2 must have the same latitude")

    # --- Step 1: Find baseline length in meters (longitudinal distance only)
    lat_rad = math.radians(lat1)
    meters_per_deg_lon = 111412.84 * math.cos(lat_rad) - 93.5 * math.cos(3 * lat_rad)
    baseline_meters = abs(lon2 - lon1) * meters_per_deg_lon

    # --- Step 2: Midpoint longitude
    lon3 = (lon1 + lon2) / 2

    # --- Step 3: Height is half the baseline length (proportional to 3ft vs 6ft)
    height_meters = baseline_meters / 2.0

    # Convert meters to degrees latitude
    meters_per_deg_lat = 111132.92 - 559.82 * math.cos(2 * lat_rad) + 1.175 * math.cos(4 * lat_rad)
    delta_lat = height_meters / meters_per_deg_lat
    lat3 = lat1 + delta_lat

    return (lon3, lat3)


# Example usage:
coord1 = (-71.08372488708355, 42.34866577958835)
coord2 = (-71.07566610610223, 42.34866577958835)
coord3 = get_third_coordinate(coord1, coord2)
print("long, lat")
print((0,0), " to ", coord1[0], coord1[1])
print((6,0), " to ", coord2[0], coord2[1])
print((3,3), " to ", coord3[0], coord3[1])

print("lat, long")
print((coord1[1], coord1[0]), " to ", (0,0))
print((coord2[1], coord2[0]), " to ", (6,0))
print((coord3[1], coord3[0]), " to ", (3,3))

