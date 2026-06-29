import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BALL_STATES, GAME_DURATION_SECONDS, GAME_SCREENS, TOTAL_BALLS } from '../constants.js'
import { clamp, triangular01 } from '../utils/math.js'

export function useGameState() {
  const [screen, setScreen] = useState(GAME_SCREENS.MENU)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS)
  const [aim, setAim] = useState(0)
  const [power, setPower] = useState(0)
  const [ballState, setBallState] = useState(BALL_STATES.UNAVAILABLE)
  const [availableBalls, setAvailableBalls] = useState(0)
  const [lastShot, setLastShot] = useState(null)
  const [resetToken, setResetToken] = useState(0)
  const [frontBarFlashToken, setFrontBarFlashToken] = useState(0)
  const [inputMode, setInputMode] = useState('pc')

  const screenRef = useRef(screen)
  const timeLeftRef = useRef(timeLeft)
  const inputModeRef = useRef(inputMode)
  const aimRef = useRef(aim)
  const powerRef = useRef(power)
  const ballStateRef = useRef(ballState)
  const availableBallsRef = useRef(availableBalls)
  const scoreLockRef = useRef(false)
  const chargeIntentRef = useRef(false)
  const hoopXRef = useRef(0)

  useEffect(() => { screenRef.current = screen }, [screen])
  useEffect(() => { timeLeftRef.current = timeLeft }, [timeLeft])
  useEffect(() => { inputModeRef.current = inputMode }, [inputMode])
  useEffect(() => { aimRef.current = aim }, [aim])
  useEffect(() => { powerRef.current = power }, [power])
  useEffect(() => { ballStateRef.current = ballState }, [ballState])
  useEffect(() => { availableBallsRef.current = availableBalls }, [availableBalls])

  const resetMatch = useCallback((mode = 'pc') => {
    screenRef.current = GAME_SCREENS.PLAYING
    timeLeftRef.current = GAME_DURATION_SECONDS
    inputModeRef.current = mode
    setScreen(GAME_SCREENS.PLAYING)
    setScore(0)
    setTimeLeft(GAME_DURATION_SECONDS)
    aimRef.current = 0
    powerRef.current = 0
    ballStateRef.current = BALL_STATES.UNAVAILABLE
    availableBallsRef.current = 0
    setAim(0)
    setPower(0)
    setBallState(BALL_STATES.UNAVAILABLE)
    setAvailableBalls(0)
    setInputMode(mode)
    scoreLockRef.current = false
    chargeIntentRef.current = false
    hoopXRef.current = 0
    setResetToken((value) => value + 1)
  }, [])

  const goToMenu = useCallback(() => {
    screenRef.current = GAME_SCREENS.MENU
    setScreen(GAME_SCREENS.MENU)
    ballStateRef.current = BALL_STATES.UNAVAILABLE
    availableBallsRef.current = 0
    powerRef.current = 0
    setBallState(BALL_STATES.UNAVAILABLE)
    setAvailableBalls(0)
    setPower(0)
    chargeIntentRef.current = false
    hoopXRef.current = 0
  }, [])

  useEffect(() => {
    if (screen !== GAME_SCREENS.PLAYING) return undefined

    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          screenRef.current = GAME_SCREENS.FINISHED
          timeLeftRef.current = 0
          setScreen(GAME_SCREENS.FINISHED)
          ballStateRef.current = BALL_STATES.UNAVAILABLE
          powerRef.current = 0
          setBallState(BALL_STATES.UNAVAILABLE)
          setPower(0)
          chargeIntentRef.current = false
          hoopXRef.current = 0
          return 0
        }
        const next = current - 1
        timeLeftRef.current = next
        return next
      })
    }, 1000)

    return () => window.clearInterval(timer)
  }, [screen])

  useEffect(() => {
    if (ballState !== BALL_STATES.CHARGING) {
      if (ballState === BALL_STATES.AVAILABLE || ballState === BALL_STATES.UNAVAILABLE) {
        powerRef.current = 0
        setPower(0)
      }
      return undefined
    }

    let frameId = 0
    const startedAt = performance.now()
    let lastUiUpdate = 0

    const update = () => {
      const now = performance.now()
      const elapsed = (now - startedAt) / 1000
      const nextPower = triangular01(elapsed, 0.9)
      powerRef.current = nextPower

      // Gameplay usa powerRef em tempo real. O React/HUD só atualiza ~12fps
      // para não re-renderizar a aplicação toda enquanto a câmera está ativa.
      if (now - lastUiUpdate > 83) {
        lastUiUpdate = now
        setPower(nextPower)
      }

      frameId = window.requestAnimationFrame(update)
    }

    frameId = window.requestAnimationFrame(update)
    return () => window.cancelAnimationFrame(frameId)
  }, [ballState])

  const aimBy = useCallback((delta) => {
    if (screenRef.current !== GAME_SCREENS.PLAYING) return
    const nextAim = clamp(aimRef.current + delta, -1, 1)
    aimRef.current = nextAim
    setAim(nextAim)
  }, [])

  const setAimAbsolute = useCallback((value) => {
    if (screenRef.current !== GAME_SCREENS.PLAYING) return
    const nextAim = clamp(value, -1, 1)
    aimRef.current = nextAim
    setAim(nextAim)
  }, [])

  const startCharge = useCallback(() => {
    if (screenRef.current !== GAME_SCREENS.PLAYING) return false

    // Intenção global de "pegar/segurar". Isso é importante para manter
    // PC, mobile e webcam com o mesmo comportamento: se o jogador segurar
    // antes de uma bola ficar disponível, a carga começa automaticamente
    // assim que alguma bola encostar na barra e ficar laranja.
    chargeIntentRef.current = true

    if (ballStateRef.current === BALL_STATES.CHARGING) return true
    if (availableBallsRef.current <= 0) return false

    ballStateRef.current = BALL_STATES.CHARGING
    setBallState(BALL_STATES.CHARGING)
    return true
  }, [])

  const releaseThrow = useCallback(() => {
    chargeIntentRef.current = false

    if (screenRef.current !== GAME_SCREENS.PLAYING) return false
    if (ballStateRef.current !== BALL_STATES.CHARGING) {
      powerRef.current = 0
      setPower(0)
      return false
    }

    const shot = {
      id: Date.now() + Math.random(),
      aim: aimRef.current,
      power: powerRef.current
    }

    scoreLockRef.current = false
    setLastShot(shot)
    ballStateRef.current = BALL_STATES.THROWN
    setBallState(BALL_STATES.THROWN)
    return true
  }, [])

  const resetBall = useCallback(() => {
    chargeIntentRef.current = false
    ballStateRef.current = BALL_STATES.UNAVAILABLE
    powerRef.current = 0
    availableBallsRef.current = 0
    setBallState(BALL_STATES.UNAVAILABLE)
    setPower(0)
    setAvailableBalls(0)
    scoreLockRef.current = false
    setResetToken((value) => value + 1)
  }, [])

  const flashFrontBar = useCallback(() => {
    setFrontBarFlashToken((value) => value + 1)
  }, [])

  const recoverBallFromBar = useCallback(() => {
    flashFrontBar()
  }, [flashFrontBar])

  const syncAvailableBalls = useCallback((count) => {
    const safeCount = clamp(Math.round(count), 0, TOTAL_BALLS)
    availableBallsRef.current = safeCount
    setAvailableBalls(safeCount)

    if (screenRef.current !== GAME_SCREENS.PLAYING) return
    if (ballStateRef.current === BALL_STATES.CHARGING) return

    if (chargeIntentRef.current && safeCount > 0) {
      ballStateRef.current = BALL_STATES.CHARGING
      setBallState(BALL_STATES.CHARGING)
      return
    }

    const nextState = safeCount > 0 ? BALL_STATES.AVAILABLE : BALL_STATES.UNAVAILABLE
    ballStateRef.current = nextState
    setBallState(nextState)
  }, [])

  const makeBallUnavailableInPlay = useCallback(() => {
    if (ballStateRef.current !== BALL_STATES.CHARGING) {
      const nextState = availableBallsRef.current > 0 ? BALL_STATES.AVAILABLE : BALL_STATES.UNAVAILABLE
      ballStateRef.current = nextState
      setBallState(nextState)
    }
  }, [])

  const recoverFromBadPlace = useCallback(() => {
    chargeIntentRef.current = false
    ballStateRef.current = BALL_STATES.UNAVAILABLE
    setBallState(BALL_STATES.UNAVAILABLE)
  }, [])

  const addScoreIfValid = useCallback(() => {
    if (scoreLockRef.current) return false
    scoreLockRef.current = true
    setScore((current) => current + 2)
    window.setTimeout(() => {
      scoreLockRef.current = false
    }, 180)
    return true
  }, [])

  const actions = useMemo(() => ({
    aimBy,
    setAimAbsolute,
    startCharge,
    releaseThrow,
    resetBall,
    recoverBallFromBar,
    recoverFromBadPlace,
    makeBallUnavailableInPlay,
    addScoreIfValid,
    resetMatch,
    goToMenu,
    flashFrontBar,
    syncAvailableBalls
  }), [
    aimBy,
    setAimAbsolute,
    startCharge,
    releaseThrow,
    resetBall,
    recoverBallFromBar,
    recoverFromBadPlace,
    makeBallUnavailableInPlay,
    addScoreIfValid,
    resetMatch,
    goToMenu,
    flashFrontBar,
    syncAvailableBalls
  ])

  return {
    screen,
    score,
    timeLeft,
    aim,
    power,
    ballState,
    availableBalls,
    lastShot,
    resetToken,
    frontBarFlashToken,
    inputMode,
    actions,
    refs: {
      screen: screenRef,
      timeLeft: timeLeftRef,
      inputMode: inputModeRef,
      aim: aimRef,
      power: powerRef,
      ballState: ballStateRef,
      availableBalls: availableBallsRef,
      hoopX: hoopXRef
    }
  }
}
