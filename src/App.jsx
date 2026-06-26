import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { BallCollider, CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import * as THREE from "three";

const GAME_DURATION = 120;
const BALL_RADIUS = 0.32;
const RIM_RADIUS = 0.58;
const RIM_COLLIDER_RADIUS = 0.055;
const RIM_Y = 3.25;
const RIM_Z = -7.55;
const CATCH_Z = 1.55;
const LAUNCH_POS = { x: 0, y: 1.42, z: 2.18 };
const BALL_STARTS = [
  { x: -0.68, y: 1.75, z: -6.25 },
  { x: 0, y: 1.75, z: -6.7 },
  { x: 0.68, y: 1.75, z: -6.25 },
];
const QUEUE_SPOTS = [
  { x: -0.78, y: 0.96, z: 1.9 },
  { x: 0, y: 0.96, z: 1.9 },
  { x: 0.78, y: 0.96, z: 1.9 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const min = Math.floor(safe / 60);
  const sec = String(safe % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function createBallState(status = "locked") {
  return {
    status,
    scoredThisShot: false,
    previousY: null,
    returnTimer: 0,
  };
}

function App() {
  const [phase, setPhase] = useState("menu");
  const [gameId, setGameId] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [aim, setAim] = useState(0);
  const [power, setPower] = useState(0);
  const [charging, setCharging] = useState(false);
  const [readyBallId, setReadyBallId] = useState(null);
  const [shootRequest, setShootRequest] = useState(0);
  const [mobileLeft, setMobileLeft] = useState(false);
  const [mobileRight, setMobileRight] = useState(false);

  const keysRef = useRef({ left: false, right: false });
  const chargingRef = useRef(false);
  const readyBallRef = useRef(null);

  useEffect(() => {
    chargingRef.current = charging;
  }, [charging]);

  useEffect(() => {
    readyBallRef.current = readyBallId;
  }, [readyBallId]);

  const resetGame = useCallback(() => {
    setPhase("menu");
    setGameId((v) => v + 1);
    setCountdown(3);
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setAim(0);
    setPower(0);
    setCharging(false);
    setReadyBallId(null);
    setShootRequest(0);
  }, []);

  const startGame = useCallback(() => {
    setGameId((v) => v + 1);
    setCountdown(3);
    setTimeLeft(GAME_DURATION);
    setScore(0);
    setAim(0);
    setPower(0);
    setCharging(false);
    setReadyBallId(null);
    setShootRequest(0);
    setPhase("countdown");
  }, []);

  useEffect(() => {
    if (phase !== "countdown") return undefined;

    setCountdown(3);
    let value = 3;

    const timer = window.setInterval(() => {
      value -= 1;
      if (value <= 0) {
        window.clearInterval(timer);
        setCountdown(0);
        setPhase("playing");
      } else {
        setCountdown(value);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return undefined;

    const timer = window.setInterval(() => {
      setTimeLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          setCharging(false);
          setPower(0);
          setPhase("gameover");
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase]);

  useEffect(() => {
    if (!charging) return undefined;

    const timer = window.setInterval(() => {
      setPower((current) => {
        const next = current + 0.035;
        return next > 1 ? 0.18 : next;
      });
    }, 24);

    return () => window.clearInterval(timer);
  }, [charging]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (key === "a" || event.key === "ArrowLeft") {
        keysRef.current.left = true;
      }

      if (key === "d" || event.key === "ArrowRight") {
        keysRef.current.right = true;
      }

      if (key === "r") {
        resetGame();
      }

      if (event.code === "Space") {
        event.preventDefault();
        if (phase === "playing" && readyBallRef.current !== null && !chargingRef.current) {
          setCharging(true);
          setPower(0.12);
        }
      }
    };

    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();

      if (key === "a" || event.key === "ArrowLeft") {
        keysRef.current.left = false;
      }

      if (key === "d" || event.key === "ArrowRight") {
        keysRef.current.right = false;
      }

      if (event.code === "Space") {
        event.preventDefault();
        if (phase === "playing" && chargingRef.current && readyBallRef.current !== null) {
          setShootRequest((v) => v + 1);
        }
        setCharging(false);
        setPower(0);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [phase, resetGame]);

  const difficultyLabel = useMemo(() => {
    const elapsed = GAME_DURATION - timeLeft;
    if (phase !== "playing") return "Cesta parada";
    if (elapsed < 60) return "Cesta parada";
    if (elapsed < 90) return "Cesta em movimento";
    return "Cesta rápida";
  }, [phase, timeLeft]);

  return (
    <div className="app">
      <Canvas shadows camera={{ position: [0, 4.4, 7.6], fov: 48 }}>
        <color attach="background" args={["#07111f"]} />
        <ambientLight intensity={0.65} />
        <directionalLight
          position={[3, 6, 4]}
          intensity={1.45}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        <Physics gravity={[0, -9.81, 0]}>
          <GameWorld
            key={gameId}
            phase={phase}
            timeLeft={timeLeft}
            aim={aim}
            power={power}
            shootRequest={shootRequest}
            keysRef={keysRef}
            mobileLeft={mobileLeft}
            mobileRight={mobileRight}
            charging={charging}
            onAimChange={setAim}
            onScore={() => setScore((v) => v + 1)}
            onReadyBallChange={setReadyBallId}
          />
        </Physics>
      </Canvas>

      <div className="hud topHud">
        <div className="stat"><span>Tempo</span><strong>{formatTime(timeLeft)}</strong></div>
        <div className="stat"><span>Cestas</span><strong>{score}</strong></div>
        <div className="stat wide"><span>Dificuldade</span><strong>{difficultyLabel}</strong></div>
      </div>

      <div className="hud bottomHud">
        <div className="aimPanel">
          <span>Mira</span>
          <div className="aimBar"><i style={{ left: `${50 + aim * 45}%` }} /></div>
        </div>
        <div className="powerPanel">
          <span>Força</span>
          <div className="powerBar"><i style={{ width: `${Math.round(power * 100)}%` }} /></div>
        </div>
        <div className={`readyTag ${readyBallId !== null && phase === "playing" ? "on" : ""}`}>
          {phase === "playing" ? (readyBallId !== null ? "Bola pronta: segure Espaço" : "Aguarde a bola encostar na barra") : ""}
        </div>
      </div>

      <div className="mobileControls">
        <button
          onPointerDown={() => setMobileLeft(true)}
          onPointerUp={() => setMobileLeft(false)}
          onPointerCancel={() => setMobileLeft(false)}
          onPointerLeave={() => setMobileLeft(false)}
        >
          ←
        </button>
        <button
          className="shootBtn"
          onPointerDown={() => {
            if (phase === "playing" && readyBallRef.current !== null && !chargingRef.current) {
              setCharging(true);
              setPower(0.12);
            }
          }}
          onPointerUp={() => {
            if (phase === "playing" && chargingRef.current && readyBallRef.current !== null) {
              setShootRequest((v) => v + 1);
            }
            setCharging(false);
            setPower(0);
          }}
          onPointerCancel={() => {
            setCharging(false);
            setPower(0);
          }}
        >
          ARREMESSAR
        </button>
        <button
          onPointerDown={() => setMobileRight(true)}
          onPointerUp={() => setMobileRight(false)}
          onPointerCancel={() => setMobileRight(false)}
          onPointerLeave={() => setMobileRight(false)}
        >
          →
        </button>
      </div>

      {phase === "menu" && (
        <div className="overlay">
          <div className="card">
            <p className="eyebrow">Arcade Basketball</p>
            <h1>Jogo de Cestas</h1>
            <p>
              Faça o máximo de cestas em 2 minutos. As 3 bolas descem pela rampa e só podem ser arremessadas quando encostam na barra da frente.
            </p>
            <button onClick={startGame}>Iniciar jogo</button>
            <small>A/D ou setas para mirar · segure Espaço para carregar · solte para arremessar</small>
          </div>
        </div>
      )}

      {phase === "countdown" && (
        <div className="countdown">
          <span>{countdown}</span>
          <p>As bolas serão liberadas</p>
        </div>
      )}

      {phase === "gameover" && (
        <div className="overlay">
          <div className="card">
            <p className="eyebrow">Fim de jogo</p>
            <h1>{score} cestas</h1>
            <p>Sua pontuação final foi a quantidade de bolas que passaram por dentro do aro.</p>
            <button onClick={startGame}>Jogar novamente</button>
            <button className="secondary" onClick={resetGame}>Voltar ao menu</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GameWorld({
  phase,
  timeLeft,
  aim,
  power,
  shootRequest,
  keysRef,
  mobileLeft,
  mobileRight,
  charging,
  onAimChange,
  onScore,
  onReadyBallChange,
}) {
  const ballRefs = useRef([]);
  const hoopRef = useRef(null);
  const ballStatesRef = useRef([createBallState(), createBallState(), createBallState()]);
  const queueRef = useRef([]);
  const activeReadyRef = useRef(null);
  const releasedRef = useRef(false);
  const lastShootRequestRef = useRef(shootRequest);
  const lastReadyReportedRef = useRef(null);
  const elapsedRef = useRef(0);
  const rimSpringRef = useRef(0);
  const rimSpringVelocityRef = useRef(0);
  const rimCooldownRef = useRef(0);
  const lastHoopXRef = useRef(0);
  const hoopDirectionRef = useRef(1);

  const rimPoints = useMemo(() => {
    return Array.from({ length: 18 }, (_, index) => {
      const angle = (index / 18) * Math.PI * 2;
      return [Math.cos(angle) * RIM_RADIUS, 0, Math.sin(angle) * RIM_RADIUS];
    });
  }, []);

  const reportReady = useCallback((id) => {
    if (lastReadyReportedRef.current !== id) {
      lastReadyReportedRef.current = id;
      onReadyBallChange(id);
    }
  }, [onReadyBallChange]);

  const setBodyStopped = useCallback((body) => {
    if (!body) return;
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, []);

  const placeBall = useCallback((index, position, gravityScale = 0) => {
    const body = ballRefs.current[index];
    if (!body) return;
    body.setTranslation(position, true);
    body.setGravityScale(gravityScale, true);
    setBodyStopped(body);
  }, [setBodyStopped]);

  const releaseAllBalls = useCallback(() => {
    BALL_STARTS.forEach((position, index) => {
      const body = ballRefs.current[index];
      if (!body) return;
      ballStatesRef.current[index] = createBallState("rolling");
      body.setTranslation(position, true);
      body.setGravityScale(1, true);
      body.setLinvel({ x: 0, y: 0, z: 0.15 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    });
    queueRef.current = [];
    activeReadyRef.current = null;
    reportReady(null);
  }, [reportReady]);

  const returnBallToRamp = useCallback((index) => {
    const position = BALL_STARTS[index];
    const body = ballRefs.current[index];
    if (!body) return;

    ballStatesRef.current[index] = createBallState("rolling");
    body.setTranslation(position, true);
    body.setGravityScale(1, true);
    body.setLinvel({ x: 0, y: 0, z: 0.1 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, []);

  const promoteNextQueuedBall = useCallback(() => {
    if (activeReadyRef.current !== null) return;
    const nextId = queueRef.current.shift();
    if (nextId === undefined) {
      reportReady(null);
      return;
    }

    activeReadyRef.current = nextId;
    ballStatesRef.current[nextId] = createBallState("ready");
    placeBall(nextId, LAUNCH_POS, 0);
    reportReady(nextId);
  }, [placeBall, reportReady]);

  const queueBall = useCallback((index) => {
    const state = ballStatesRef.current[index];
    if (!state || state.status !== "rolling") return;

    state.status = "queued";
    state.scoredThisShot = false;
    state.previousY = null;

    if (!queueRef.current.includes(index) && activeReadyRef.current !== index) {
      queueRef.current.push(index);
    }

    const spotIndex = Math.min(queueRef.current.indexOf(index), QUEUE_SPOTS.length - 1);
    placeBall(index, QUEUE_SPOTS[spotIndex], 0);
    promoteNextQueuedBall();
  }, [placeBall, promoteNextQueuedBall]);

  const shootReadyBall = useCallback(() => {
    const id = activeReadyRef.current;
    if (id === null) return;

    const body = ballRefs.current[id];
    if (!body) return;

    const shotPower = clamp(power, 0.08, 1);
    const horizontal = clamp(aim, -1, 1);

    ballStatesRef.current[id] = {
      status: "flying",
      scoredThisShot: false,
      previousY: LAUNCH_POS.y,
      returnTimer: 0,
    };

    body.setGravityScale(1, true);
    body.setTranslation(LAUNCH_POS, true);
    body.setLinvel({
      x: horizontal * 2.35,
      y: 7.3 + shotPower * 2.1,
      z: -8.7 - shotPower * 1.55,
    }, true);
    body.setAngvel({ x: -7.5, y: horizontal * 2.5, z: 0.5 }, true);

    activeReadyRef.current = null;
    reportReady(null);
    promoteNextQueuedBall();
  }, [aim, power, promoteNextQueuedBall, reportReady]);

  useEffect(() => {
    BALL_STARTS.forEach((position, index) => {
      ballStatesRef.current[index] = createBallState("locked");
      placeBall(index, position, 0);
    });
    queueRef.current = [];
    activeReadyRef.current = null;
    releasedRef.current = false;
    elapsedRef.current = 0;
    lastHoopXRef.current = 0;
    hoopDirectionRef.current = 1;
    reportReady(null);
  }, [placeBall, reportReady]);

  useFrame((_, delta) => {
    const movingLeft = keysRef.current.left || mobileLeft;
    const movingRight = keysRef.current.right || mobileRight;

    if (phase === "playing") {
      if (movingLeft) onAimChange((v) => clamp(v - delta * 1.7, -1, 1));
      if (movingRight) onAimChange((v) => clamp(v + delta * 1.7, -1, 1));
    }

    if (phase !== "playing") {
      releasedRef.current = false;
      return;
    }

    if (!releasedRef.current) {
      releasedRef.current = true;
      elapsedRef.current = 0;
      lastHoopXRef.current = 0;
      hoopDirectionRef.current = 1;
      releaseAllBalls();
    }

    elapsedRef.current += delta;

    if (lastShootRequestRef.current !== shootRequest) {
      lastShootRequestRef.current = shootRequest;
      shootReadyBall();
    }

    promoteNextQueuedBall();

    const elapsed = elapsedRef.current;
    let hoopX = lastHoopXRef.current;

    if (elapsed < 60) {
      hoopX = 0;
      hoopDirectionRef.current = 1;
    } else {
      const amplitude = elapsed < 90 ? 1.05 : 1.35;
      const speed = elapsed < 90 ? 0.9 : 1.8;

      hoopX += hoopDirectionRef.current * speed * delta;

      if (hoopX >= amplitude) {
        hoopX = amplitude;
        hoopDirectionRef.current = -1;
      }

      if (hoopX <= -amplitude) {
        hoopX = -amplitude;
        hoopDirectionRef.current = 1;
      }
    }

    lastHoopXRef.current = hoopX;

    rimCooldownRef.current = Math.max(0, rimCooldownRef.current - delta);
    rimSpringVelocityRef.current += (-rimSpringRef.current * 44 - rimSpringVelocityRef.current * 10) * delta;
    rimSpringRef.current += rimSpringVelocityRef.current * delta;
    rimSpringRef.current = clamp(rimSpringRef.current, 0, 0.18);

    if (hoopRef.current) {
      hoopRef.current.setNextKinematicTranslation({
        x: hoopX,
        y: RIM_Y - rimSpringRef.current,
        z: RIM_Z,
      });
    }

    ballRefs.current.forEach((body, index) => {
      if (!body) return;
      const state = ballStatesRef.current[index];
      if (!state) return;

      const p = body.translation();

      if (state.status === "locked") {
        placeBall(index, BALL_STARTS[index], 0);
        return;
      }

      if (state.status === "ready") {
        placeBall(index, LAUNCH_POS, 0);
        return;
      }

      if (state.status === "queued") {
        const spot = QUEUE_SPOTS[Math.min(queueRef.current.indexOf(index), QUEUE_SPOTS.length - 1)] || QUEUE_SPOTS[0];
        placeBall(index, spot, 0);
        return;
      }

      if (state.status === "rolling") {
        if (p.z > CATCH_Z || p.y < 0.18) {
          queueBall(index);
        }
        return;
      }

      if (state.status === "returning") {
        state.returnTimer -= delta;
        if (state.returnTimer <= 0) {
          returnBallToRamp(index);
        }
        return;
      }

      if (state.status === "flying") {
        const dx = p.x - hoopX;
        const dz = p.z - RIM_Z;
        const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
        const previousY = state.previousY ?? p.y;
        const movingDown = previousY > p.y;

        if (rimCooldownRef.current <= 0 && distanceFromCenter < RIM_RADIUS + 0.18 && Math.abs(p.y - RIM_Y) < 0.22) {
          rimSpringVelocityRef.current += 2.6;
          rimCooldownRef.current = 0.22;
        }

        if (!state.scoredThisShot && movingDown && distanceFromCenter < 0.39 && previousY > RIM_Y && p.y <= RIM_Y) {
          state.scoredThisShot = true;
          state.status = "returning";
          state.returnTimer = 0.45;
          onScore();
        }

        state.previousY = p.y;

        if (p.y < -1.2 || p.z < -10.6 || p.z > 4.4 || Math.abs(p.x) > 5.2) {
          state.status = "returning";
          state.returnTimer = 0.25;
        }
      }
    });
  });

  return (
    <>
      <CameraTarget />
      <ArcadeCabinet />
      <BallReturnRamp />
      <HoopBody refObject={hoopRef} rimPoints={rimPoints} />
      <AimGuide aim={aim} power={power} visible={phase === "playing" && !charging ? false : phase === "playing"} />

      {BALL_STARTS.map((_, index) => (
        <RigidBody
          key={index}
          ref={(body) => {
            ballRefs.current[index] = body;
          }}
          colliders={false}
          type="dynamic"
          canSleep={false}
          position={[BALL_STARTS[index].x, BALL_STARTS[index].y, BALL_STARTS[index].z]}
          restitution={0.42}
          friction={0.78}
          linearDamping={0.08}
          angularDamping={0.18}
        >
          <BallCollider args={[BALL_RADIUS]} />
          <mesh castShadow receiveShadow>
            <sphereGeometry args={[BALL_RADIUS, 32, 24]} />
            <meshStandardMaterial color={index === 0 ? "#f97316" : index === 1 ? "#fb923c" : "#ea580c"} roughness={0.6} />
          </mesh>
          <BasketballLines />
        </RigidBody>
      ))}
    </>
  );
}

function CameraTarget() {
  useFrame(({ camera }) => {
    camera.lookAt(0, 1.6, -2.8);
  });
  return null;
}

function BasketballLines() {
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BALL_RADIUS * 0.96, 0.008, 8, 48]} />
        <meshStandardMaterial color="#1f1307" roughness={0.75} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[BALL_RADIUS * 0.96, 0.008, 8, 48]} />
        <meshStandardMaterial color="#1f1307" roughness={0.75} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[BALL_RADIUS * 0.96, 0.008, 8, 48]} />
        <meshStandardMaterial color="#1f1307" roughness={0.75} />
      </mesh>
    </group>
  );
}

function ArcadeCabinet() {
  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.55, 0.12, 4.45]} position={[0, -0.06, -2]} />
        <CuboidCollider args={[0.12, 1.05, 4.3]} position={[-2.55, 0.76, -2]} />
        <CuboidCollider args={[0.12, 1.05, 4.3]} position={[2.55, 0.76, -2]} />
        <CuboidCollider args={[2.55, 0.9, 0.14]} position={[0, 0.76, 2.58]} />
        <CuboidCollider args={[2.55, 1.35, 0.18]} position={[0, 1.1, -6.85]} />
      </RigidBody>

      <mesh receiveShadow position={[0, -0.08, -2]}>
        <boxGeometry args={[5.35, 0.16, 9.1]} />
        <meshStandardMaterial color="#182235" roughness={0.8} />
      </mesh>

      <mesh receiveShadow position={[-2.62, 0.74, -2]}>
        <boxGeometry args={[0.25, 1.55, 8.7]} />
        <meshStandardMaterial color="#26344f" roughness={0.75} />
      </mesh>

      <mesh receiveShadow position={[2.62, 0.74, -2]}>
        <boxGeometry args={[0.25, 1.55, 8.7]} />
        <meshStandardMaterial color="#26344f" roughness={0.75} />
      </mesh>

      <mesh receiveShadow position={[0, 0.85, 2.65]}>
        <boxGeometry args={[5.2, 1.45, 0.28]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.6} />
      </mesh>

      <mesh receiveShadow position={[0, 1.08, -6.9]}>
        <boxGeometry args={[5.2, 2.15, 0.32]} />
        <meshStandardMaterial color="#111827" roughness={0.85} />
      </mesh>

      <mesh receiveShadow position={[0, 0.46, 2.22]}>
        <boxGeometry args={[4.1, 0.22, 0.18]} />
        <meshStandardMaterial color="#facc15" roughness={0.35} />
      </mesh>
    </group>
  );
}

function BallReturnRamp() {
  const rampRotation = 0.16;

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[2.08, 0.08, 4.35]} position={[0, 0.68, -2.05]} rotation={[rampRotation, 0, 0]} />
        <CuboidCollider args={[0.12, 0.35, 4.25]} position={[-1.96, 0.83, -2.05]} rotation={[rampRotation, 0, 0]} />
        <CuboidCollider args={[0.12, 0.35, 4.25]} position={[1.96, 0.83, -2.05]} rotation={[rampRotation, 0, 0]} />
        <CuboidCollider args={[2.0, 0.25, 0.12]} position={[0, 0.46, 2.2]} />
      </RigidBody>

      <mesh receiveShadow position={[0, 0.68, -2.05]} rotation={[rampRotation, 0, 0]}>
        <boxGeometry args={[4.15, 0.12, 8.7]} />
        <meshStandardMaterial color="#334155" roughness={0.82} />
      </mesh>
      <mesh receiveShadow position={[-2.02, 0.85, -2.05]} rotation={[rampRotation, 0, 0]}>
        <boxGeometry args={[0.18, 0.7, 8.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>
      <mesh receiveShadow position={[2.02, 0.85, -2.05]} rotation={[rampRotation, 0, 0]}>
        <boxGeometry args={[0.18, 0.7, 8.5]} />
        <meshStandardMaterial color="#0f172a" roughness={0.8} />
      </mesh>
      <mesh receiveShadow position={[0, 0.47, 2.2]}>
        <boxGeometry args={[4.2, 0.45, 0.24]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.45} />
      </mesh>
    </group>
  );
}

function HoopBody({ refObject, rimPoints }) {
  return (
    <RigidBody ref={refObject} type="kinematicPosition" colliders={false} position={[0, RIM_Y, RIM_Z]}>
      <CuboidCollider args={[1.45, 0.78, 0.08]} position={[0, 0.48, -0.48]} />
      <CuboidCollider args={[0.16, 0.12, 0.22]} position={[0, 0, -0.47]} />

      {rimPoints.map((point, index) => (
        <BallCollider key={index} args={[RIM_COLLIDER_RADIUS]} position={point} />
      ))}

      <mesh castShadow receiveShadow position={[0, 0.48, -0.52]}>
        <boxGeometry args={[2.9, 1.55, 0.12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} metalness={0.05} />
      </mesh>

      <mesh castShadow position={[0, 0.48, -0.595]}>
        <boxGeometry args={[1.2, 0.75, 0.04]} />
        <meshStandardMaterial color="#bfdbfe" transparent opacity={0.5} roughness={0.2} />
      </mesh>

      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RIM_RADIUS, 0.045, 12, 64]} />
        <meshStandardMaterial color="#ef4444" roughness={0.35} metalness={0.15} />
      </mesh>

      <mesh castShadow position={[0, 0, -0.34]}>
        <boxGeometry args={[0.26, 0.12, 0.28]} />
        <meshStandardMaterial color="#ef4444" roughness={0.35} />
      </mesh>

      <NetVisual />
    </RigidBody>
  );
}

function NetVisual() {
  const geometries = useMemo(() => {
    return Array.from({ length: 12 }, (_, index) => {
      const angle = (index / 12) * Math.PI * 2;
      const top = new THREE.Vector3(Math.cos(angle) * 0.52, -0.03, Math.sin(angle) * 0.52);
      const bottom = new THREE.Vector3(Math.cos(angle) * 0.28, -0.72, Math.sin(angle) * 0.28);
      return new THREE.BufferGeometry().setFromPoints([top, bottom]);
    });
  }, []);

  return (
    <group>
      {geometries.map((geometry, index) => (
        <line key={index}>
          <primitive object={geometry} attach="geometry" />
          <lineBasicMaterial color="#e5e7eb" transparent opacity={0.8} />
        </line>
      ))}
    </group>
  );
}

function AimGuide({ aim, power, visible }) {
  const geometry = useMemo(() => {
    const strength = clamp(power, 0.12, 1);
    const velocity = {
      x: aim * 2.35,
      y: 7.3 + strength * 2.1,
      z: -8.7 - strength * 1.55,
    };

    const linePoints = Array.from({ length: 18 }, (_, i) => {
      const t = i / 17;
      const time = t * 1.15;
      return new THREE.Vector3(
        LAUNCH_POS.x + velocity.x * time,
        LAUNCH_POS.y + velocity.y * time - 0.5 * 9.81 * time * time,
        LAUNCH_POS.z + velocity.z * time
      );
    });

    return new THREE.BufferGeometry().setFromPoints(linePoints);
  }, [aim, power]);

  if (!visible) return null;

  return (
    <line>
      <primitive object={geometry} attach="geometry" />
      <lineBasicMaterial color="#38bdf8" transparent opacity={0.8} />
    </line>
  );
}

export default App;
