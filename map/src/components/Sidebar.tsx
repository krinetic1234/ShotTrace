import type { Gunshot, Mic } from '../types';
import type { Place } from '../types/places';
import './Sidebar.css';

export type SelectedItem = 
  | { type: 'gunshot'; data: Gunshot }
  | { type: 'mic'; data: Mic }
  | { type: 'building'; data: Place }
  | null;

interface SidebarProps {
  selectedItem: SelectedItem;
  onClose: () => void;
}

export default function Sidebar({ selectedItem, onClose }: SidebarProps) {
  if (!selectedItem) return null;

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const renderContent = () => {
    switch (selectedItem.type) {
      case 'gunshot':
        return (
          <div className="sidebar-content">
            <div className="content-header">
              <h3>🔫 Gunshot Detection</h3>
              <button className="close-button" onClick={onClose}>
                ✕
              </button>
            </div>
            <div className="data-row">
              <span className="label">ID:</span>
              <span className="value">{selectedItem.data.id}</span>
            </div>
            <div className="data-row">
              <span className="label">Time:</span>
              <span className="value">{formatTimestamp(selectedItem.data.t)}</span>
            </div>
            <div className="data-row">
              <span className="label">Latitude:</span>
              <span className="value">{selectedItem.data.lat.toFixed(6)}</span>
            </div>
            <div className="data-row">
              <span className="label">Longitude:</span>
              <span className="value">{selectedItem.data.lng.toFixed(6)}</span>
            </div>
            <div className="coordinates">
              <small>Coordinates: {selectedItem.data.lat.toFixed(6)}, {selectedItem.data.lng.toFixed(6)}</small>
            </div>
          </div>
        );

      case 'mic':
        return (
          <div className="sidebar-content">
            <div className="content-header">
              <h3>🎤 Microphone</h3>
              <button className="close-button" onClick={onClose}>
                ✕
              </button>
            </div>
            <div className="data-row">
              <span className="label">ID:</span>
              <span className="value">{selectedItem.data.micId}</span>
            </div>
            <div className="data-row">
              <span className="label">Latitude:</span>
              <span className="value">{selectedItem.data.lat.toFixed(6)}</span>
            </div>
            <div className="data-row">
              <span className="label">Longitude:</span>
              <span className="value">{selectedItem.data.lng.toFixed(6)}</span>
            </div>
            {selectedItem.data.distanceToGunshot !== undefined && (
              <>
                <div className="data-row">
                  <span className="label">Distance to Gunshot:</span>
                  <span className="value">{selectedItem.data.distanceToGunshot < 1000 
                    ? `${selectedItem.data.distanceToGunshot.toFixed(1)} m`
                    : `${(selectedItem.data.distanceToGunshot / 1000).toFixed(2)} km`}
                  </span>
                </div>
                <div className="data-row">
                  <span className="label">Sound Travel Time:</span>
                  <span className="value">{selectedItem.data.soundTravelTime! < 1 
                    ? `${(selectedItem.data.soundTravelTime! * 1000).toFixed(0)} ms`
                    : `${selectedItem.data.soundTravelTime!.toFixed(3)} s`}
                  </span>
                </div>
                <div className="sound-info">
                  <small>Speed of sound: 343 m/s (20°C, 68°F)</small>
                </div>
              </>
            )}
            <div className="coordinates">
              <small>Coordinates: {selectedItem.data.lat.toFixed(6)}, {selectedItem.data.lng.toFixed(6)}</small>
            </div>
          </div>
        );

      case 'building':
        return (
          <div className="sidebar-content">
            <div className="content-header">
              <h3>🏢 Building</h3>
              <button className="close-button" onClick={onClose}>
                ✕
              </button>
            </div>
            <div className="data-row">
              <span className="label">Name:</span>
              <span className="value">{selectedItem.data.name || 'Unnamed Building'}</span>
            </div>
            <div className="data-row">
              <span className="label">Address:</span>
              <span className="value">{selectedItem.data.formatted_address}</span>
            </div>
            <div className="data-row">
              <span className="label">Place ID:</span>
              <span className="value">{selectedItem.data.place_id}</span>
            </div>
            <div className="data-row">
              <span className="label">Latitude:</span>
              <span className="value">{selectedItem.data.geometry.location.lat.toFixed(6)}</span>
            </div>
            <div className="data-row">
              <span className="label">Longitude:</span>
              <span className="value">{selectedItem.data.geometry.location.lng.toFixed(6)}</span>
            </div>
            {selectedItem.data.types && selectedItem.data.types.length > 0 && (
              <div className="data-row">
                <span className="label">Types:</span>
                <span className="value">{selectedItem.data.types.join(', ')}</span>
              </div>
            )}
            <div className="coordinates">
              <small>Coordinates: {selectedItem.data.geometry.location.lat.toFixed(6)}, {selectedItem.data.geometry.location.lng.toFixed(6)}</small>
            </div>
          </div>
        );

      default:
        return <div>Unknown item type</div>;
    }
  };

  return (
    <div className="sidebar">
      {renderContent()}
    </div>
  );
}