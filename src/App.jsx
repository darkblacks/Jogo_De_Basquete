import { useCallback, useEffect, useRef } from 'react'
import { GAME_SCREENS } from './constants.js'
import { useGameState } from './hooks/useGameState.js'
import { useKeyboardControls } from './hooks/useKeyboardControls.js'
import { useTouchControls } from './hooks/useTouchControls.js'
import { useWebcamHandControls } from './hooks/useWebcamHandControls.js'
import { GameCanvas } from './components/GameCanvas.jsx'
import { MainMenu } from './components/MainMenu.jsx'
import { HUD } from './components/HUD.jsx'
import { WebcamPreview } from './components/WebcamPreview.jsx'
import { HandCursor } from './components/HandCursor.jsx'
import { FinishedScreen } from './components/FinishedScreen.jsx'

export default function App() {
  const game = useGameState()
  const gameAreaRef = useRef(null)
  const autoCameraRequestedRef = useRef(false)
  const lastMenuHandClosedRef = useRef(false)
  const lastMenuClickRef = useRef(0)

  const menuActive = game.screen === GAME_SCREENS.MENU
  const isPlaying = game.screen === GAME_SCREENS.PLAYING
  const webcamGameplayActive = isPlaying && game.inputMode === 'webcam'
  const webcam = useWebcamHandControls({
    menuActive,
    gameplayActive: webcamGameplayActive
  })

  useKeyboardControls(game.actions, isPlaying)
  useTouchControls(gameAreaRef, game.actions, isPlaying)

  useEffect(() => {
    if (!menuActive) return undefined
    if (autoCameraRequestedRef.current) return undefined

    // Menu separado do jogo: pode pedir câmera e ler a mão sem montar/renderizar o Canvas 3D.
    const timeout = window.setTimeout(() => {
      autoCameraRequestedRef.current = true
      webcam.enableCamera()
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [menuActive, webcam])

  useEffect(() => {
    if (!menuActive || !webcam.enabled) return undefined

    let frameId = 0
    const updateMenuHandClick = () => {
      const input = webcam.menuInputRef?.current
      const handClosed = input?.handClosed === true
      const cursor = input?.cursor ?? webcam.cursorRef?.current
      const now = performance.now()

      if (handClosed && !lastMenuHandClosedRef.current && cursor && now - lastMenuClickRef.current > 550) {
        const element = document.elementFromPoint(cursor.x, cursor.y)
        const button = element?.closest?.('[data-hand-click="true"]')
        if (button && !button.disabled) {
          lastMenuClickRef.current = now
          button.click()
        }
      }

      lastMenuHandClosedRef.current = handClosed
      frameId = window.requestAnimationFrame(updateMenuHandClick)
    }

    frameId = window.requestAnimationFrame(updateMenuHandClick)
    return () => window.cancelAnimationFrame(frameId)
  }, [menuActive, webcam])

  useEffect(() => {
    if (menuActive) return
    lastMenuHandClosedRef.current = false
  }, [menuActive])

  const startNormal = useCallback(() => {
    webcam.stopCamera()
    game.actions.resetMatch('normal')
  }, [game.actions, webcam])

  const startCamera = useCallback(async () => {
    if (!webcam.enabled) {
      const started = await webcam.enableCamera()
      if (!started) return
    }
    game.actions.resetMatch('webcam')
  }, [game.actions, webcam])

  const showGameCanvas = game.screen !== GAME_SCREENS.MENU

  return (
    <div className="app-shell" ref={gameAreaRef}>
      {showGameCanvas && <GameCanvas game={game} webcam={webcam} />}

      {game.screen === GAME_SCREENS.PLAYING && (
        <HUD
          score={game.score}
          timeLeft={game.timeLeft}
          availableBalls={game.availableBalls}
          power={game.power}
          onMenu={game.actions.goToMenu}
        />
      )}

      {game.screen === GAME_SCREENS.MENU && (
        <MainMenu
          webcam={webcam}
          onStartNormal={startNormal}
          onStartCamera={startCamera}
        />
      )}

      {game.screen === GAME_SCREENS.FINISHED && (
        <FinishedScreen
          score={game.score}
          onRestart={() => game.actions.resetMatch(game.inputMode)}
          onMenu={game.actions.goToMenu}
        />
      )}

      <WebcamPreview
        videoRef={webcam.videoRef}
        enabled={webcam.enabled}
        loading={webcam.loading}
        handStatusLabel={webcamGameplayActive ? 'Câmera ativa' : webcam.handStatusLabel}
        error={webcam.error}
      />

      <HandCursor
        enabled={menuActive && webcam.enabled}
        cursor={webcam.cursor}
        handState={webcam.handState}
      />
    </div>
  )
}
