"""
Flask API Server for Gunshot Localization

API endpoints using native lat/lng coordinates for frontend integration.
Supports both gunshot calculation and polling for new detections.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
from gunshot_localization import (
    GunshotLocalizer, MicrophoneReading, MicrophoneRawReading, get_microphone_positions, GunshotResult,
)
import librosa
import uuid
import os
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
    """Handle gunshot trigger via WebSocket with time delays"""
    global last_gunshot
    
    try:
        # Expect time delays from microphones
        readings_data = data.get('readings', None)
        
        if not readings_data:
            # Use default test readings if none provided (for demo purposes)
            readings = [
                MicrophoneReading("1", 0.0),
                MicrophoneReading("2", 0.002), 
                MicrophoneReading("3", 0.001)
            ]
        else:
            # Parse readings from WebSocket data
            readings = []
            for reading_data in readings_data:
                readings.append(MicrophoneReading(
                    microphone_id=str(reading_data['microphone_id']),
                    time_delay=float(reading_data['time_delay'])
                ))
        
        # Calculate using TDOA triangulation (no location parameter)
        result = localizer.calculate_gunshot_location(readings)
        
        gunshot_data = {
            'id': str(uuid.uuid4()),
            'lat': result.lat,
            'lng': result.lng,
            't': result.timestamp * 1000,  # Convert to milliseconds for frontend
            'confidence': result.confidence,
            'readings_used': [{'mic': r.microphone_id, 'delay': r.time_delay} for r in readings]
        }
        
        last_gunshot = gunshot_data
        
        # Broadcast to all connected clients
        emit('gunshot_detected', gunshot_data, broadcast=True)
        print(f"Gunshot triangulated and broadcast to all clients")
        
    except Exception as e:
        emit('error', {'message': str(e)})

@socketio.on('get_microphones')
def handle_get_microphones():
    """Get microphone information via WebSocket"""
    try:
        mic_positions = get_microphone_positions()
        mics = []
        for mic_id, coords in mic_positions.items():
            mics.append({
                'micId': mic_id,
                'lat': coords['lat'],
                'lng': coords['lng']
            })
        emit('microphones_info', {'mics': mics})
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
    Calculate gunshot location from microphone audio file uploads using TDOA triangulation.
    
    Expected form data:
    {
        "mic1": filename,
        "mic2": filename,
        "mic3": filename
    }
    """
    global last_gunshot
    
    try:
        # Check if files are present
        if 'mic1' not in request.json or 'mic2' not in request.json or 'mic3' not in request.json:
            return jsonify({
                'success': False,
                'error': 'Missing audio files. Required: mic1, mic2, mic3'
            }), 400
        
        # Read audio files
        mic_files = {
            '1': request.json['mic1'],
            '2': request.json['mic2'], 
            '3': request.json['mic3']
        }
        
        # Parse microphone readings from uploaded files
        readings = []
        for mic_id, file in mic_files.items():
            if not os.path.exists(file):
                return jsonify({
                    'success': False,
                    'error': f'No valid file selected for microphone {mic_id}'
                }), 400
            
            # Read file content as bytes
            samples, sr = librosa.load(file)
            
            readings.append(MicrophoneRawReading(
                microphone_id=mic_id,
                samples=samples,
                sample_rate=sr
            ))
        
        # Calculate gunshot location using TDOA triangulation  
        # Triangulates on local scale (0,0), (1.5,0), (0.75,0.75) then scales up to Boston coordinates
        delays = localizer.calculate_delays(readings)
        result = localizer.calculate_gunshot_location(delays)
        
        # Store as last gunshot with new UUID
        gunshot_data = {
            'id': str(uuid.uuid4()),
            'lat': result.lat,
            'lng': result.lng,
            't': result.timestamp * 1000,  # Convert to milliseconds for frontend consistency
            'confidence': result.confidence,
            'readings_used': [{'mic': r.microphone_id, 'delay': r.time_delay} for r in delays]
        }
        last_gunshot = gunshot_data
        
        # Also broadcast to WebSocket clients for real-time updates
        socketio.emit('gunshot_detected', gunshot_data)
        print(f"REST API: Gunshot triangulated from uploaded files and broadcast to WebSocket clients")

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
def get_microphone_info():
    """Get microphone configuration instead of predefined locations."""
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
            'microphones': mics
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
    
    print(f"\nMicrophone Triangulation System using TDOA (Time Difference of Arrival)")
    print("Local microphone positions: (0,0), (1.5,0), (0.75,0.75) meters")
    print("Scales up to Boston coordinates with ~442x factor")
    
    print("\nSimplified Workflow:")
    print("  GET  /api/gunshot - Returns most recent gunshot if any")
    print("  POST /api/gunshot-location - Processes time delays and triangulates position")
    
    print("\nWebSocket Events:")
    print("  connect - Client connects and receives microphones")
    print("  trigger_gunshot - Trigger gunshot with time delay readings")
    print("    Example: {'readings': [{'microphone_id': '1', 'time_delay': 0.0}, ...]}")
    print("  get_microphones - Get microphone information")
    print("  gunshot_detected - Broadcast triangulated gunshot to all clients")
    print("  microphones_loaded - Send microphone positions")
    
    print("\nREST API endpoints:")
    print("  GET  /api/mics - Get microphone configuration")
    print("  POST /api/gunshot-location - Calculate gunshot location from time delays")
    print("  GET  /api/gunshot - Poll for last gunshot")
    print("  GET  /api/locations - Get microphone information")
    
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)