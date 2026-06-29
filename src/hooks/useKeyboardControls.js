import { useEffect, useRef } from 'react'

export function useKeyboardControls(actions, enabled) {
  const pressed = useRef({ left: false, right: false, space: false })

  useEffect(() => {
    if (!enabled) return undefined

    const onKeyDown = (event) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') pressed.current.left = true
      if (event.code === 'ArrowRight' || event.code === 'KeyD') pressed.current.right = true

      if (event.code === 'Space') {
        event.preventDefault()
        if (!pressed.current.space) actions.startCharge()
        pressed.current.space = true
      }

      if (event.code === 'KeyR') actions.resetBall()
    }

    const onKeyUp = (event) => {
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') pressed.current.left = false
      if (event.code === 'ArrowRight' || event.code === 'KeyD') pressed.current.right = false

      if (event.code === 'Space') {
        event.preventDefault()
        pressed.current.space = false
        actions.releaseThrow()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    let frameId = 0
    const update = () => {
      if (pressed.current.left) actions.aimBy(-0.025)
      if (pressed.current.right) actions.aimBy(0.025)
      frameId = window.requestAnimationFrame(update)
    }
    frameId = window.requestAnimationFrame(update)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.cancelAnimationFrame(frameId)
      pressed.current = { left: false, right: false, space: false }
    }
  }, [actions, enabled])
}
