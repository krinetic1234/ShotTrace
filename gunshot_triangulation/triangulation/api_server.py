"""
Flask API Server for Gunshot Localization

API endpoints using native lat/lng coordinates for frontend integration.
Supports both gunshot calculation and polling for new detections.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from gunshot_localization import (
    GunshotLocalizer, MicrophoneReading, get_microphone_positions, GunshotResult,
)
import uuid
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Enable CORS for web integration
socketio = SocketIO(app, cors_allowed_origins="*")  # Enable WebSocket support

# Single localizer instance with fixed microphone configuration
localizer = GunshotLocalizer()

# In-memory storage for the last calculated gunshot
last_gunshot = None

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    print(f"Client connected: {request.sid}")
    # Send current microphone positions to new client
    mic_positions = get_microphone_positions()
    mics = []
    for mic_id, coords in mic_positions.items():
        mics.append({
            'micId': mic_id,
            'lat': coords['lat'],
            'lng': coords['lng']
        })
    emit('microphones_loaded', {'mics': mics})
    
    # Send current gunshot if any
    if last_gunshot:
        emit('gunshot_detected', last_gunshot)

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print(f"Client disconnected: {request.sid}")

@socketio.on('trigger_gunshot')
def handle_trigger_gunshot(data):
    """Handle gunshot trigger via WebSocket"""
    global last_gunshot
    
    try:
        location = data.get('location', None)
        
        # Validate location if provided
        if location:
            available_locations = localizer.get_available_locations()
            if location not in available_locations:
                emit('error', {
                    'message': f'Invalid location "{location}". Available: {available_locations}'
                })
                return
        
        # Create dummy readings for simulation
        readings = [
            MicrophoneReading("1", 0.0),
            MicrophoneReading("2", 0.001), 
            MicrophoneReading("3", 0.002)
        ]
        
        result = localizer.calculate_gunshot_location(readings, location)
        
        gunshot_data = {
            'id': str(uuid.uuid4()),
            'lat': result.lat,
            'lng': result.lng,
            't': result.timestamp * 1000,  # Convert to milliseconds for frontend
            'confidence': result.confidence,
            'location_used': location or 'random'
        }
        
        last_gunshot = gunshot_data
        
        # Broadcast to all connected clients
        emit('gunshot_detected', gunshot_data, broadcast=True)
        print(f"Gunshot broadcast to all clients: {location or 'random'}")
        
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('get_locations')
def handle_get_locations():
    """Get available predefined locations via WebSocket"""
    try:
        locations = localizer.get_available_locations()
        emit('locations_list', {'locations': locations})
    except Exception as e:
        emit('error', {'message': str(e)})

@app.route('/api/mics', methods=['GET'])
def get_mics():
    """Get microphone configuration."""
    try:
        mic_positions = get_microphone_positions()
        mics = []
        for mic_id, coords in mic_positions.items():
            mics.append({
                'micId': mic_id,
                'lat': coords['lat'],
                'lng': coords['lng']
            })
        
        return jsonify({
            'success': True,
            'mics': mics
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gunshot-location', methods=['POST'])
def calculate_gunshot():
    """
    Calculate gunshot location from microphone readings.
    
    Expected payload:
    {
        "readings": [
            {"microphone_id": "1", "time_delay": 0.0},
            {"microphone_id": "2", "time_delay": 0.15},
            {"microphone_id": "3", "time_delay": 0.08}
        ],
        "location": "1"  // Optional: "1", "2", "3"
    }
    """
    global last_gunshot
    
    try:
        data = request.get_json()
        if not data or 'readings' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing readings in request body'
            }), 400
        
        # Parse microphone readings
        readings = []
        for reading_data in data['readings']:
            if 'microphone_id' not in reading_data or 'time_delay' not in reading_data:
                return jsonify({
                    'success': False,
                    'error': 'Each reading must have microphone_id and time_delay'
                }), 400
            
            readings.append(MicrophoneReading(
                microphone_id=str(reading_data['microphone_id']),
                time_delay=float(reading_data['time_delay'])
            ))
        
        # Get optional location parameter
        location_name = data.get('location', None)  # None means random selection
        
        # Validate location name if provided
        if location_name:
            available_locations = localizer.get_available_locations()
            if location_name not in available_locations:
                return jsonify({
                    'success': False,
                    'error': f'Invalid location "{location_name}". Available: {available_locations}'
                }), 400
        
        # Calculate gunshot location
        result = localizer.calculate_gunshot_location(readings, location_name)
        
        # Store as last gunshot with new UUID
        gunshot_data = {
            'id': str(uuid.uuid4()),
            'lat': result.lat,
            'lng': result.lng,
            't': result.timestamp * 1000,  # Convert to milliseconds for frontend consistency
            'confidence': result.confidence,
            'location_used': location_name or 'random'  # Track which location was used
        }
        last_gunshot = gunshot_data
        
        # IMPORTANT: Also broadcast to WebSocket clients for real-time updates
        socketio.emit('gunshot_detected', gunshot_data)
        print(f"REST API: Gunshot broadcast to WebSocket clients: {location_name or 'random'}")
        
        return jsonify({
            'success': True,
            'gunshot': gunshot_data
        })
        
    except ValueError as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'Internal server error: {str(e)}'
        }), 500

@app.route('/api/gunshot', methods=['GET'])
def get_last_gunshot():
    """Poll for the last calculated gunshot."""
    global last_gunshot
    
    try:
        return jsonify({
            'success': True,
            'gunshot': last_gunshot
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/locations', methods=['GET'])
def get_available_locations():
    """Get list of available predefined locations."""
    try:
        locations = localizer.get_available_locations()
        return jsonify({
            'success': True,
            'locations': locations
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("Starting Gunshot Localization API Server with WebSocket support...")
    print("Fixed Microphone Configuration:")
    
    mic_positions = get_microphone_positions()
    for mic_id, coords in mic_positions.items():
        print(f"  Microphone {mic_id}: lat={coords['lat']:.9f}, lng={coords['lng']:.9f}")
    
    print(f"\nAvailable predefined locations: {localizer.get_available_locations()}")
    
    print("\nWebSocket Events:")
    print("  connect - Client connects and receives microphones")
    print("  trigger_gunshot - Trigger gunshot with optional location ('1', '2', '3')")
    print("  get_locations - Get available locations")
    print("  gunshot_detected - Broadcast gunshot to all clients")
    print("  microphones_loaded - Send microphone positions")
    
    print("\nREST API endpoints (legacy support):")
    print("  GET  /api/mics - Get microphone configuration")
    print("  POST /api/gunshot-location - Calculate gunshot location")
    print("       Optional 'location' parameter: '1', '2', '3'")
    print("  GET  /api/gunshot - Poll for last gunshot")
    print("  GET  /api/locations - Get available predefined locations")
    
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)