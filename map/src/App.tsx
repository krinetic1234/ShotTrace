import './App.css'
import ShotMap from './components/ShotMap'
import { gunshot, mics } from './data'

function App() {
  return (
    <div className="app-fullscreen">
      <ShotMap mics={mics} gunshot={gunshot} />
    </div>
  )
}

export default App
