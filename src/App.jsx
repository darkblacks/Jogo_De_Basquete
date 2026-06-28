import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { BallCollider, CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import * as THREE from "three";

const GAME_DURATION = 120;
const BALL_RADIUS = 0.28;

const RIM_RADIUS = 0.56;
const RIM_COLLIDER_RADIUS = 0.052;
const RIM_Y = 3.15;
const RIM_Z = -7.35;
const SCORE_RADIUS = 0.38;
const HOOP_LIMIT_X = 1.35;

const TABLE_HALF_X = 2.15;
const CATCH_Z = 1.08;
const READY_Z = 1.78;
const READY_Y = 0.72;
const READY_SLOTS = [-1.35, 0, 1.35];
const LAUNCH_POS = { x: 0, y: 1.42, z: 2.12 };

const BALL_STARTS = [
  { x: -0.75, y: 1.62, z: -6.18 },
  { x: 0, y: 1.72, z: -6.62 },
  { x: 0.75, y: 1.62, z: -6.18 },
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

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function createBallMeta(status = "locked") {
  return {
    status,
    slot: null,
    scored: false,
    previousY: null,
    returnTimer: 0,
    shotAge: 0,
  };
}

export default function App() {
  const [phase, setPhaseState] = useState("menu");
  const [gameKey, setGameKey] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [score, setScore] = useState(0);
  const [readyCount, setReadyCount] = useState(0);
  const [aim, setAimState] = useState(0);
  const [power, setPowerState] = useState(0);
  const [charging, setChargingState] = useState(false);
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const [webcamStatus, setWebcamStatus] = useState("desligada");
  const [gestureInfo, setGestureInfo] = useState({ present: false, handOpen: false, handClosed: false, aim: 0 });
  const [lastAction, setLastAction] = useState("Aguardando início");

  const phaseRef = useRef(phase);
  const aimRef = useRef(0);
  const powerRef = useRef(0);
  const chargingRef = useRef(false);
  const keysRef = useRef({ left: false, right: false });
  const gameApiRef = useRef(null);
  const webcamGestureRef = useRef({ present: false, handOpen: false, handClosed: false, aim: 0 });
  const webcamCooldownRef = useRef(0);

  const setPhase = useCallback((next) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const setAim = useCallback((next) => {
    const value = clamp(next, -1, 1);
    aimRef.current = value;
    setAimState(value);
  }, []);

  const setPower = useCallback((next) => {
    const value = clamp(next, 0, 1);
    powerRef.current = value;
    setPowerState(value);
  }, []);

  const setCharging = useCallback((next) => {
    chargingRef.current = next;
    setChargingState(next);
  }, []);

  const startGame = useCallback((withWebcam = true) => {
    if (withWebcam) setWebcamEnabled(true);
    setGameKey((value) => value + 1);
    setScore(0);
    setReadyCount(0);
    setTimeLeft(GAME_DURATION);
    setCountdown(3);
    setAim(0);
    setPower(0);
    setCharging(false);
    setLastAction(withWebcam ? "Ativando webcam..." : "Modo teclado ativado");
    setPhase("countdown");
  }, [setAim, setCharging, setPhase, setPower]);

  const resetToMenu = useCallback(() => {
    setGameKey((value) => value + 1);
    setScore(0);
    setReadyCount(0);
    setTimeLeft(GAME_DURATION);
    setCountdown(3);
    setAim(0);
    setPower(0);
    setCharging(false);
    setLastAction("Aguardando início");
    setPhase("menu");
  }, [setAim, setCharging, setPhase, setPower]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (phase !== "countdown") return undefined;
    let value = 3;
    setCountdown(value);

    const timer = window.setInterval(() => {
      value -= 1;
      if (value <= 0) {
        window.clearInterval(timer);
        setCountdown(0);
        setPhase("playing");
        setLastAction("Bolas liberadas");
      } else {
        setCountdown(value);
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [phase, setPhase]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const key = event.key.toLowerCase();

      if (key === "a" || event.key === "ArrowLeft") keysRef.current.left = true;
      if (key === "d" || event.key === "ArrowRight") keysRef.current.right = true;
      if (key === "r") startGame(webcamEnabled);

      if (event.code === "Space") {
        event.preventDefault();
        if (phaseRef.current === "menu" || phaseRef.current === "gameover") {
          startGame(webcamEnabled);
          return;
        }
        gameApiRef.current?.beginCharge?.("teclado");
      }
    };

    const onKeyUp = (event) => {
      const key = event.key.toLowerCase();
      if (key === "a" || event.key === "ArrowLeft") keysRef.current.left = false;
      if (key === "d" || event.key === "ArrowRight") keysRef.current.right = false;

      if (event.code === "Space") {
        event.preventDefault();
        gameApiRef.current?.releaseShot?.("teclado");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [startGame, webcamEnabled]);

  useEffect(() => {
    if (!webcamEnabled) return undefined;

    const timer = window.setInterval(() => {
      const gesture = webcamGestureRef.current;
      setGestureInfo(gesture);

      if (gesture.present) setAim(gesture.aim);
      if (phaseRef.current !== "playing") return;

      const now = performance.now();

      // Nova lógica de gesto:
      // - mão fechada: pega/carrega uma bola pronta;
      // - mão aberta: arremessa se já estiver carregando.
      // Não uso mais a regra "previousLabel !== open", porque ela podia travar
      // quando a câmera oscilava entre aberto/neutro/fechado.
      if (gesture.handClosed && !chargingRef.current && now > webcamCooldownRef.current) {
        const picked = gameApiRef.current?.beginCharge?.("webcam");
        if (picked) webcamCooldownRef.current = now + 220;
      }

      if (gesture.handOpen && chargingRef.current && now > webcamCooldownRef.current) {
        const released = gameApiRef.current?.releaseShot?.("webcam");
        if (released) webcamCooldownRef.current = now + 420;
      }
    }, 80);

    return () => window.clearInterval(timer);
  }, [setAim, webcamEnabled]);

  const difficulty = useMemo(() => {
    const elapsed = GAME_DURATION - timeLeft;
    if (phase !== "playing") return "Aguardando";
    if (elapsed < 60) return "Cesta parada";
    if (elapsed < 90) return "Cesta andando";
    return "Cesta rápida";
  }, [phase, timeLeft]);

  return (
    <div className="app">
      <Canvas dpr={[0.85, 1.15]} shadows={false} camera={{ position: [0, 4.7, 8.65], fov: 48 }}>
        <color attach="background" args={["#07111f"]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[3.5, 7, 5]} intensity={1.25} />
        <Physics gravity={[0, -9.81, 0]} timeStep={1 / 60}>
          <GameWorld
            key={gameKey}
            phaseRef={phaseRef}
            keysRef={keysRef}
            aimRef={aimRef}
            powerRef={powerRef}
            chargingRef={chargingRef}
            gameApiRef={gameApiRef}
            onAimChange={setAim}
            onPowerChange={setPower}
            onChargingChange={setCharging}
            onReadyCountChange={setReadyCount}
            onScore={() => {
              setScore((current) => current + 1);
              setLastAction("Cesta!");
            }}
            onTimeChange={setTimeLeft}
            onGameOver={() => {
              setCharging(false);
              setPower(0);
              setPhase("gameover");
              setLastAction("Fim de jogo");
            }}
            onAction={setLastAction}
          />
        </Physics>
        <CameraLookAt />
      </Canvas>

      {webcamEnabled && (
        <WebcamHandController gestureRef={webcamGestureRef} setWebcamStatus={setWebcamStatus} />
      )}

      <div className="hud topHud">
        <div className="stat"><span>Tempo</span><strong>{formatTime(timeLeft)}</strong></div>
        <div className="stat"><span>Cestas</span><strong>{score}</strong></div>
        <div className="stat"><span>Bolas prontas</span><strong>{readyCount}</strong></div>
        <div className="stat wide"><span>Fase</span><strong>{difficulty}</strong></div>
      </div>

      <div className="hud webcamHud">
        <div className="webcamTitle">Controle por webcam</div>
        <div>Status: <strong>{webcamStatus}</strong></div>
        <div>Mão: <strong>{gestureInfo.present ? "detectada" : "não detectada"}</strong></div>
        <div>Gesto: <strong>{gestureInfo.present ? (gestureInfo.handClosed ? "fechada" : "aberta") : "sem mão"}</strong></div>
        <div>Ação: <strong>{lastAction}</strong></div>
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
        <div className="hint">
          Webcam principal: feche a mão para pegar/carregar · abra bem a mão para arremessar · mover a mão mira
          <br />Fallback: A/D ou setas miram · segure Espaço para carregar · solte Espaço para arremessar
        </div>
      </div>

      {phase === "menu" && (
        <div className="overlay">
          <div className="card">
            <p className="eyebrow">Basketball Arcade</p>
            <h1>Jogo de Cestas com Webcam</h1>
            <p>
              A bola rola com física pela rampa. Quando chega no trilho amarelo da frente, fica pronta. Feche a mão para pegar/carregar. Abra bem a mão para arremessar.
            </p>
            <button onClick={() => startGame(true)}>Ativar webcam e iniciar</button>
            <button className="secondary" onClick={() => startGame(false)}>Jogar só no teclado</button>
            <small>Se a webcam falhar, o teclado continua funcionando.</small>
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
            <p>Sua pontuação final é a quantidade de bolas que passaram por dentro do aro.</p>
            <button onClick={() => startGame(webcamEnabled)}>Jogar novamente</button>
            <button className="secondary" onClick={resetToMenu}>Voltar ao menu</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GameWorld({
  phaseRef,
  keysRef,
  aimRef,
  powerRef,
  chargingRef,
  gameApiRef,
  onAimChange,
  onPowerChange,
  onChargingChange,
  onReadyCountChange,
  onScore,
  onTimeChange,
  onGameOver,
  onAction,
}) {
  const ballRefs = useRef([]);
  const hoopRef = useRef(null);
  const ballMetaRef = useRef([
    createBallMeta("locked"),
    createBallMeta("locked"),
    createBallMeta("locked"),
  ]);
  const startTimeRef = useRef(0);
  const playingStartedRef = useRef(false);
  const lastHudUpdateRef = useRef(0);
  const heldBallRef = useRef(null);
  const chargeStartRef = useRef(0);
  const hoopXRef = useRef(0);
  const hoopDirectionRef = useRef(1);
  const rimSpringRef = useRef(0);
  const rimSpringVelocityRef = useRef(0);
  const rimHitCooldownRef = useRef(0);
  const readyCountRef = useRef(0);

  const rimPoints = useMemo(() => {
    return Array.from({ length: 14 }, (_, index) => {
      const angle = (index / 14) * Math.PI * 2;
      return [Math.cos(angle) * RIM_RADIUS, 0, Math.sin(angle) * RIM_RADIUS];
    });
  }, []);

  const stopBody = useCallback((body) => {
    if (!body) return;
    body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }, []);

  const setBallPosition = useCallback((index, position, gravityScale = 0) => {
    const body = ballRefs.current[index];
    if (!body) return;
    body.setTranslation({ x: position.x, y: position.y, z: position.z }, true);
    body.setGravityScale(gravityScale, true);
    stopBody(body);
    body.wakeUp?.();
  }, [stopBody]);

  const updateReadyCount = useCallback(() => {
    const count = ballMetaRef.current.filter((ball) => ball.status === "ready").length;
    if (count !== readyCountRef.current) {
      readyCountRef.current = count;
      onReadyCountChange(count);
    }
  }, [onReadyCountChange]);

  const findFreeSlot = useCallback((preferredX = 0) => {
    const used = new Set(
      ballMetaRef.current
        .filter((meta) => meta.slot !== null && (meta.status === "ready" || meta.status === "held"))
        .map((meta) => meta.slot)
    );

    const sorted = READY_SLOTS
      .map((x, index) => ({ index, x, distance: Math.abs(x - preferredX) }))
      .sort((a, b) => a.distance - b.distance);

    const free = sorted.find((slot) => !used.has(slot.index));
    return free ? free.index : sorted[0].index;
  }, []);

  const markBallReady = useCallback((index) => {
    const meta = ballMetaRef.current[index];
    const body = ballRefs.current[index];
    if (!meta || !body) return;
    if (meta.status === "ready" || meta.status === "held" || meta.status === "shot" || meta.status === "returning") return;

    const pos = body.translation();
    const slot = findFreeSlot(pos.x);
    const slotX = READY_SLOTS[slot];

    meta.status = "ready";
    meta.slot = slot;
    meta.scored = false;
    meta.previousY = null;
    meta.shotAge = 0;

    // Quando a bola chega no container amarelo, ela encaixa num trilho frontal.
    // Isso evita bug de colisão, bola presa no canto e sobreposição de objetos.
    body.setTranslation({ x: slotX, y: READY_Y, z: READY_Z }, true);
    body.setGravityScale(0, true);
    stopBody(body);
    body.wakeUp?.();

    updateReadyCount();
    onAction?.("Bola pronta");
  }, [findFreeSlot, onAction, stopBody, updateReadyCount]);

  const sendBallToRamp = useCallback((index) => {
    const body = ballRefs.current[index];
    const start = BALL_STARTS[index];
    const meta = ballMetaRef.current[index];
    if (!body || !meta) return;

    meta.status = "rolling";
    meta.slot = null;
    meta.scored = false;
    meta.previousY = null;
    meta.returnTimer = 0;
    meta.shotAge = 0;

    body.setGravityScale(1, true);
    body.setTranslation({ x: start.x, y: start.y, z: start.z }, true);
    body.setLinvel({ x: 0, y: 0.02, z: 0.28 }, true);
    body.setAngvel({ x: 1.2, y: 0, z: 0 }, true);
    body.wakeUp?.();
    updateReadyCount();
  }, [updateReadyCount]);

  const putBallInReturn = useCallback((index, delay = 0.45) => {
    const meta = ballMetaRef.current[index];
    if (!meta) return;
    meta.status = "returning";
    meta.slot = null;
    meta.returnTimer = delay;
    meta.previousY = null;
    meta.shotAge = 0;
    updateReadyCount();
  }, [updateReadyCount]);

  const pickReadyBallIndex = useCallback(() => {
    const readyIndexes = ballMetaRef.current
      .map((meta, index) => ({ meta, index }))
      .filter(({ meta }) => meta.status === "ready")
      .map(({ index }) => index);

    if (readyIndexes.length === 0) return -1;

    const targetX = aimRef.current * TABLE_HALF_X;
    return readyIndexes.reduce((best, current) => {
      const currentBody = ballRefs.current[current];
      const bestBody = ballRefs.current[best];
      const currentX = currentBody?.translation?.().x ?? 0;
      const bestX = bestBody?.translation?.().x ?? 0;
      return Math.abs(currentX - targetX) < Math.abs(bestX - targetX) ? current : best;
    }, readyIndexes[0]);
  }, [aimRef]);

  const beginCharge = useCallback((source = "controle") => {
    if (phaseRef.current !== "playing") return false;
    if (chargingRef.current) return false;

    const index = pickReadyBallIndex();
    if (index < 0) {
      onAction?.("Nenhuma bola pronta");
      return false;
    }

    const meta = ballMetaRef.current[index];
    if (!meta) return false;

    meta.status = "held";
    meta.slot = null;
    heldBallRef.current = index;
    setBallPosition(index, { ...LAUNCH_POS, x: aimRef.current * 0.42 }, 0);
    chargeStartRef.current = performance.now();
    onPowerChange(0);
    onChargingChange(true);
    updateReadyCount();
    onAction?.(`${source}: carregando`);
    return true;
  }, [aimRef, chargingRef, onAction, onChargingChange, onPowerChange, phaseRef, pickReadyBallIndex, setBallPosition, updateReadyCount]);

  const releaseShot = useCallback((source = "controle") => {
    if (phaseRef.current !== "playing") return false;
    if (!chargingRef.current) return false;

    const index = heldBallRef.current;
    if (index === null || index === undefined) return false;

    const body = ballRefs.current[index];
    const meta = ballMetaRef.current[index];
    if (!body || !meta) return false;

    const shotPower = clamp(powerRef.current, 0.12, 1);
    const aim = aimRef.current;
    const launchX = aim * 0.42;

    body.setTranslation({ x: launchX, y: LAUNCH_POS.y, z: LAUNCH_POS.z }, true);
    body.setGravityScale(1, true);
    body.setLinvel({
      x: aim * 2.2,
      y: 6.45 + shotPower * 2.85,
      z: -8.05 - shotPower * 2.45,
    }, true);
    body.setAngvel({ x: -8.5 - shotPower * 5, y: aim * 1.7, z: aim * 2.6 }, true);
    body.wakeUp?.();

    meta.status = "shot";
    meta.slot = null;
    meta.scored = false;
    meta.previousY = LAUNCH_POS.y;
    meta.shotAge = 0;

    heldBallRef.current = null;
    onChargingChange(false);
    onPowerChange(0);
    updateReadyCount();
    onAction?.(`${source}: arremesso`);
    return true;
  }, [aimRef, chargingRef, onAction, onChargingChange, onPowerChange, phaseRef, powerRef, updateReadyCount]);

  useEffect(() => {
    gameApiRef.current = { beginCharge, releaseShot };
    return () => {
      gameApiRef.current = null;
    };
  }, [beginCharge, gameApiRef, releaseShot]);

  useFrame((_, delta) => {
    const phase = phaseRef.current;

    if (phase === "countdown" || phase === "menu" || phase === "gameover") {
      for (let index = 0; index < 3; index += 1) {
        const meta = ballMetaRef.current[index];
        meta.status = "locked";
        meta.slot = null;
        meta.returnTimer = 0;
        setBallPosition(index, BALL_STARTS[index], 0);
      }
      playingStartedRef.current = false;
      updateReadyCount();
      return;
    }

    if (phase !== "playing") return;

    if (!playingStartedRef.current) {
      playingStartedRef.current = true;
      startTimeRef.current = performance.now();
      lastHudUpdateRef.current = 0;
      heldBallRef.current = null;
      onTimeChange(GAME_DURATION);
      for (let index = 0; index < 3; index += 1) sendBallToRamp(index);
    }

    if (keysRef.current.left) onAimChange(aimRef.current - delta * 1.55);
    if (keysRef.current.right) onAimChange(aimRef.current + delta * 1.55);

    const elapsed = (performance.now() - startTimeRef.current) / 1000;
    const timeLeft = Math.max(0, GAME_DURATION - elapsed);

    if (performance.now() - lastHudUpdateRef.current > 135) {
      lastHudUpdateRef.current = performance.now();
      onTimeChange(timeLeft);
    }

    if (timeLeft <= 0) {
      onTimeChange(0);
      onGameOver();
      return;
    }

    if (chargingRef.current) {
      const cycleMs = 1300;
      const t = ((performance.now() - chargeStartRef.current) % cycleMs) / cycleMs;
      const charge = t < 0.5 ? t * 2 : (1 - t) * 2;
      onPowerChange(clamp(charge, 0, 1));
    }

    let hoopSpeed = 0;
    if (elapsed >= 90) hoopSpeed = 1.85;
    else if (elapsed >= 60) hoopSpeed = 0.92;

    if (hoopSpeed > 0) {
      hoopXRef.current += hoopDirectionRef.current * hoopSpeed * delta;
      if (hoopXRef.current >= HOOP_LIMIT_X) {
        hoopXRef.current = HOOP_LIMIT_X;
        hoopDirectionRef.current = -1;
      }
      if (hoopXRef.current <= -HOOP_LIMIT_X) {
        hoopXRef.current = -HOOP_LIMIT_X;
        hoopDirectionRef.current = 1;
      }
    } else {
      hoopXRef.current = 0;
      hoopDirectionRef.current = 1;
    }

    rimHitCooldownRef.current = Math.max(0, rimHitCooldownRef.current - delta);
    rimSpringVelocityRef.current += (-rimSpringRef.current * 40 - rimSpringVelocityRef.current * 11) * delta;
    rimSpringRef.current += rimSpringVelocityRef.current * delta;
    rimSpringRef.current = clamp(rimSpringRef.current, 0, 0.12);

    if (hoopRef.current) {
      hoopRef.current.setNextKinematicTranslation({
        x: hoopXRef.current,
        y: RIM_Y - rimSpringRef.current,
        z: RIM_Z,
      });
    }

    for (let index = 0; index < 3; index += 1) {
      const body = ballRefs.current[index];
      const meta = ballMetaRef.current[index];
      if (!body || !meta) continue;
      const pos = body.translation();

      if (meta.status === "rolling") {
        const reachedFront = pos.z >= CATCH_Z && pos.y < 1.9 && Math.abs(pos.x) <= TABLE_HALF_X + 0.9;
        const stuckNearFront = pos.z > 0.65 && Math.abs(pos.z - CATCH_Z) < 0.9 && Math.abs(pos.x) <= TABLE_HALF_X + 1.25 && Math.abs(body.linvel().z) < 0.12;

        if (reachedFront || stuckNearFront) {
          markBallReady(index);
          continue;
        }

        if (pos.y < -1.25 || Math.abs(pos.x) > 4.7 || pos.z > 4.2 || pos.z < -9.7) {
          sendBallToRamp(index);
          continue;
        }
      }

      if (meta.status === "ready") {
        const slotX = READY_SLOTS[meta.slot ?? 1];
        body.setTranslation({ x: slotX, y: READY_Y, z: READY_Z }, true);
        body.setGravityScale(0, true);
        stopBody(body);
        continue;
      }

      if (meta.status === "held") {
        setBallPosition(index, { ...LAUNCH_POS, x: aimRef.current * 0.42 }, 0);
        continue;
      }

      if (meta.status === "returning") {
        meta.returnTimer -= delta;
        if (meta.returnTimer <= 0) sendBallToRamp(index);
        continue;
      }

      if (meta.status === "shot") {
        meta.shotAge += delta;
        const previousY = meta.previousY ?? pos.y;
        const movingDown = previousY > pos.y;
        const dx = pos.x - hoopXRef.current;
        const dz = pos.z - RIM_Z;
        const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);

        if (rimHitCooldownRef.current <= 0 && distanceFromCenter < RIM_RADIUS + 0.2 && Math.abs(pos.y - RIM_Y) < 0.28) {
          rimSpringVelocityRef.current += 2.05;
          rimHitCooldownRef.current = 0.18;
        }

        if (!meta.scored && movingDown && distanceFromCenter < SCORE_RADIUS && previousY > RIM_Y && pos.y <= RIM_Y) {
          meta.scored = true;
          putBallInReturn(index, 0.42);
          onScore();
          continue;
        }

        meta.previousY = pos.y;

        if (meta.shotAge > 4.2 || pos.y < -1.25 || pos.z < -11 || pos.z > 4.6 || Math.abs(pos.x) > 5.1) {
          putBallInReturn(index, 0.28);
        }
      }
    }
  });

  return (
    <>
      <ArcadeMachine />
      <Hoop refObject={hoopRef} rimPoints={rimPoints} />
      <AimPreview aim={aimRef.current} power={powerRef.current} charging={chargingRef.current} />

      {BALL_STARTS.map((start, index) => (
        <RigidBody
          key={index}
          ref={(body) => { ballRefs.current[index] = body; }}
          type="dynamic"
          colliders={false}
          canSleep={false}
          position={[start.x, start.y, start.z]}
          restitution={0.28}
          friction={0.86}
          linearDamping={0.025}
          angularDamping={0.06}
          ccd
        >
          <BallCollider args={[BALL_RADIUS]} />
          <BasketballMesh index={index} />
        </RigidBody>
      ))}
    </>
  );
}

function CameraLookAt() {
  useFrame(({ camera }) => {
    camera.lookAt(0, 1.45, -2.45);
  });
  return null;
}

function ArcadeMachine() {
  const rampRotation = 0.13;

  return (
    <group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[6.8, 0.08, 6.8]} position={[0, -0.18, -1.7]} />
        <CuboidCollider args={[2.22, 0.07, 4.55]} position={[0, 0.82, -2.08]} rotation={[rampRotation, 0, 0]} />
        <CuboidCollider args={[0.14, 0.63, 4.65]} position={[-2.36, 0.97, -2.08]} rotation={[rampRotation, 0, 0]} />
        <CuboidCollider args={[0.14, 0.63, 4.65]} position={[2.36, 0.97, -2.08]} rotation={[rampRotation, 0, 0]} />
        <CuboidCollider args={[2.55, 0.33, 0.18]} position={[0, 0.56, 2.28]} />
        <CuboidCollider args={[2.35, 0.85, 0.16]} position={[0, 0.72, -7.0]} />
      </RigidBody>

      <mesh receiveShadow position={[0, -0.22, -1.7]}>
        <boxGeometry args={[13.6, 0.1, 13.6]} />
        <meshStandardMaterial color="#0f172a" roughness={0.92} />
      </mesh>

      <mesh receiveShadow position={[0, 0.82, -2.08]} rotation={[rampRotation, 0, 0]}>
        <boxGeometry args={[4.44, 0.12, 9.1]} />
        <meshStandardMaterial color="#263956" roughness={0.78} />
      </mesh>

      <mesh receiveShadow position={[-2.42, 0.99, -2.08]} rotation={[rampRotation, 0, 0]}>
        <boxGeometry args={[0.28, 1.28, 9.3]} />
        <meshStandardMaterial color="#07111f" roughness={0.88} />
      </mesh>

      <mesh receiveShadow position={[2.42, 0.99, -2.08]} rotation={[rampRotation, 0, 0]}>
        <boxGeometry args={[0.28, 1.28, 9.3]} />
        <meshStandardMaterial color="#07111f" roughness={0.88} />
      </mesh>

      <mesh receiveShadow position={[0, 0.54, 2.36]}>
        <boxGeometry args={[5.7, 0.78, 0.42]} />
        <meshStandardMaterial color="#d97706" roughness={0.45} />
      </mesh>

      <mesh receiveShadow position={[0, 0.96, 2.22]}>
        <boxGeometry args={[5.45, 0.16, 0.24]} />
        <meshStandardMaterial color="#fbbf24" roughness={0.4} />
      </mesh>

      <mesh receiveShadow position={[0, 0.75, 1.74]}>
        <boxGeometry args={[5.05, 0.11, 0.2]} />
        <meshStandardMaterial color="#fde68a" emissive="#f59e0b" emissiveIntensity={0.12} roughness={0.44} />
      </mesh>

      <mesh receiveShadow position={[0, 0.76, -7.0]}>
        <boxGeometry args={[5.0, 1.7, 0.3]} />
        <meshStandardMaterial color="#111827" roughness={0.86} />
      </mesh>

      <mesh receiveShadow position={[-2.0, 1.66, -7.05]}>
        <boxGeometry args={[0.22, 2.55, 0.22]} />
        <meshStandardMaterial color="#334155" roughness={0.65} />
      </mesh>

      <mesh receiveShadow position={[2.0, 1.66, -7.05]}>
        <boxGeometry args={[0.22, 2.55, 0.22]} />
        <meshStandardMaterial color="#334155" roughness={0.65} />
      </mesh>

      <mesh position={[0, 0.28, 2.58]}>
        <boxGeometry args={[5.9, 0.2, 0.32]} />
        <meshStandardMaterial color="#92400e" roughness={0.55} />
      </mesh>

      {READY_SLOTS.map((x, index) => (
        <mesh key={index} position={[x, READY_Y - 0.3, READY_Z]}>
          <boxGeometry args={[0.72, 0.04, 0.12]} />
          <meshStandardMaterial color="#fed7aa" emissive="#f59e0b" emissiveIntensity={0.1} />
        </mesh>
      ))}
    </group>
  );
}

function Hoop({ refObject, rimPoints }) {
  return (
    <RigidBody ref={refObject} type="kinematicPosition" colliders={false} position={[0, RIM_Y, RIM_Z]}>
      <CuboidCollider args={[1.42, 0.72, 0.06]} position={[0, 0.52, -0.58]} />
      {rimPoints.map((point, index) => (
        <BallCollider key={index} args={[RIM_COLLIDER_RADIUS]} position={point} />
      ))}

      <mesh receiveShadow position={[0, 0.52, -0.62]}>
        <boxGeometry args={[2.84, 1.44, 0.11]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.34} />
      </mesh>

      <mesh receiveShadow position={[0, 0.52, -0.69]}>
        <boxGeometry args={[1.18, 0.7, 0.035]} />
        <meshStandardMaterial color="#bfdbfe" transparent opacity={0.42} roughness={0.25} />
      </mesh>

      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RIM_RADIUS, 0.045, 8, 42]} />
        <meshStandardMaterial color="#ef4444" metalness={0.14} roughness={0.34} />
      </mesh>

      <NetVisual />
    </RigidBody>
  );
}

function NetVisual() {
  const lines = useMemo(() => {
    return Array.from({ length: 8 }, (_, index) => {
      const angle = (index / 8) * Math.PI * 2;
      const top = new THREE.Vector3(Math.cos(angle) * 0.51, -0.04, Math.sin(angle) * 0.51);
      const bottom = new THREE.Vector3(Math.cos(angle) * 0.29, -0.68, Math.sin(angle) * 0.29);
      return [top, bottom];
    });
  }, []);

  return (
    <group>
      {lines.map((points, index) => {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return (
          <line key={index} geometry={geometry}>
            <lineBasicMaterial color="#e5e7eb" transparent opacity={0.78} />
          </line>
        );
      })}
    </group>
  );
}

function BasketballMesh({ index }) {
  const color = index === 0 ? "#f97316" : index === 1 ? "#fb923c" : "#ea580c";

  return (
    <group>
      <mesh receiveShadow>
        <sphereGeometry args={[BALL_RADIUS, 20, 12]} />
        <meshStandardMaterial color={color} roughness={0.58} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[BALL_RADIUS * 0.98, 0.0055, 5, 24]} />
        <meshStandardMaterial color="#1f1307" roughness={0.7} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[BALL_RADIUS * 0.98, 0.0055, 5, 24]} />
        <meshStandardMaterial color="#1f1307" roughness={0.7} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[BALL_RADIUS * 0.98, 0.0055, 5, 24]} />
        <meshStandardMaterial color="#1f1307" roughness={0.7} />
      </mesh>
    </group>
  );
}

function AimPreview({ aim, power, charging }) {
  const geometry = useMemo(() => {
    const currentPower = clamp(power || 0.18, 0.12, 1);
    const start = new THREE.Vector3(LAUNCH_POS.x + aim * 0.42, LAUNCH_POS.y, LAUNCH_POS.z);
    const velocity = new THREE.Vector3(aim * 2.2, 6.45 + currentPower * 2.85, -8.05 - currentPower * 2.45);
    const points = [];

    for (let i = 0; i < 18; i += 1) {
      const t = i * 0.06;
      points.push(new THREE.Vector3(
        start.x + velocity.x * t,
        start.y + velocity.y * t - 0.5 * 9.81 * t * t,
        start.z + velocity.z * t
      ));
    }

    return new THREE.BufferGeometry().setFromPoints(points);
  }, [aim, power]);

  if (!charging) return null;

  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#38bdf8" transparent opacity={0.88} />
    </line>
  );
}

function WebcamHandController({ gestureRef, setWebcamStatus }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const landmarkerRef = useRef(null);
  const timerRef = useRef(0);
  const lastDetectAtRef = useRef(0);
  const stableRef = useRef({
    label: "open",
    pendingLabel: "open",
    pendingCount: 0,
    gesture: { present: false, handOpen: true, handClosed: false, aim: 0 },
  });

  useEffect(() => {
    let cancelled = false;

    async function startWebcam() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setWebcamStatus("sem suporte / use teclado");
          return;
        }

        setWebcamStatus("pedindo permissão");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            frameRate: { ideal: 15, max: 20 },
            facingMode: "user",
          },
          audio: false,
        });

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const video = videoRef.current;
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        await video.play();

        setWebcamStatus("carregando mão");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm");
        if (cancelled) return;

        landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.42,
          minHandPresenceConfidence: 0.42,
          minTrackingConfidence: 0.42,
        });

        setWebcamStatus("ativa");
        loop();
      } catch (error) {
        console.error(error);
        setWebcamStatus("erro / use teclado");
        gestureRef.current = { present: false, handOpen: false, handClosed: false, aim: 0 };
      }
    }

    function stabilize(rawGesture) {
      // Agora não existe mais estado "neutro" quando a mão está visível.
      // Toda leitura com mão detectada vira obrigatoriamente "open" ou "closed".
      const rawLabel = rawGesture.handClosed ? "closed" : "open";
      const stable = stableRef.current;

      if (!rawGesture.present) {
        stable.pendingCount = 0;
        stable.gesture = rawGesture;
        return rawGesture;
      }

      if (rawLabel === stable.pendingLabel) {
        stable.pendingCount += 1;
      } else {
        stable.pendingLabel = rawLabel;
        stable.pendingCount = 1;
      }

      // Histerese: só muda entre aberta/fechada depois de leituras consecutivas.
      // Não há mais estado neutro com a mão visível.
      const requiredFrames = 2;
      if (stable.pendingCount >= requiredFrames) {
        stable.label = rawLabel;
      }

      const output = {
        ...rawGesture,
        handClosed: stable.label === "closed",
        handOpen: stable.label === "open",
      };
      stable.gesture = output;
      return output;
    }

    function loop() {
      if (cancelled) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (!video || !canvas) {
        timerRef.current = window.setTimeout(loop, 80);
        return;
      }

      const width = 320;
      const height = 240;
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, width, height);

      const now = performance.now();
      if (landmarker && video.readyState >= 2 && now - lastDetectAtRef.current >= 95) {
        lastDetectAtRef.current = now;
        const results = landmarker.detectForVideo(video, now);
        const landmarks = results.landmarks?.[0];

        if (landmarks) {
          const raw = analyzeHand(landmarks);
          const gesture = stabilize(raw);
          gestureRef.current = gesture;
          drawHand(ctx, landmarks, width, height, gesture);
        } else {
          const gesture = { present: false, handOpen: false, handClosed: false, aim: 0 };
          gestureRef.current = gesture;
          stableRef.current.gesture = gesture;
        }
      }

      ctx.restore();
      timerRef.current = window.setTimeout(loop, 70);
    }

    startWebcam();

    return () => {
      cancelled = true;
      window.clearTimeout(timerRef.current);
      streamRef.current?.getTracks()?.forEach((track) => track.stop());
      gestureRef.current = { present: false, handOpen: false, handClosed: false, aim: 0 };
      setWebcamStatus("desligada");
    };
  }, [gestureRef, setWebcamStatus]);

  return (
    <div className="webcamPreview">
      <video ref={videoRef} className="hiddenVideo" playsInline muted />
      <canvas ref={canvasRef} />
    </div>
  );
}

function analyzeHand(landmarks) {
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const tips = [8, 12, 16, 20];
  const pips = [6, 10, 14, 18];
  const mcps = [5, 9, 13, 17];

  const palmSize = Math.max(0.04, distance2D(wrist, middleMcp));
  const openness = tips.reduce((sum, index) => sum + distance2D(wrist, landmarks[index]), 0) / tips.length / palmSize;

  let extendedCount = 0;
  let curledCount = 0;

  for (let i = 0; i < tips.length; i += 1) {
    const tip = landmarks[tips[i]];
    const pip = landmarks[pips[i]];
    const mcp = landmarks[mcps[i]];
    const tipToWrist = distance2D(tip, wrist);
    const pipToWrist = Math.max(0.001, distance2D(pip, wrist));
    const mcpToWrist = Math.max(0.001, distance2D(mcp, wrist));

    const tipVsMcp = tipToWrist / mcpToWrist;
    const tipVsPip = tipToWrist / pipToWrist;

    // Mais estável que usar só a coordenada Y, porque a pessoa pode virar a mão.
    if (tipVsMcp > 1.28 && tipVsPip > 1.04) {
      extendedCount += 1;
    }

    if (tipVsMcp < 1.14 || tipVsPip < 0.98) {
      curledCount += 1;
    }
  }

  // Classificação sem neutro:
  // se a mão está visível, ela sempre será aberta ou fechada.
  // Em casos ambíguos, comparamos uma pontuação de dedos esticados vs. dedos curvados.
  const openScore = extendedCount + (openness > 2.02 ? 1 : 0) + (openness > 2.18 ? 1 : 0);
  const closedScore = curledCount + (openness < 2.02 ? 1 : 0) + (extendedCount <= 1 ? 1 : 0);

  const handClosed = closedScore > openScore;
  const handOpen = !handClosed;

  const aim = clamp((0.5 - wrist.x) * 2.8, -1, 1);
  return { present: true, handOpen, handClosed, aim, extendedCount, curledCount, openness, openScore, closedScore };
}

function drawHand(ctx, landmarks, width, height, gesture) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = gesture.handClosed ? "#f97316" : "#22c55e";
  ctx.fillStyle = ctx.strokeStyle;

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17],
  ];

  const point = (index) => ({ x: landmarks[index].x * width, y: landmarks[index].y * height });

  connections.forEach(([a, b]) => {
    const p1 = point(a);
    const p2 = point(b);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  });

  landmarks.forEach((landmark) => {
    ctx.beginPath();
    ctx.arc(landmark.x * width, landmark.y * height, 3.4, 0, Math.PI * 2);
    ctx.fill();
  });
}
