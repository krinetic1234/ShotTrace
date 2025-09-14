import './MenuBar.css';

interface MenuBarProps {
  buildingCount: number;
  onBuildingCountChange: (count: number) => void;
  showSoundRadius: boolean;
  onToggleSoundRadius: (show: boolean) => void;
  onRequestAllFootage?: () => void;
}

const buildingOptions = [
  { value: 5, label: '5 Buildings' },
  { value: 10, label: '10 Buildings' },
  { value: 20, label: '20 Buildings' },
  { value: 50, label: '50 Buildings' },
  { value: 100, label: '100 Buildings' },
];

export default function MenuBar({ buildingCount, onBuildingCountChange, showSoundRadius, onToggleSoundRadius, onRequestAllFootage }: MenuBarProps) {
  return (
    <div className="menu-bar">
      <div className="menu-item">
        <label htmlFor="building-count" className="menu-label">
          Nearby Buildings:
        </label>
        <select
          id="building-count"
          value={buildingCount}
          onChange={(e) => onBuildingCountChange(Number(e.target.value))}
          className="menu-select"
        >
          {buildingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      
      <div className="menu-item">
        <label className="toggle-container">
          <input
            type="checkbox"
            checked={showSoundRadius}
            onChange={(e) => onToggleSoundRadius(e.target.checked)}
            className="toggle-checkbox"
          />
          <span className="toggle-slider"></span>
          <span className="toggle-label">Show Sound Radius</span>
        </label>
      </div>
      
      <div className="menu-item">
        <button 
          className="request-all-btn"
          onClick={onRequestAllFootage}
          title="Request camera footage from all nearby buildings"
        >
          📹 Request All Footage
        </button>
      </div>
    </div>
  );
}