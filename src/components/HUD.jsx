import { formatTime } from '../utils/math.js'
import { PowerBar } from './PowerBar.jsx'

export function HUD({ score, timeLeft, availableBalls, power, onMenu }) {
  return (
    <div className="hud" data-ui="true">
      <div className="hud-top">
        <div className="hud-top-cards">
          <div className="hud-card">
            <span>PLACAR</span>
            <strong>{score}</strong>
          </div>
          <div className="hud-card">
            <span>TEMPO</span>
            <strong>{formatTime(timeLeft)}</strong>
          </div>
          <div className="hud-card wide">
            <span>BOLAS</span>
            <strong>{availableBalls} disponíveis</strong>
          </div>
        </div>

        <button className="hud-menu-button" type="button" onClick={onMenu} data-ui="true">
          Menu
        </button>
      </div>

      <div className="hud-bottom">
        <PowerBar power={power} />
      </div>
    </div>
  )
}
