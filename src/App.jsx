import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { BallCollider, CuboidCollider, Physics, RigidBody } from '@react-three/rapier'

const BALL_START = { x: 0, y: 0.75, z: 3.2 }
const HOOP = { x: 0, y: 2.35, z: -3.35, radius: 0.48 }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export default function App() {
  const ballRef = useRef(null)
  const powerRef = useRef(0)
  const aimRef = useRef(0)

  const [score, setScore] = useState(0)
  const [shots, setShots] = useState(0)
  const [shotId, setShotId] = useState(0)
  const [power, setPower] = useState(0)
  const [aim, setAim] = useState(0)
  const [isCharging, setIsCharging] = useState(false)
  const [feedback, setFeedback] = useState('Segure espaço ou o botão para carregar')

  useEffect(() => {
    powerRef.current = power
  }, [power])

  useEffect(() => {
    aimRef.current = aim
  }, [aim])

  useEffect(() => {
    if (!isCharging) return

    let frameId
    const charge = () => {
      setPower((current) => clamp(current + 0.018, 0, 1))
      frameId = requestAnimationFrame(charge)
    }

    frameId = requestAnimationFrame(charge)
    return () => cancelAnimationFrame(frameId)
  }, [isCharging])

  const resetBall = useCallback(() => {
    const ball = ballRef.current
    if (!ball) return

    ball.setTranslation(BALL_START, true)
    ball.setLinvel({ x: 0, y: 0, z: 0 }, true)
    ball.setAngvel({ x: 0, y: 0, z: 0 }, true)
  }, [])

  const startCharge = useCallback(() => {
    setPower(0)
    setIsCharging(true)
    setFeedback('Carregando força...')
  }, [])

  const shoot = useCallback(() => {
    if (!ballRef.current) return

    const finalPower = Math.max(powerRef.current, 0.15)
    const finalAim = aimRef.current

    resetBall()
    ballRef.current.setLinvel(
      {
        x: finalAim * 2.2,
        y: 4.4 + finalPower * 3.2,
        z: -5.6 - finalPower * 4.8
      },
      true
    )
    ballRef.current.setAngvel({ x: -9, y: finalAim * 2, z: 0 }, true)

    setShots((current) => current + 1)
    setShotId((current) => current + 1)
    setIsCharging(false)
    setPower(0)
    setFeedback('Arremessou!')
  }, [resetBall])

  const changeAim = useCallback((direction) => {
    setAim((current) => clamp(current + direction * 0.12, -1, 1))
  }, [])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.code === 'Space' && !event.repeat) {
        event.preventDefault()
        startCharge()
      }
      if (event.code === 'ArrowLeft' || event.code === 'KeyA') changeAim(-1)
      if (event.code === 'ArrowRight' || event.code === 'KeyD') changeAim(1)
      if (event.code === 'KeyR') {
        resetBall()
        setFeedback('Bola resetada')
      }
    }

    const onKeyUp = (event) => {
      if (event.code === 'Space') {
        event.preventDefault()
        shoot()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [changeAim, resetBall, shoot, startCharge])

  const onScore = useCallback(() => {
    setScore((current) => current + 1)
    setFeedback('🏀 Cesta!')
    window.setTimeout(resetBall, 900)
  }, [resetBall])

  const onMiss = useCallback(() => {
    setFeedback('Errou. Tente ajustar força e mira.')
    window.setTimeout(resetBall, 700)
  }, [resetBall])

  const accuracy = shots === 0 ? 0 : Math.round((score / shots) * 100)

  return (
    <main className="game">
      <Canvas camera={{ position: [0, 2.2, 6.2], fov: 48 }} shadows>
        <color attach="background" args={["#101522"]} />
        <ambientLight intensity={0.8} />
        <directionalLight
          castShadow
          position={[4, 8, 5]}
          intensity={2.2}
          shadow-mapSize={[2048, 2048]}
        />

        <Physics gravity={[0, -9.81, 0]}>
          <Court />
          <Basket />
          <Basketball ballRef={ballRef} />
          <AimPreview aim={aim} power={power} />
          <ShotWatcher shotId={shotId} ballRef={ballRef} onScore={onScore} onMiss={onMiss} />
        </Physics>

        <OrbitControls enablePan={false} maxPolarAngle={Math.PI / 2.05} minDistance={4} maxDistance={8} />
      </Canvas>

      <section className="hud">
        <div className="panel">
          <h1>Basket R3F</h1>
          <p>{feedback}</p>

          <div className="stats">
            <strong>Pontos: {score}</strong>
            <span>Arremessos: {shots}</span>
            <span>Acerto: {accuracy}%</span>
          </div>

          <label>
            Força
            <span>{Math.round(power * 100)}%</span>
          </label>
          <div className="bar">
            <div style={{ width: `${power * 100}%` }} />
          </div>

          <label>
            Mira lateral
            <span>{aim.toFixed(2)}</span>
          </label>
          <div className="controls">
            <button onClick={() => changeAim(-1)}>← Mira</button>
            <button
              className="shoot"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                startCharge()
              }}
              onPointerUp={shoot}
              onPointerLeave={() => isCharging && shoot()}
            >
              Segurar e soltar
            </button>
            <button onClick={() => changeAim(1)}>Mira →</button>
          </div>

          <small>Teclado: A/D ou ←/→ mira · Espaço arremessa · R reseta</small>
        </div>
      </section>
    </main>
  )
}

function Court() {
  return (
    <RigidBody type="fixed" colliders={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[7, 10]} />
        <meshStandardMaterial color="#263247" roughness={0.8} />
      </mesh>
      <CuboidCollider args={[3.5, 0.08, 5]} position={[0, -0.08, 0]} />
    </RigidBody>
  )
}

function Basket() {
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <mesh position={[0, 2.65, -3.72]} castShadow receiveShadow>
          <boxGeometry args={[1.75, 1.05, 0.08]} />
          <meshStandardMaterial color="#f4f4f4" roughness={0.35} />
        </mesh>
        <CuboidCollider args={[0.875, 0.525, 0.04]} position={[0, 2.65, -3.72]} />
      </RigidBody>

      <mesh position={[0, HOOP.y, HOOP.z]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[HOOP.radius, 0.035, 18, 72]} />
        <meshStandardMaterial color="#ff5a2a" roughness={0.25} />
      </mesh>

      <mesh position={[0, 2.02, HOOP.z]}>
        <cylinderGeometry args={[0.46, 0.3, 0.58, 32, 1, true]} />
        <meshStandardMaterial color="#ffffff" wireframe transparent opacity={0.3} />
      </mesh>

      <mesh position={[0, 1.25, -3.95]} castShadow>
        <boxGeometry args={[0.13, 2.5, 0.13]} />
        <meshStandardMaterial color="#687083" roughness={0.5} />
      </mesh>
    </group>
  )
}

function Basketball({ ballRef }) {
  const radius = 0.28

  return (
    <RigidBody
      ref={ballRef}
      colliders={false}
      position={[BALL_START.x, BALL_START.y, BALL_START.z]}
      restitution={0.7}
      friction={0.9}
      linearDamping={0.08}
      angularDamping={0.12}
      canSleep={false}
    >
      <BallCollider args={[radius]} />

      <mesh castShadow>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial color="#d9772a" roughness={0.58} />
      </mesh>

      <BallLine rotation={[0, 0, 0]} radius={radius} />
      <BallLine rotation={[Math.PI / 2, 0, 0]} radius={radius} />
      <BallLine rotation={[0, Math.PI / 2, 0]} radius={radius} />
    </RigidBody>
  )
}

function BallLine({ rotation, radius }) {
  return (
    <mesh rotation={rotation}>
      <torusGeometry args={[radius * 1.01, 0.006, 8, 96]} />
      <meshStandardMaterial color="#24180f" roughness={0.6} />
    </mesh>
  )
}

function AimPreview({ aim, power }) {
  return (
    <group position={[0, 0.04, 2.45]} rotation={[-Math.PI / 2, 0, 0]}>
      <mesh position={[aim * 0.6, -0.35 - power * 0.45, 0.01]}>
        <boxGeometry args={[0.08, 1 + power * 1.4, 0.04]} />
        <meshStandardMaterial color="#7dd3fc" transparent opacity={0.75} />
      </mesh>
    </group>
  )
}

function ShotWatcher({ shotId, ballRef, onScore, onMiss }) {
  const previousY = useRef(BALL_START.y)
  const ended = useRef(true)

  useEffect(() => {
    if (shotId === 0) return
    ended.current = false
    previousY.current = BALL_START.y
  }, [shotId])

  useFrame(() => {
    if (!ballRef.current || ended.current) return

    const position = ballRef.current.translation()
    const crossedHoopPlane = previousY.current > HOOP.y && position.y <= HOOP.y

    if (crossedHoopPlane) {
      const dx = position.x - HOOP.x
      const dz = position.z - HOOP.z
      const distanceFromCenter = Math.sqrt(dx * dx + dz * dz)

      if (distanceFromCenter < HOOP.radius * 0.72) {
        ended.current = true
        onScore()
      }
    }

    if (!ended.current && (position.y < -1.8 || position.z < -7.2 || Math.abs(position.x) > 4.2)) {
      ended.current = true
      onMiss()
    }

    previousY.current = position.y
  })

  return null
}
