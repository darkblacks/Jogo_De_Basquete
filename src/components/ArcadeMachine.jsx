import { useEffect, useState } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Text } from '@react-three/drei'
import { Hoop } from './Hoop.jsx'

function NeonStrip({ position, scale, color }) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.35} toneMapped={false} />
    </mesh>
  )
}

export function ArcadeMachine({ flashToken, game }) {
  const [frontFlash, setFrontFlash] = useState(false)

  useEffect(() => {
    if (!flashToken) return undefined
    setFrontFlash(true)
    const timeout = window.setTimeout(() => setFrontFlash(false), 220)
    return () => window.clearTimeout(timeout)
  }, [flashToken])

  return (
    <group>
      <RigidBody type="fixed" colliders={false} userData={{ type: 'floor' }} name="floor">
        <CuboidCollider args={[3.2, 0.08, 4.2]} position={[0, -0.32, -0.55]} userData={{ type: 'floor' }} />
        <mesh position={[0, -0.34, -0.55]} receiveShadow>
          <boxGeometry args={[6.4, 0.12, 8.4]} />
          <meshStandardMaterial color="#13151d" roughness={0.82} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false} userData={{ type: 'ramp' }} name="return-ramp">
        <CuboidCollider args={[2.12, 0.055, 2.85]} position={[0, 0.48, -0.85]} rotation={[0.13, 0, 0]} userData={{ type: 'ramp' }} />
      </RigidBody>

      <mesh position={[0, 0.48, -0.85]} rotation={[0.13, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.7, 0.08, 5.65]} />
        <meshStandardMaterial color="#15151c" roughness={0.42} metalness={0.18} />
      </mesh>

      <mesh position={[0, 0.545, -0.8]} rotation={[0.13, 0, 0]} receiveShadow>
        <boxGeometry args={[4.15, 0.035, 4.75]} />
        <meshStandardMaterial color="#08090e" roughness={0.24} metalness={0.22} />
      </mesh>


      <mesh position={[0, 0.595, 0.3]} rotation={[0.13, 0, 0]}>
        <boxGeometry args={[4.2, 0.018, 0.035]} />
        <meshStandardMaterial color="#00fff0" emissive="#00fff0" emissiveIntensity={0.35} toneMapped={false} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.705, -1.95]} rotation={[0.13, 0, 0]}>
        <boxGeometry args={[4.1, 0.018, 0.035]} />
        <meshStandardMaterial color="#ff28d6" emissive="#ff28d6" emissiveIntensity={0.35} toneMapped={false} roughness={0.2} />
      </mesh>

      <RigidBody type="fixed" colliders={false} userData={{ type: 'arcadeWall' }} name="left-wall">
        <CuboidCollider args={[0.16, 1.95, 3.25]} position={[-2.35, 1.25, -0.72]} userData={{ type: 'arcadeWall' }} />
        <mesh position={[-2.38, 0.67, -0.75]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 1.45, 5.55]} />
          <meshStandardMaterial color="#0d0f16" roughness={0.46} metalness={0.25} />
        </mesh>
        <mesh position={[-2.43, 1.95, -0.72]}>
          <boxGeometry args={[0.035, 1.95, 6.15]} />
          <meshStandardMaterial color="#06131a" transparent opacity={0.32} roughness={0.35} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false} userData={{ type: 'arcadeWall' }} name="right-wall">
        <CuboidCollider args={[0.16, 1.95, 3.25]} position={[2.35, 1.25, -0.72]} userData={{ type: 'arcadeWall' }} />
        <mesh position={[2.38, 0.67, -0.75]} castShadow receiveShadow>
          <boxGeometry args={[0.22, 1.45, 5.55]} />
          <meshStandardMaterial color="#0d0f16" roughness={0.46} metalness={0.25} />
        </mesh>
        <mesh position={[2.43, 1.95, -0.72]}>
          <boxGeometry args={[0.035, 1.95, 6.15]} />
          <meshStandardMaterial color="#160615" transparent opacity={0.32} roughness={0.35} />
        </mesh>
      </RigidBody>

      <RigidBody type="fixed" colliders={false} userData={{ type: 'frontBar' }} name="front-bar">
        <CuboidCollider args={[2.18, 0.2, 0.18]} position={[0, 0.58, 1.72]} userData={{ type: 'frontBar' }} />
        <mesh position={[0, 0.58, 1.72]} castShadow receiveShadow>
          <boxGeometry args={[4.35, 0.27, 0.28]} />
          <meshStandardMaterial color={frontFlash ? '#fff7b8' : '#ffe400'} emissive={frontFlash ? '#ffffff' : '#ffe400'} emissiveIntensity={frontFlash ? 1.8 : 0.52} toneMapped={false} roughness={0.24} metalness={0.08} />
        </mesh>
      </RigidBody>


      <mesh position={[0, 0.725, 1.34]} receiveShadow>
        <boxGeometry args={[4.0, 0.035, 0.42]} />
        <meshStandardMaterial color="#2b2d35" roughness={0.28} metalness={0.18} transparent opacity={0.78} />
      </mesh>

      <mesh position={[0, 0.74, 1.53]} castShadow receiveShadow>
        <boxGeometry args={[4.45, 0.045, 0.12]} />
        <meshStandardMaterial color="#fff15a" emissive="#ffe400" emissiveIntensity={0.28} toneMapped={false} roughness={0.22} metalness={0.08} />
      </mesh>

      <RigidBody type="fixed" colliders={false} userData={{ type: 'frontBar' }} name="front-safety-lip">
        {/* Parede baixa invisível no fim da baia: segura as bolas dentro da máquina sem atrapalhar o arremesso. */}
        <CuboidCollider args={[2.25, 0.26, 0.1]} position={[0, 0.52, 2.48]} userData={{ type: 'frontBar' }} />
      </RigidBody>

      <mesh position={[0, 0.41, 1.94]} receiveShadow>
        <boxGeometry args={[4.42, 0.04, 0.18]} />
        <meshStandardMaterial color="#111217" roughness={0.9} />
      </mesh>

      <RigidBody type="fixed" colliders={false} userData={{ type: 'arcadeWall' }} name="bay-left-guard">
        <CuboidCollider args={[0.12, 0.65, 1.2]} position={[-2.18, 0.65, 1.35]} userData={{ type: 'arcadeWall' }} />
      </RigidBody>

      <RigidBody type="fixed" colliders={false} userData={{ type: 'arcadeWall' }} name="bay-right-guard">
        <CuboidCollider args={[0.12, 0.65, 1.2]} position={[2.18, 0.65, 1.35]} userData={{ type: 'arcadeWall' }} />
      </RigidBody>

      <RigidBody type="fixed" colliders={false} userData={{ type: 'arcadeWall' }} name="back-panel">
        <CuboidCollider args={[2.0, 1.65, 0.12]} position={[0, 2.0, -4.02]} userData={{ type: 'arcadeWall' }} />
        <mesh position={[0, 2.0, -4.08]} castShadow receiveShadow>
          <boxGeometry args={[4.1, 3.35, 0.18]} />
          <meshStandardMaterial color="#0d0e14" roughness={0.34} metalness={0.2} />
        </mesh>
        <mesh position={[-0.75, 2.0, -3.96]} rotation={[0, 0, -0.32]}>
          <boxGeometry args={[1.15, 0.08, 0.035]} />
          <meshStandardMaterial color="#06ccff" emissive="#06ccff" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
        <mesh position={[0.72, 2.08, -3.95]} rotation={[0, 0, 0.28]}>
          <boxGeometry args={[1.35, 0.08, 0.035]} />
          <meshStandardMaterial color="#ff2bd6" emissive="#ff2bd6" emissiveIntensity={1.2} toneMapped={false} />
        </mesh>
        <mesh position={[0.0, 1.15, -3.95]} rotation={[0, 0, -0.1]}>
          <boxGeometry args={[1.8, 0.07, 0.035]} />
          <meshStandardMaterial color="#ffe400" emissive="#ffe400" emissiveIntensity={1.05} toneMapped={false} />
        </mesh>
      </RigidBody>

      <Hoop game={game} />

      <Text position={[0, 0.42, -0.48]} rotation={[-Math.PI / 2.35, 0, 0]} fontSize={0.32} anchorX="center" anchorY="middle" color="#17d7ff" outlineColor="#ff26d4" outlineWidth={0.018}>
        SHOOT
      </Text>
      <Text position={[0, 0.31, -0.1]} rotation={[-Math.PI / 2.35, 0, 0]} fontSize={0.24} anchorX="center" anchorY="middle" color="#ffffff" outlineColor="#000000" outlineWidth={0.012}>
        TO
      </Text>
      <Text position={[0, 0.22, 0.25]} rotation={[-Math.PI / 2.35, 0, 0]} fontSize={0.34} anchorX="center" anchorY="middle" color="#ffe500" outlineColor="#000000" outlineWidth={0.02}>
        SCORE!
      </Text>

      <NeonStrip position={[-2.58, 0.72, -0.8]} scale={[0.06, 1.4, 5.0]} color="#00d8ff" />
      <NeonStrip position={[2.58, 0.72, -0.8]} scale={[0.06, 1.4, 5.0]} color="#ff28d6" />
      <NeonStrip position={[0, 0.18, 2.02]} scale={[4.7, 0.055, 0.075]} color="#00fff0" />
      <NeonStrip position={[0, 3.75, -4.0]} scale={[3.85, 0.09, 0.09]} color="#ff28d6" />
    </group>
  )
}
