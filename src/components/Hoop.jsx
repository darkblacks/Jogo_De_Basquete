import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BallCollider, CuboidCollider, RigidBody } from '@react-three/rapier'
import { Line, Text } from '@react-three/drei'
import { GAME_SCREENS, HOOP, HOOP_MOTION } from '../constants.js'

function smoothstep(value) {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}

function getHoopLinearSpeed(timeLeft) {
  if (timeLeft > HOOP_MOTION.startTimeLeft) return 0

  const durationToMax = HOOP_MOTION.startTimeLeft - HOOP_MOTION.maxSpeedTimeLeft
  const elapsed = HOOP_MOTION.startTimeLeft - Math.max(timeLeft, HOOP_MOTION.maxSpeedTimeLeft)
  const progress = smoothstep(elapsed / durationToMax)
  const cyclesPerSecond = HOOP_MOTION.minCyclesPerSecond +
    (HOOP_MOTION.maxCyclesPerSecond - HOOP_MOTION.minCyclesPerSecond) * progress

  // Movimento retilíneo e uniforme entre as extremidades.
  // 1 ciclo completo percorre: direita -> esquerda -> direita = amplitude * 4.
  return cyclesPerSecond * HOOP_MOTION.amplitude * 4
}

function pingPongOffset(distance, amplitude) {
  const travel = amplitude * 2
  const cycle = travel * 2
  const wrapped = ((distance % cycle) + cycle) % cycle

  // Começa na direita (+amplitude), vai em linha reta até a esquerda (-amplitude)
  // e volta em linha reta. Sem seno, sem easing e sem pausa nas pontas.
  if (wrapped <= travel) {
    return amplitude - wrapped
  }

  return -amplitude + (wrapped - travel)
}

function MovingHoopRig({ game, children }) {
  const bodyRef = useRef(null)
  const distanceRef = useRef(0)
  const activeRef = useRef(false)
  const lastOffsetRef = useRef(0)

  useFrame((_, delta) => {
    const body = bodyRef.current
    if (!body) return

    const screen = game.refs?.screen?.current ?? game.screen
    const timeLeft = game.refs?.timeLeft?.current ?? game.timeLeft
    const playing = screen === GAME_SCREENS.PLAYING
    const shouldMove = playing && timeLeft <= HOOP_MOTION.startTimeLeft && timeLeft > 0
    const amplitude = HOOP_MOTION.amplitude
    let offsetX = 0

    if (shouldMove) {
      if (!activeRef.current) {
        // Ao bater 2:00, começa imediatamente na direita e segue para a esquerda.
        distanceRef.current = 0
        activeRef.current = true
      }

      const speed = Math.max(0.001, getHoopLinearSpeed(timeLeft))
      distanceRef.current += speed * delta
      offsetX = pingPongOffset(distanceRef.current, amplitude)
    } else {
      distanceRef.current = 0
      activeRef.current = false
      offsetX = 0
    }

    lastOffsetRef.current = offsetX

    if (game.refs?.hoopX) {
      game.refs.hoopX.current = offsetX
    }

    const nextPosition = { x: offsetX, y: 0, z: 0 }

    // setNextKinematicTranslation é o caminho correto para a física.
    // setTranslation junto evita o bug visual/estado em que a cesta parecia congelar
    // em alguns frames enquanto a webcam também estava rodando.
    body.setNextKinematicTranslation(nextPosition)
    body.setTranslation(nextPosition, true)
    body.wakeUp?.()
  })

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} canSleep={false} userData={{ type: 'movingHoopRig' }} name="moving-hoop-rig">
      {children}
    </RigidBody>
  )
}

function Net() {
  const points = []
  const segments = 12
  const radiusTop = HOOP.radius * 0.92
  const radiusBottom = HOOP.radius * 0.48
  const [, cy, cz] = HOOP.center

  for (let i = 0; i < segments; i += 1) {
    const a = (i / segments) * Math.PI * 2
    const next = ((i + 1) / segments) * Math.PI * 2
    points.push([
      [Math.cos(a) * radiusTop, cy - 0.04, cz + Math.sin(a) * radiusTop],
      [Math.cos(next) * radiusBottom, cy - 0.82, cz + Math.sin(next) * radiusBottom]
    ])
    points.push([
      [Math.cos(a) * radiusTop, cy - 0.04, cz + Math.sin(a) * radiusTop],
      [Math.cos(a) * radiusBottom, cy - 0.82, cz + Math.sin(a) * radiusBottom]
    ])
  }

  return (
    <group>
      {points.map((line, index) => (
        <Line key={index} points={line} color="#f8fbff" lineWidth={1.8} transparent opacity={0.92} />
      ))}
    </group>
  )
}

export function Hoop({ game }) {
  const [, cy, cz] = HOOP.center
  const colliders = Array.from({ length: 14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2
    return [Math.cos(angle) * HOOP.radius, cy, cz + Math.sin(angle) * HOOP.radius]
  })

  return (
    <MovingHoopRig game={game}>
      <group userData={{ type: 'backboard' }} name="backboard">
        <CuboidCollider args={[0.83, 0.47, 0.055]} position={[0, 2.65, -3.64]} userData={{ type: 'backboard' }} />
        <mesh position={[0, 2.65, -3.62]} castShadow receiveShadow>
          <boxGeometry args={[1.72, 0.95, 0.08]} />
          <meshStandardMaterial color="#f3f7ff" roughness={0.26} metalness={0.05} />
        </mesh>
        <mesh position={[0, 2.65, -3.56]}>
          <boxGeometry args={[0.95, 0.58, 0.035]} />
          <meshStandardMaterial color="#ffffff" roughness={0.4} transparent opacity={0.16} />
        </mesh>
      </group>

      <group userData={{ type: 'hoop' }} name="hoop">
        {colliders.map((position, index) => (
          <BallCollider key={index} args={[0.052]} position={position} userData={{ type: 'hoop' }} />
        ))}
        <mesh position={HOOP.center} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
          <torusGeometry args={[HOOP.radius, 0.045, 14, 96]} />
          <meshStandardMaterial color="#ff7a00" emissive="#ff3b00" emissiveIntensity={0.28} roughness={0.35} />
        </mesh>
      </group>

      <mesh position={[0, cy, cz - HOOP.radius - 0.08]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.36, 12]} />
        <meshStandardMaterial color="#f15a24" />
      </mesh>

      <Net />

      {/* Guias invisíveis: evitam bolas presas atrás da cesta e empurram a bola pontuada de volta para a rampa. */}
      <group userData={{ type: 'returnGuide' }} name="return-guide">
        <CuboidCollider args={[1.08, 0.05, 0.38]} position={[0, 1.5, -3.26]} rotation={[0.68, 0, 0]} userData={{ type: 'returnGuide' }} />
        <CuboidCollider args={[1.02, 0.05, 0.72]} position={[0, 1.13, -2.56]} rotation={[0.34, 0, 0]} userData={{ type: 'returnGuide' }} />
        <CuboidCollider args={[0.08, 0.2, 0.86]} position={[-1.02, 1.3, -2.7]} rotation={[0.34, 0, 0]} userData={{ type: 'returnGuide' }} />
        <CuboidCollider args={[0.08, 0.2, 0.86]} position={[1.02, 1.3, -2.7]} rotation={[0.34, 0, 0]} userData={{ type: 'returnGuide' }} />
      </group>

      <Text position={[0, 3.33, -3.83]} fontSize={0.18} anchorX="center" anchorY="middle" color="#ffffff" outlineColor="#000000" outlineWidth={0.01}>
        BASKETBALL
      </Text>
      <Text position={[0, 3.08, -3.82]} fontSize={0.13} anchorX="center" anchorY="middle" color="#ffe500" outlineColor="#000000" outlineWidth={0.006}>
        ARCADE
      </Text>
    </MovingHoopRig>
  )
}
