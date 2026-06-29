import { useEffect, useRef } from 'react'
import { clamp } from '../utils/math.js'

function pointerToAim(pointerX) {
  return clamp((pointerX / window.innerWidth) * 2 - 1, -1, 1)
}

export function useTouchControls(targetRef, actions, enabled) {
  const activePointerId = useRef(null)

  useEffect(() => {
    const target = targetRef.current
    if (!enabled || !target) return undefined

    const shouldIgnore = (event) => {
      if (event.pointerType !== 'touch') return true
      return Boolean(event.target.closest?.('[data-ui="true"]'))
    }

    const onPointerDown = (event) => {
      if (shouldIgnore(event)) return
      activePointerId.current = event.pointerId
      event.preventDefault()
      target.setPointerCapture?.(event.pointerId)
      actions.setAimAbsolute(pointerToAim(event.clientX))
      actions.startCharge()
    }

    const onPointerMove = (event) => {
      if (event.pointerId !== activePointerId.current) return
      event.preventDefault()
      actions.setAimAbsolute(pointerToAim(event.clientX))
    }

    const finishTouch = (event) => {
      if (event.pointerId !== activePointerId.current) return
      event.preventDefault()
      activePointerId.current = null
      actions.releaseThrow()
    }

    target.addEventListener('pointerdown', onPointerDown, { passive: false })
    target.addEventListener('pointermove', onPointerMove, { passive: false })
    target.addEventListener('pointerup', finishTouch, { passive: false })
    target.addEventListener('pointercancel', finishTouch, { passive: false })

    return () => {
      target.removeEventListener('pointerdown', onPointerDown)
      target.removeEventListener('pointermove', onPointerMove)
      target.removeEventListener('pointerup', finishTouch)
      target.removeEventListener('pointercancel', finishTouch)
    }
  }, [actions, enabled, targetRef])
}
