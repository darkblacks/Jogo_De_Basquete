export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.ceil(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const rest = safeSeconds % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}

export function triangular01(timeSeconds, speed = 0.85) {
  const phase = (timeSeconds * speed) % 2
  return phase <= 1 ? phase : 2 - phase
}
