import { useCallback, useEffect, useRef, useState } from 'react'
import { detectHandGesture, getPalmPoint } from '../utils/handGesture.js'

const INITIAL_CURSOR = { x: 0, y: 0 }
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task'

function normalizeOptions(options) {
  if (typeof options === 'boolean') {
    return { gameplayActive: options, menuActive: false }
  }

  return {
    gameplayActive: options?.gameplayActive === true,
    menuActive: options?.menuActive === true
  }
}

export function useWebcamHandControls(options = false) {
  const initialOptions = normalizeOptions(options)

  const videoRef = useRef(null)
  const landmarkerRef = useRef(null)
  const streamRef = useRef(null)
  const loopTimerRef = useRef(0)
  const enabledRef = useRef(false)
  const loadingRef = useRef(false)
  const gameplayActiveRef = useRef(initialOptions.gameplayActive)
  const menuActiveRef = useRef(initialOptions.menuActive)
  const rawGestureRef = useRef('none')
  const stableGestureRef = useRef('none')
  const sameGestureFramesRef = useRef(0)
  const handStateRef = useRef('none')
  const cursorRef = useRef(INITIAL_CURSOR)
  const lastMenuUiUpdateRef = useRef(0)
  const gameplayInputRef = useRef({ aimX: 0, handClosed: false, handState: 'none' })
  const menuInputRef = useRef({ cursor: INITIAL_CURSOR, handClosed: false, handState: 'none' })

  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [menuCursor, setMenuCursor] = useState(INITIAL_CURSOR)
  const [menuHandState, setMenuHandState] = useState('none')

  const { gameplayActive, menuActive } = normalizeOptions(options)

  useEffect(() => { enabledRef.current = enabled }, [enabled])
  useEffect(() => { loadingRef.current = loading }, [loading])
  useEffect(() => { gameplayActiveRef.current = gameplayActive }, [gameplayActive])
  useEffect(() => { menuActiveRef.current = menuActive }, [menuActive])

  const resetInputRefs = useCallback(() => {
    rawGestureRef.current = 'none'
    stableGestureRef.current = 'none'
    sameGestureFramesRef.current = 0
    handStateRef.current = 'none'
    cursorRef.current = INITIAL_CURSOR
    gameplayInputRef.current = { aimX: 0, handClosed: false, handState: 'none' }
    menuInputRef.current = { cursor: INITIAL_CURSOR, handClosed: false, handState: 'none' }
    setMenuCursor(INITIAL_CURSOR)
    setMenuHandState('none')
  }, [])

  const stopCamera = useCallback(() => {
    enabledRef.current = false
    loadingRef.current = false
    gameplayActiveRef.current = false
    menuActiveRef.current = false

    if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current)
    loopTimerRef.current = 0

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.pause?.()
      videoRef.current.srcObject = null
    }

    resetInputRefs()
    setEnabled(false)
    setLoading(false)
  }, [resetInputRefs])

  useEffect(() => stopCamera, [stopCamera])

  const commitStableGesture = useCallback((rawGesture) => {
    if (rawGesture === rawGestureRef.current) {
      sameGestureFramesRef.current += 1
    } else {
      rawGestureRef.current = rawGesture
      sameGestureFramesRef.current = 1
    }

    const requiredFrames = rawGesture === 'none' ? 3 : 2
    if (sameGestureFramesRef.current < requiredFrames || stableGestureRef.current === rawGesture) return

    stableGestureRef.current = rawGesture
    handStateRef.current = rawGesture
    gameplayInputRef.current.handState = rawGesture
    gameplayInputRef.current.handClosed = rawGesture === 'closed'
    menuInputRef.current.handState = rawGesture
    menuInputRef.current.handClosed = rawGesture === 'closed'
  }, [])

  const updateMenuVisualState = useCallback((now) => {
    if (!menuActiveRef.current) return
    if (now - lastMenuUiUpdateRef.current < 83) return

    lastMenuUiUpdateRef.current = now
    setMenuCursor(cursorRef.current)
    setMenuHandState(handStateRef.current)
  }, [])

  const runDetectionLoop = useCallback(() => {
    if (loopTimerRef.current) window.clearTimeout(loopTimerRef.current)

    const detect = () => {
      if (!enabledRef.current) return

      const video = videoRef.current
      const landmarker = landmarkerRef.current
      const gameplayActive = gameplayActiveRef.current
      const menuActive = menuActiveRef.current
      const shouldDetect = gameplayActive || menuActive
      const now = performance.now()

      if (shouldDetect && landmarker && video && video.readyState >= 2) {
        try {
          const result = landmarker.detectForVideo(video, now)
          const landmarks = result.landmarks?.[0]

          if (!landmarks) {
            commitStableGesture('none')
          } else {
            const gesture = detectHandGesture(landmarks)
            const palm = getPalmPoint(landmarks)

            commitStableGesture(gesture)

            if (palm) {
              const x = (1 - palm.x) * window.innerWidth
              const y = palm.y * window.innerHeight
              const cursor = { x, y }
              cursorRef.current = cursor
              menuInputRef.current.cursor = cursor
              gameplayInputRef.current.aimX = Math.max(-1, Math.min(1, (x / Math.max(1, window.innerWidth)) * 2 - 1))
            }
          }

          updateMenuVisualState(now)
        } catch (detectError) {
          console.warn('Falha pontual ao processar mão:', detectError)
        }
      }

      // Menu pode ler mão com boa resposta porque o Canvas 3D não está montado.
      // Gameplay fica bem mais econômico e só escreve refs para o jogo.
      const closed = gameplayInputRef.current.handClosed === true || menuInputRef.current.handClosed === true
      const nextDelay = !shouldDetect ? 240 : menuActive ? 80 : closed ? 100 : 170
      loopTimerRef.current = window.setTimeout(detect, nextDelay)
    }

    loopTimerRef.current = window.setTimeout(detect, 60)
  }, [commitStableGesture, updateMenuVisualState])

  const enableCamera = useCallback(async () => {
    if (enabledRef.current) return true
    if (loadingRef.current) return false

    setError('')
    setLoading(true)
    loadingRef.current = true

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Este navegador não permite acesso à câmera.')
      }

      const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.20/wasm'
      )

      const landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          // Deixa a GPU livre para o Three.js/R3F quando o jogo montar.
          delegate: 'CPU'
        },
        runningMode: 'VIDEO',
        numHands: 1,
        minHandDetectionConfidence: 0.68,
        minHandPresenceConfidence: 0.68,
        minTrackingConfidence: 0.62
      })

      landmarkerRef.current = landmarker

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: 'user',
          width: { ideal: 256, max: 320 },
          height: { ideal: 192, max: 240 },
          frameRate: { ideal: 12, max: 15 }
        }
      })

      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Preview da câmera não foi encontrado.')

      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      video.muted = true
      await video.play()

      enabledRef.current = true
      loadingRef.current = false
      resetInputRefs()
      setEnabled(true)
      setLoading(false)
      runDetectionLoop()
      return true
    } catch (cameraError) {
      console.error(cameraError)
      setError(cameraError?.message || 'Não foi possível ativar a câmera.')
      enabledRef.current = false
      loadingRef.current = false
      stopCamera()
      return false
    }
  }, [resetInputRefs, runDetectionLoop, stopCamera])

  const handStatusLabel = enabled
    ? menuActive
      ? (menuHandState === 'closed' ? 'Mão fechada' : menuHandState === 'open' ? 'Mão aberta' : 'Procurando mão')
      : 'Câmera ativa'
    : 'Câmera desativada'

  return {
    videoRef,
    handStateRef,
    cursorRef,
    gameplayInputRef,
    menuInputRef,
    enabled,
    loading,
    error,
    handState: menuActive ? menuHandState : handStateRef.current,
    handStatusLabel,
    cursor: menuActive ? menuCursor : cursorRef.current,
    enableCamera,
    stopCamera
  }
}
