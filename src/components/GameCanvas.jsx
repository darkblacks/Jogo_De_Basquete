import { Canvas, useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { ContactShadows, Environment } from '@react-three/drei'
import { ArcadeMachine } from './ArcadeMachine.jsx'
import { Basketball } from './Basketball.jsx'

function CameraRig() {
  useFrame(({ camera }) => {
    camera.lookAt(0, 0.55, -1.25)
  })
  return null
}

export function GameCanvas({ game, webcam }) {
  const performanceMode = webcam?.enabled

  return (
    <Canvas
      className="game-canvas"
      dpr={performanceMode ? [1, 1] : [1, 1.5]}
      shadows={!performanceMode}
      gl={{ antialias: !performanceMode, powerPreference: 'high-performance' }}
      camera={{ position: [0, 5.65, 4.85], fov: 57, near: 0.1, far: 100 }}
    >
      <color attach="background" args={["#090a11"]} />
      <ambientLight intensity={0.5} />
      <directionalLight
        castShadow={!performanceMode}
        position={[2.8, 7.2, 4.8]}
        intensity={1.55}
        shadow-mapSize-width={performanceMode ? 768 : 1536}
        shadow-mapSize-height={performanceMode ? 768 : 1536}
        shadow-camera-near={0.5}
        shadow-camera-far={18}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <pointLight position={[-2.8, 2.3, 1.2]} color="#00d8ff" intensity={2.1} distance={8} />
      <pointLight position={[2.8, 2.3, 1.2]} color="#ff28d6" intensity={2.1} distance={8} />
      <CameraRig />
      <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60} colliders={false} interpolate>
        <ArcadeMachine flashToken={game.frontBarFlashToken} game={game} />
        <Basketball game={game} webcam={webcam} />
      </Physics>
      {!performanceMode && (
        <ContactShadows
          position={[0, 0.73, 0.25]}
          opacity={0.28}
          blur={2.0}
          scale={5.2}
          far={2.4}
          resolution={512}
          color="#000000"
        />
      )}
      {!performanceMode && <Environment preset="city" environmentIntensity={0.32} />}
    </Canvas>
  )
}
