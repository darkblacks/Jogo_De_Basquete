import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BallCollider, RigidBody } from '@react-three/rapier'
import { useFrame } from '@react-three/fiber'
import {
  BALL_COLORS,
  BALL_RADIUS,
  BALL_STARTS,
  BALL_STATES,
  GAME_SCREENS,
  HOOP,
  AIM_X_RANGE,
  LAUNCH_POS,
  READY_SLOTS,
  TOTAL_BALLS
} from '../constants.js'

function createBallMeta(status = 'locked') {
  return {
    status,
    slot: null,
    scored: false,
    previousY: null,
    shotAge: 0,
    touchedSurface: false,
    returnDelay: 0,
    badPlaceTime: 0,
    redAge: 0,
    unavailableAge: 0
  }
}

function ballColor(meta) {
  if (!meta) return BALL_COLORS.unavailable
  if (meta.status === 'ready') return BALL_COLORS.available
  if (meta.status === 'held') return BALL_COLORS.charging
  if (meta.status === 'shot' && !meta.touchedSurface && (meta.shotAge ?? 0) < 1.8) return BALL_COLORS.thrown
  return BALL_COLORS.unavailable
}

function BallLines() {
  return (
    <group>
      <mesh>
        <torusGeometry args={[BALL_RADIUS * 1.012, 0.006, 8, 64]} />
        <meshStandardMaterial color="#201006" roughness={0.62} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BALL_RADIUS * 1.012, 0.006, 8, 64]} />
        <meshStandardMaterial color="#201006" roughness={0.62} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[BALL_RADIUS * 1.012, 0.006, 8, 64]} />
        <meshStandardMaterial color="#201006" roughness={0.62} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, Math.PI / 4]} scale={[1, 0.56, 1]}>
        <torusGeometry args={[BALL_RADIUS * 0.9, 0.0055, 8, 64]} />
        <meshStandardMaterial color="#201006" roughness={0.62} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, -Math.PI / 4]} scale={[1, 0.56, 1]}>
        <torusGeometry args={[BALL_RADIUS * 0.9, 0.0055, 8, 64]} />
        <meshStandardMaterial color="#201006" roughness={0.62} />
      </mesh>
    </group>
  )
}

function BasketballMesh({ color }) {
  return (
    <group>
      <mesh castShadow receiveShadow>
        <sphereGeometry args={[BALL_RADIUS, 48, 32]} />
        <meshStandardMaterial
          color={color}
          roughness={0.56}
          metalness={0.05}
          emissive={color === BALL_COLORS.charging || color === BALL_COLORS.thrown ? '#0a6d29' : '#000000'}
          emissiveIntensity={color === BALL_COLORS.charging || color === BALL_COLORS.thrown ? 0.26 : 0}
        />
      </mesh>
      <BallLines />
    </group>
  )
}

function HeldBallVisual({ game }) {
  const groupRef = useRef(null)

  useFrame(() => {
    const group = groupRef.current
    if (!group) return

    const screen = game.refs?.screen?.current ?? game.screen
    const isPlaying = screen === GAME_SCREENS.PLAYING
    const isCharging = (game.refs?.ballState?.current ?? game.ballState) === BALL_STATES.CHARGING
    group.visible = isPlaying && isCharging

    if (group.visible) {
      const aim = game.refs?.aim?.current ?? game.aim
      group.position.set(aim * AIM_X_RANGE, LAUNCH_POS[1], LAUNCH_POS[2])
      group.rotation.y += 0.035
    }
  })

  return (
    <group ref={groupRef} visible={false}>
      <BasketballMesh color={BALL_COLORS.charging} />
      <mesh position={[0, -BALL_RADIUS - 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[BALL_RADIUS * 0.92, 40]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.2} depthWrite={false} />
      </mesh>
    </group>
  )
}

export function Basketball({ game, webcam }) {
  const bodyRefs = useRef([])
  const metaRefs = useRef(Array.from({ length: TOTAL_BALLS }, () => createBallMeta()))
  const readyCountRef = useRef(0)
  const heldBallRef = useRef(null)
  const lastShotIdRef = useRef(null)
  const lastResetRef = useRef(null)
  const aimRef = useRef(game.aim)
  const lastWebcamHandClosedRef = useRef(false)
  const lastWebcamHandStateRef = useRef('none')
  const [, setRenderVersion] = useState(0)

  const markDirty = useCallback(() => {
    setRenderVersion((value) => value + 1)
  }, [])

  useEffect(() => {
    aimRef.current = game.aim
  }, [game.aim])

  const stopBody = useCallback((body) => {
    if (!body) return
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    body.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }, [])

  const updateReadyCount = useCallback(() => {
    const count = metaRefs.current.filter((meta) => meta.status === 'ready').length
    if (count !== readyCountRef.current) {
      readyCountRef.current = count
      game.actions.syncAvailableBalls(count)
    }
  }, [game.actions])

  const setBallPosition = useCallback((index, position, gravityScale = 0) => {
    const body = bodyRefs.current[index]
    if (!body) return

    body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true)
    body.setGravityScale(gravityScale, true)
    stopBody(body)
    body.wakeUp?.()
  }, [stopBody])

  const findFreeSlot = useCallback((preferredX = 0) => {
    const used = new Set(
      metaRefs.current
        .filter((meta) => meta.slot !== null && (meta.status === 'ready' || meta.status === 'held'))
        .map((meta) => meta.slot)
    )

    const sorted = READY_SLOTS
      .map((x, index) => ({ index, x, distance: Math.abs(x - preferredX) }))
      .sort((a, b) => a.distance - b.distance)

    return sorted.find((slot) => !used.has(slot.index))?.index ?? sorted[0].index
  }, [])

  const sendBallToRamp = useCallback((index) => {
    const body = bodyRefs.current[index]
    const meta = metaRefs.current[index]
    const start = BALL_STARTS[index]
    if (!body || !meta) return

    meta.status = 'rolling'
    meta.slot = null
    meta.scored = false
    meta.previousY = null
    meta.shotAge = 0
    meta.touchedSurface = true
    meta.returnDelay = 0
    meta.badPlaceTime = 0
    meta.redAge = 0
    meta.unavailableAge = 0

    body.setGravityScale(1, true)
    body.setTranslation({ x: start[0], y: start[1], z: start[2] }, true)
    body.setLinvel({ x: 0, y: -0.15, z: 1.35 }, true)
    body.setAngvel({ x: 4.0, y: 0, z: 0.1 }, true)
    body.wakeUp?.()

    updateReadyCount()
    markDirty()
  }, [markDirty, updateReadyCount])

  const ballIsInBadPlace = useCallback((meta, pos, velocity, delta) => {
    if (!meta || meta.status === 'ready' || meta.status === 'held' || meta.status === 'returning') {
      return false
    }

    const speed = Math.abs(velocity.x) + Math.abs(velocity.y) + Math.abs(velocity.z)

    // Limites físicos do arcade. Se uma bola escapar da baia, ficar presa
    // atrás da tabela/rede, cair para fora do chão ou parar em uma área onde
    // não dá para jogar, ela deve voltar para a esteira automaticamente.
    const escapedScene =
      pos.y < -0.55 ||
      pos.z < -4.75 ||
      pos.z > 3.05 ||
      Math.abs(pos.x) > 2.85 ||
      pos.y > 4.65

    const trappedBehindHoop = meta.status === 'shot' && meta.shotAge > 0.9 && (
      pos.z < -3.88 ||
      (pos.z < -3.05 && pos.y > 1.05 && speed < 0.18) ||
      (pos.z < -2.55 && pos.y > 0.92 && pos.y < 1.95 && speed < 0.08)
    )

    const stoppedAwayFromPlayableBay =
      meta.status === 'shot' &&
      meta.shotAge > 1.2 &&
      speed < 0.045 &&
      !(pos.z > 0.85 && pos.y < 1.15 && Math.abs(pos.x) < 2.35)

    const rollingStuckBeforeFront =
      meta.status === 'rolling' &&
      meta.shotAge > 4.0 &&
      speed < 0.04 &&
      pos.z < 1.2

    if (escapedScene || trappedBehindHoop || stoppedAwayFromPlayableBay || rollingStuckBeforeFront) {
      meta.badPlaceTime += delta
    } else {
      meta.badPlaceTime = 0
    }

    return meta.badPlaceTime > 0.22
  }, [])

  const markBallReady = useCallback((index, flash = true) => {
    const body = bodyRefs.current[index]
    const meta = metaRefs.current[index]
    if (!body || !meta) return
    if (meta.status === 'ready' || meta.status === 'held') return

    const pos = body.translation()
    const slot = findFreeSlot(pos.x)
    meta.status = 'ready'
    meta.slot = slot
    meta.scored = false
    meta.previousY = null
    meta.shotAge = 0
    meta.touchedSurface = false
    meta.returnDelay = 0
    meta.badPlaceTime = 0
    meta.redAge = 0
    meta.unavailableAge = 0

    // Ao bater na barra frontal, a bola fica disponível/laranja exatamente
    // onde ela encostou. Não levantamos nem encaixamos a bola em slot aqui.
    // Ela só sobe para a posição de arremesso quando o jogador realmente pega/carrega.
    body.setGravityScale(0, true)
    stopBody(body)
    body.wakeUp?.()

    updateReadyCount()
    if (flash) game.actions.flashFrontBar()
    markDirty()
  }, [findFreeSlot, game.actions, markDirty, stopBody, updateReadyCount])

  const putBallInReturn = useCallback((index, delay = 0.45) => {
    const meta = metaRefs.current[index]
    if (!meta) return
    meta.status = 'returning'
    meta.slot = null
    meta.scored = false
    meta.previousY = null
    meta.shotAge = 0
    meta.touchedSurface = true
    meta.returnDelay = delay
    meta.badPlaceTime = 0
    meta.redAge = 0
    meta.unavailableAge = 0
    updateReadyCount()
    markDirty()
  }, [markDirty, updateReadyCount])

  const pickReadyBallIndex = useCallback(() => {
    const readyIndexes = metaRefs.current
      .map((meta, index) => ({ meta, index }))
      .filter(({ meta }) => meta.status === 'ready')
      .map(({ index }) => index)

    if (readyIndexes.length === 0) return -1

    const targetX = aimRef.current * AIM_X_RANGE
    return readyIndexes.reduce((best, current) => {
      const currentBody = bodyRefs.current[current]
      const bestBody = bodyRefs.current[best]
      const currentX = currentBody?.translation?.().x ?? 0
      const bestX = bestBody?.translation?.().x ?? 0
      return Math.abs(currentX - targetX) < Math.abs(bestX - targetX) ? current : best
    }, readyIndexes[0])
  }, [])

  const holdReadyBall = useCallback(() => {
    if (heldBallRef.current !== null) return true
    const index = pickReadyBallIndex()
    if (index < 0) {
      updateReadyCount()
      return false
    }

    const meta = metaRefs.current[index]
    meta.status = 'held'
    meta.slot = null
    meta.scored = false
    meta.previousY = null
    meta.shotAge = 0
    meta.touchedSurface = false
    meta.badPlaceTime = 0
    meta.redAge = 0
    meta.unavailableAge = 0
    heldBallRef.current = index

    setBallPosition(index, [aimRef.current * AIM_X_RANGE, LAUNCH_POS[1], LAUNCH_POS[2]], 0)
    updateReadyCount()
    markDirty()
    return true
  }, [markDirty, pickReadyBallIndex, setBallPosition, updateReadyCount])

  const launchHeldBall = useCallback((shot) => {
    let index = heldBallRef.current
    if (index === null || index === undefined) {
      index = pickReadyBallIndex()
    }
    if (index < 0) return

    const body = bodyRefs.current[index]
    const meta = metaRefs.current[index]
    if (!body || !meta) return

    const power = Math.max(0.12, Math.min(1, shot.power))
    const aim = Math.max(-1, Math.min(1, shot.aim))
    const launchX = aim * AIM_X_RANGE

    meta.status = 'shot'
    meta.slot = null
    meta.scored = false
    meta.previousY = LAUNCH_POS[1]
    meta.shotAge = 0
    meta.touchedSurface = false
    meta.returnDelay = 0
    meta.badPlaceTime = 0
    meta.redAge = 0
    meta.unavailableAge = 0
    heldBallRef.current = null

    body.setTranslation({ x: launchX, y: LAUNCH_POS[1], z: LAUNCH_POS[2] }, true)
    body.setGravityScale(1, true)
    body.setLinvel({
      x: aim * 1.65,
      y: 3.9 + power * 3.45,
      z: -5.95 - power * 2.45
    }, true)
    body.setAngvel({ x: -8.5 - power * 4.5, y: aim * 1.4, z: aim * 2.2 }, true)
    body.wakeUp?.()

    updateReadyCount()
    markDirty()
  }, [markDirty, pickReadyBallIndex, updateReadyCount])

  useEffect(() => {
    if (game.screen !== GAME_SCREENS.PLAYING) return
    if (lastResetRef.current === game.resetToken) return
    lastResetRef.current = game.resetToken

    heldBallRef.current = null
    readyCountRef.current = 0
    game.actions.syncAvailableBalls(0)
    metaRefs.current = Array.from({ length: TOTAL_BALLS }, () => createBallMeta('rolling'))
    for (let index = 0; index < TOTAL_BALLS; index += 1) {
      window.setTimeout(() => sendBallToRamp(index), index * 180)
    }
    markDirty()
  }, [game.actions, game.resetToken, game.screen, markDirty, sendBallToRamp])

  useEffect(() => {
    if (!game.lastShot || lastShotIdRef.current === game.lastShot.id) return
    lastShotIdRef.current = game.lastShot.id
    launchHeldBall(game.lastShot)
  }, [game.lastShot, launchHeldBall])

  const readWebcamInput = useCallback(() => {
    const screen = game.refs?.screen?.current ?? game.screen
    const inputMode = game.refs?.inputMode?.current ?? game.inputMode
    if (inputMode !== 'webcam' || screen !== GAME_SCREENS.PLAYING) return false

    const input = webcam?.gameplayInputRef?.current
    if (!input) return false

    const aim = Math.max(-1, Math.min(1, input.aimX ?? 0))
    aimRef.current = aim
    if (game.refs?.aim) game.refs.aim.current = aim

    const handClosed = input.handClosed === true
    const handState = input.handState ?? 'none'
    const wasClosed = lastWebcamHandClosedRef.current

    // Webcam não controla física nem estado continuamente.
    // Ela só emite transições globais: fechou = pegar/carregar, abriu = soltar/arremessar.
    if (handClosed && !wasClosed) {
      game.actions.startCharge()
    }

    if (!handClosed && wasClosed && handState === 'open') {
      game.actions.releaseThrow()
    }

    lastWebcamHandClosedRef.current = handClosed
    lastWebcamHandStateRef.current = handState
    return true
  }, [game, webcam])

  useFrame((_, delta) => {
    // PC/mobile continuam vindo das actions. Webcam escreve só em ref e é lida aqui.
    const webcamInputActive = readWebcamInput()
    if (!webcamInputActive) {
      aimRef.current = game.refs?.aim?.current ?? game.aim
      lastWebcamHandClosedRef.current = false
      lastWebcamHandStateRef.current = 'none'
    }

    const screen = game.refs?.screen?.current ?? game.screen
    if (screen !== GAME_SCREENS.PLAYING) {
      for (let index = 0; index < TOTAL_BALLS; index += 1) {
        const meta = metaRefs.current[index]
        if (meta.status !== 'locked') {
          metaRefs.current[index] = createBallMeta('locked')
          setBallPosition(index, BALL_STARTS[index], 0)
        }
      }
      if (readyCountRef.current !== 0) {
        readyCountRef.current = 0
        game.actions.syncAvailableBalls(0)
      }
      heldBallRef.current = null
      return
    }

    const isCharging = (game.refs?.ballState?.current ?? game.ballState) === BALL_STATES.CHARGING

    if (isCharging) {
      const hasBall = holdReadyBall()
      if (hasBall && heldBallRef.current !== null) {
        setBallPosition(heldBallRef.current, [aimRef.current * AIM_X_RANGE, LAUNCH_POS[1], LAUNCH_POS[2]], 0)
      }
    }

    for (let index = 0; index < TOTAL_BALLS; index += 1) {
      const body = bodyRefs.current[index]
      const meta = metaRefs.current[index]
      if (!body || !meta) continue

      const pos = body.translation()
      const velocity = body.linvel()

      // Reset central, independente do controle usado.
      // Se a bola estiver indisponível/vermelha por mais de 8s, ela cai de novo
      // na esteira/rampa. O arremesso só fica verde no começo do trajeto.
      const isUnavailable =
        meta.status !== 'ready' &&
        meta.status !== 'held' &&
        meta.status !== 'locked'

      if (isUnavailable) {
        meta.unavailableAge = (meta.unavailableAge ?? 0) + delta
      } else {
        meta.unavailableAge = 0
      }

      if (meta.status === 'shot' && !meta.touchedSurface && (meta.shotAge ?? 0) > 1.8) {
        meta.touchedSurface = true
        markDirty()
      }

      const isRedBall =
        isUnavailable &&
        !(meta.status === 'shot' && !meta.touchedSurface && (meta.shotAge ?? 0) < 1.8)

      if (isRedBall) {
        meta.redAge = (meta.redAge ?? 0) + delta
        if (meta.redAge > 8.0) {
          sendBallToRamp(index)
          continue
        }
      } else {
        meta.redAge = 0
      }

      // Failsafe: mesmo se algum material/cor atrasar, nenhuma bola fica presa
      // fora do estado jogável por tempo infinito.
      if (isUnavailable && (meta.unavailableAge ?? 0) > 11.0) {
        sendBallToRamp(index)
        continue
      }

      if (meta.status === 'rolling') {
        meta.shotAge += delta
      }

      if (ballIsInBadPlace(meta, pos, velocity, delta)) {
        sendBallToRamp(index)
        continue
      }

      if (meta.status === 'ready') {
        // Bola disponível fica parada onde encostou na barra frontal.
        // Não reposicionamos nem encaixamos em slot: só a deixamos laranja na baia
        // até o jogador segurar/fechar a mão para arremessar.
        body.setGravityScale(0, false)
        stopBody(body)
        continue
      }

      if (meta.status === 'held') {
        setBallPosition(index, [aimRef.current * AIM_X_RANGE, LAUNCH_POS[1], LAUNCH_POS[2]], 0)
        continue
      }

      if (meta.status === 'returning') {
        meta.returnDelay -= delta
        if (meta.returnDelay <= 0) sendBallToRamp(index)
        continue
      }

      const reachedFrontBar = pos.z >= 1.43 && pos.y <= 1.04 && Math.abs(pos.x) < 2.5
      const clearlyOut = pos.y < -2.2 || pos.z < -6.8 || pos.z > 5.3 || Math.abs(pos.x) > 5.25
      const stuck = Math.abs(velocity.x) + Math.abs(velocity.y) + Math.abs(velocity.z) < 0.035

      if (meta.status === 'rolling') {
        if (reachedFrontBar || (stuck && pos.z > 0.35)) {
          markBallReady(index, true)
          continue
        }
        if (clearlyOut || meta.shotAge > 8.0) {
          sendBallToRamp(index)
          continue
        }
      }

      if (meta.status === 'shot') {
        meta.shotAge += delta
        const previousY = meta.previousY ?? pos.y
        const [, hoopY, hoopZ] = HOOP.center
        const hoopX = game.refs?.hoopX?.current ?? HOOP.center[0]
        const dx = pos.x - hoopX
        const dz = pos.z - hoopZ
        const distanceFromHoopCenter = Math.sqrt(dx * dx + dz * dz)
        const crossedHoopDown = previousY > hoopY && pos.y <= hoopY && velocity.y < -0.02

        if (!meta.scored && crossedHoopDown && distanceFromHoopCenter < HOOP.radius * 0.62) {
          meta.scored = true
          meta.touchedSurface = true
          game.actions.addScoreIfValid()
          // Depois de pontuar, a bola continua física: cai na rampa/baia
          // e só volta a ficar disponível quando bater na barra frontal.
          markDirty()
        }

        if (distanceFromHoopCenter < HOOP.radius + 0.2 && Math.abs(pos.y - hoopY) < 0.32) {
          if (!meta.touchedSurface) {
            meta.touchedSurface = true
            markDirty()
          }
        }

        if (reachedFrontBar) {
          markBallReady(index, true)
          continue
        }

        if (clearlyOut) {
          // Segurança: só reposiciona se a bola realmente escapar da baia/cenário.
          // Em uso normal, as paredes e a barra mantêm a bola dentro do arcade.
          sendBallToRamp(index)
          continue
        }

        // O reset por tempo fica centralizado na regra de bola vermelha acima.

        meta.previousY = pos.y
      }
    }
  })

  const handleCollisionEnter = useCallback((index, event) => {
    const meta = metaRefs.current[index]
    if (!meta) return

    const type =
      event?.other?.rigidBodyObject?.userData?.type ||
      event?.other?.colliderObject?.userData?.type ||
      event?.other?.rigidBodyObject?.name ||
      event?.other?.colliderObject?.name

    if (type === 'frontBar' || type === 'front-bar') {
      markBallReady(index, true)
      return
    }

    if (meta.status === 'shot' && !meta.touchedSurface) {
      meta.touchedSurface = true
      markDirty()
    }
  }, [markBallReady, markDirty])

  const ballPositions = useMemo(() => BALL_STARTS.map((position) => [...position]), [])

  return (
    <group>
      {ballPositions.map((position, index) => {
        const meta = metaRefs.current[index]
        const color = ballColor(meta)
        return (
          <RigidBody
            key={index}
            ref={(body) => {
              if (body) bodyRefs.current[index] = body
            }}
            type="dynamic"
            colliders={false}
            canSleep={false}
            restitution={0.42}
            friction={0.82}
            linearDamping={0.025}
            angularDamping={0.06}
            ccd
            position={position}
            name={`basketball-${index + 1}`}
            userData={{ type: 'basketball', index }}
            onCollisionEnter={(event) => handleCollisionEnter(index, event)}
          >
            <BallCollider args={[BALL_RADIUS]} />
            <group visible={meta.status !== 'held'}>
              <BasketballMesh color={color} />
            </group>
          </RigidBody>
        )
      })}
      <HeldBallVisual game={game} />
    </group>
  )
}
