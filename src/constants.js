export const TOTAL_BALLS = 3
export const GAME_DURATION_SECONDS = 180

export const BALL_STATES = {
  AVAILABLE: 'available',
  CHARGING: 'charging',
  THROWN: 'thrown',
  UNAVAILABLE: 'unavailable',
  RESETTING: 'resetting'
}

export const GAME_SCREENS = {
  MENU: 'menu',
  PLAYING: 'playing',
  FINISHED: 'finished'
}

export const BALL_COLORS = {
  available: '#ff8a00',
  charging: '#20ff68',
  thrown: '#20ff68',
  unavailable: '#ff2d2d',
  resetting: '#ff2d2d'
}

export const HOOP = {
  center: [0, 2.28, -3.22],
  radius: 0.46
}

export const BALL_RADIUS = 0.18
export const BALL_SPAWN = [0, 0.55, 2.36]

export const READY_SLOTS = [-1.25, 0, 1.25]
export const READY_Y = 0.98
export const READY_Z = 1.47
export const AIM_X_RANGE = 1.55
export const LAUNCH_POS = [0, 1.03, 1.47]
export const BALL_STARTS = [
  // Pontos seguros de reset: caem visivelmente na esteira/rampa,
  // já na frente da cesta, sem nascer dentro da rede/atrás do aro.
  [-1.05, 1.22, -2.32],
  [0, 1.34, -2.55],
  [1.05, 1.22, -2.32]
]

export const HOOP_MOTION = {
  startTimeLeft: 120,
  maxSpeedTimeLeft: 30,
  amplitude: 0.82,
  minCyclesPerSecond: 0.22,
  maxCyclesPerSecond: 0.95
}
