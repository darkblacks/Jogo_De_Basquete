import { clamp } from '../utils/math.js'

export function PowerBar({ power }) {
  const safePower = clamp(power, 0, 1)
  const displayPercent = Math.round(safePower * 100)

  return (
    <div className="power-bar" data-ui="true" aria-label={`Força ${displayPercent}%`}>
      <div className="power-label">FORÇA {displayPercent}%</div>
      <div className="power-track">
        <div className="power-fill" style={{ width: `${displayPercent}%` }} />
      </div>
    </div>
  )
}
