import { useState, useEffect } from 'react'
import { io } from 'socket.io-client'
import './App.css'
import ShotMap from './components/ShotMap'
import { mics } from './data'  // Use hardcoded microphones
import type { Gunshot } from './types'

const API_BASE_URL = 'http://localhost:5000'

function App() {
  const [gunshot, setGunshot] = useState<Gunshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<string>('Connecting...')

  // Initialize WebSocket connection
  useEffect(() => {
    const newSocket = io(API_BASE_URL)

    // Connection events
    newSocket.on('connect', () => {
      console.log('Connected to WebSocket server')
      setConnectionStatus('Connected')
      setError(null)
    })

    newSocket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server')
      setConnectionStatus('Disconnected')
      setError('Connection lost')
    })

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      setConnectionStatus('Connection Failed')
      setError('Failed to connect to server')
    })

    // Only listen for gunshot updates (mics are hardcoded)
    newSocket.on('gunshot_detected', (data) => {
      console.log('Gunshot detected:', data)
      setGunshot(data)
    })

    newSocket.on('error', (data) => {
      console.error('Server error:', data.message)
      setError(data.message)
    })

    // Cleanup on unmount
    return () => {
      newSocket.close()
    }
  }, [])

  if (error) {
    return (
      <div className="app-fullscreen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ color: 'red', textAlign: 'center' }}>
          <h3>WebSocket Connection Error</h3>
          <p>{error}</p>
          <p style={{ fontSize: '14px', color: '#666' }}>Make sure the server is running on http://localhost:5000</p>
          <p style={{ fontSize: '14px', color: '#666' }}>Status: {connectionStatus}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app-fullscreen">
      <ShotMap mics={mics} gunshot={gunshot} />
    </div>
  )
}

export default App
