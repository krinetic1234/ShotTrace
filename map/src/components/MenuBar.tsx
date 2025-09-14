import './MenuBar.css';

interface MenuBarProps {
  buildingCount: number;
  onBuildingCountChange: (count: number) => void;
}

const buildingOptions = [
  { value: 5, label: '5 Buildings' },
  { value: 10, label: '10 Buildings' },
  { value: 20, label: '20 Buildings' },
  { value: 50, label: '50 Buildings' },
  { value: 100, label: '100 Buildings' },
];

export default function MenuBar({ buildingCount, onBuildingCountChange }: MenuBarProps) {
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
    </div>
  );
}