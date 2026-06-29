function distance2D(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.sqrt(dx * dx + dy * dy)
}

export function detectHandGesture(landmarks) {
  if (!landmarks || landmarks.length < 21) return 'none'

  const wrist = landmarks[0]
  const fingers = [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18]
  ]

  const extendedCount = fingers.reduce((total, [tip, pip]) => {
    const tipDistance = distance2D(landmarks[tip], wrist)
    const pipDistance = distance2D(landmarks[pip], wrist)

    // Funciona melhor que comparar somente Y, porque a mão pode aparecer
    // levemente inclinada na webcam. Continua sendo apenas aberto/fechado.
    return total + (tipDistance > pipDistance * 1.08 ? 1 : 0)
  }, 0)

  return extendedCount >= 3 ? 'open' : 'closed'
}

export function getPalmPoint(landmarks) {
  if (!landmarks || landmarks.length < 21) return null
  const wrist = landmarks[0]
  const middleBase = landmarks[9]
  return {
    x: (wrist.x + middleBase.x) * 0.5,
    y: (wrist.y + middleBase.y) * 0.5
  }
}
