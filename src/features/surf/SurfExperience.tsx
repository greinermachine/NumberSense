import { Canvas, useFrame } from '@react-three/fiber';
import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  BufferGeometry,
  Color,
  DoubleSide,
  DynamicDrawUsage,
  Float32BufferAttribute,
  PerspectiveCamera,
  Vector3,
} from 'three';
import { CalmGlide } from './CalmGlide';
import { SURF_TUNING } from './config';
import { getSurfCourse, SURF_COURSES } from './courses';
import {
  advanceWithFixedSteps,
  computeCameraRight,
  createSurfPlayer,
  createSurfSimulationScratch,
  sampleRampSurface,
} from './physics';
import type {
  RampDefinition,
  SurfCourseDefinition,
  SurfDebugStats,
  SurfInput,
  SurfPlayerState,
} from './types';
import styles from './SurfExperience.module.css';

type Props = { courseIndex: number; onComplete: () => void };

function useCalmMode() {
  const read = () =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [calmMode, setCalmMode] = useState(read);

  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setCalmMode(coarse.matches || reduced.matches);
    coarse.addEventListener('change', update);
    reduced.addEventListener('change', update);
    return () => {
      coarse.removeEventListener('change', update);
      reduced.removeEventListener('change', update);
    };
  }, []);
  return calmMode;
}

export default function SurfExperience({ courseIndex, onComplete }: Props) {
  const selectedCourseIndex = useMemo(() => {
    if (!import.meta.env.DEV) return courseIndex;
    const requestedCourse = new URLSearchParams(window.location.search).get('surfCourse');
    if (requestedCourse === null) return courseIndex;
    const override = Number(requestedCourse);
    return Number.isInteger(override) && override >= 0 && override < SURF_COURSES.length
      ? override
      : courseIndex;
  }, [courseIndex]);
  const course = useMemo(() => getSurfCourse(selectedCourseIndex), [selectedCourseIndex]);
  const calmMode = useCalmMode();
  if (calmMode) return <CalmGlide course={course} onComplete={onComplete} />;
  return (
    <SurfErrorBoundary fallback={<CalmGlide course={course} onComplete={onComplete} />}>
      <InteractiveSurf course={course} onComplete={onComplete} />
    </SurfErrorBoundary>
  );
}

function InteractiveSurf({ course, onComplete }: { course: SurfCourseDefinition; onComplete: () => void }) {
  const shellRef = useRef<HTMLElement>(null);
  const initiallyLocked = Boolean(document.pointerLockElement);
  const [locked, setLocked] = useState(initiallyLocked);
  const [running, setRunning] = useState(initiallyLocked);
  const [entered, setEntered] = useState(initiallyLocked);
  const [finished, setFinished] = useState(false);
  const [resetPulse, setResetPulse] = useState(0);
  const debugEnabled = useMemo(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).get('surfDebug') === '1',
    [],
  );
  const [debugStats, setDebugStats] = useState<SurfDebugStats>();
  const enteredRef = useRef(initiallyLocked);
  const finishedRef = useRef(false);
  const finishTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const updateLock = () => {
      const isLocked = Boolean(document.pointerLockElement);
      setLocked(isLocked);
      if (isLocked) {
        enteredRef.current = true;
        setEntered(true);
        setRunning(true);
      } else if (enteredRef.current && !finishedRef.current) {
        setRunning(false);
      }
    };
    document.addEventListener('pointerlockchange', updateLock);
    return () => {
      document.removeEventListener('pointerlockchange', updateLock);
      if (finishTimer.current) window.clearTimeout(finishTimer.current);
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, []);

  const capture = useCallback(() => {
    enteredRef.current = true;
    setEntered(true);
    setRunning(true);
    try {
      const request = shellRef.current?.requestPointerLock?.();
      if (request && 'catch' in request) request.catch(() => setLocked(false));
    } catch {
      setLocked(false);
    }
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setFinished(true);
    if (document.pointerLockElement) document.exitPointerLock();
    finishTimer.current = window.setTimeout(onComplete, 720);
  }, [onComplete]);

  const noteReset = useCallback((resets: number) => setResetPulse(resets), []);

  return (
    <main
      ref={shellRef}
      className={styles.surfShell}
      data-running={running}
      style={{ '--surf-accent': course.accent } as React.CSSProperties}
    >
      <Canvas
        className={styles.canvas}
        dpr={[1, 1.25]}
        camera={{ fov: SURF_TUNING.baseFov, near: 0.08, far: 360 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={[course.sky]} />
        <fog attach="fog" args={[course.fog, 70, 245]} />
        <ambientLight intensity={0.66} />
        <directionalLight position={[28, 42, -14]} intensity={1.18} color="#fffaf0" />
        <hemisphereLight args={['#f4f1e6', course.floor, 0.58]} />
        <CourseWorld course={course} />
        <SurfController
          course={course}
          running={running}
          debug={debugEnabled}
          onDebug={setDebugStats}
          onReset={noteReset}
          onComplete={finish}
        />
      </Canvas>

      <div className={styles.stageMark} aria-hidden="true">
        <span>{course.stageLabel}</span>
        <strong>{course.name}</strong>
      </div>
      <div className={styles.reticle} aria-hidden="true" />

      {running && !finished && (
        <div className={styles.controlHint} data-locked={locked} aria-hidden="true">
          <span>Mouse</span><span>+</span><kbd>A</kbd><span>/</span><kbd>D</kbd>
          <em>{course.cue}</em>
        </div>
      )}

      {!running && !finished && (
        <div className={styles.captureLayer}>
          <div className={styles.capturePanel}>
            <p>{entered ? 'The line is paused.' : course.cue}</p>
            <button className={styles.capture} type="button" onClick={capture} autoFocus>
              {entered ? 'Return to the line' : 'Enter the line'} <span aria-hidden="true">→</span>
            </button>
            <span>Mouse + A / D · Escape pauses</span>
          </div>
        </div>
      )}

      {running && !locked && !finished && (
        <button className={styles.recapture} type="button" onClick={capture}>
          Capture mouse
        </button>
      )}

      {resetPulse > 0 && !finished && (
        <div className={styles.resetVeil} key={resetPulse} role="status">
          <span>Back on the line.</span>
        </div>
      )}

      {finished && <div className={styles.finished} role="status"><span>Through.</span></div>}
      {debugEnabled && debugStats && <SurfDebugPanel stats={debugStats} />}
    </main>
  );
}

function CourseWorld({ course }: { course: SurfCourseDefinition }) {
  return (
    <>
      <group>{course.ramps.map((definition) => <RampMesh key={definition.id} ramp={definition} />)}</group>
      <RouteLine course={course} />
      <Architecture course={course} />
      <GoalGate course={course} />
      <SpeedMarkers course={course} />
      <mesh position={[0, SURF_TUNING.resetHeight - 1.5, course.goal.position.z / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[170, course.goal.position.z + 110]} />
        <meshLambertMaterial color={course.floor} />
      </mesh>
    </>
  );
}

type Point = readonly [number, number, number];

function rampCorners(ramp: RampDefinition): [Point, Point, Point, Point] {
  const leftX = ramp.centerX - ramp.width / 2;
  const rightX = ramp.centerX + ramp.width / 2;
  const leftStart = sampleRampSurface(ramp, leftX, ramp.startZ)!.height;
  const rightStart = sampleRampSurface(ramp, rightX, ramp.startZ)!.height;
  const leftEnd = sampleRampSurface(ramp, leftX, ramp.endZ)!.height;
  const rightEnd = sampleRampSurface(ramp, rightX, ramp.endZ)!.height;
  return [
    [leftX, leftStart, ramp.startZ],
    [rightX, rightStart, ramp.startZ],
    [leftX, leftEnd, ramp.endZ],
    [rightX, rightEnd, ramp.endZ],
  ];
}

function makeRampGeometry(ramp: RampDefinition) {
  const [leftStart, rightStart, leftEnd, rightEnd] = rampCorners(ramp);
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [...leftStart, ...leftEnd, ...rightStart, ...rightStart, ...leftEnd, ...rightEnd],
      3,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

function makeRampSkirtGeometry(ramp: RampDefinition) {
  const [leftStart, rightStart, leftEnd, rightEnd] = rampCorners(ramp);
  const bottomY = Math.min(leftStart[1], rightStart[1], leftEnd[1], rightEnd[1]) - 2.4;
  const positions: number[] = [];
  const pushQuad = (a: Point, b: Point, c: Point, d: Point) => {
    positions.push(...a, ...b, ...c, ...a, ...c, ...d);
  };
  const leftStartBottom: Point = [leftStart[0], bottomY, leftStart[2]];
  const rightStartBottom: Point = [rightStart[0], bottomY, rightStart[2]];
  const leftEndBottom: Point = [leftEnd[0], bottomY, leftEnd[2]];
  const rightEndBottom: Point = [rightEnd[0], bottomY, rightEnd[2]];
  pushQuad(leftStart, leftStartBottom, leftEndBottom, leftEnd);
  pushQuad(rightStart, rightEnd, rightEndBottom, rightStartBottom);
  pushQuad(leftStartBottom, rightStartBottom, rightEndBottom, leftEndBottom);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makeRampMarkGeometry(ramp: RampDefinition) {
  const positions: number[] = [];
  const addLine = (x1: number, z1: number, x2: number, z2: number) => {
    const y1 = sampleRampSurface(ramp, x1, z1)!.height + 0.045;
    const y2 = sampleRampSurface(ramp, x2, z2)!.height + 0.045;
    positions.push(x1, y1, z1, x2, y2, z2);
  };
  const inset = ramp.width * 0.13;
  for (const progress of [0.25, 0.5, 0.75]) {
    const z = ramp.startZ + (ramp.endZ - ramp.startZ) * progress;
    addLine(ramp.centerX - ramp.width / 2 + inset, z, ramp.centerX + ramp.width / 2 - inset, z);
  }
  const highX = ramp.centerX + (ramp.bankRadians >= 0 ? 1 : -1) * (ramp.width / 2 - 0.28);
  addLine(highX, ramp.startZ + 0.3, highX, ramp.endZ - 0.3);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  return geometry;
}

function makeRampGuideGeometry(ramp: RampDefinition) {
  const halfWidth = 0.075;
  const leftX = ramp.centerX - halfWidth;
  const rightX = ramp.centerX + halfWidth;
  const lift = 0.065;
  const leftStart: Point = [
    leftX,
    sampleRampSurface(ramp, leftX, ramp.startZ)!.height + lift,
    ramp.startZ,
  ];
  const rightStart: Point = [
    rightX,
    sampleRampSurface(ramp, rightX, ramp.startZ)!.height + lift,
    ramp.startZ,
  ];
  const leftEnd: Point = [
    leftX,
    sampleRampSurface(ramp, leftX, ramp.endZ)!.height + lift,
    ramp.endZ,
  ];
  const rightEnd: Point = [
    rightX,
    sampleRampSurface(ramp, rightX, ramp.endZ)!.height + lift,
    ramp.endZ,
  ];
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [...leftStart, ...leftEnd, ...rightStart, ...rightStart, ...leftEnd, ...rightEnd],
      3,
    ),
  );
  return geometry;
}

function RampMesh({ ramp }: { ramp: RampDefinition }) {
  const topGeometry = useMemo(() => makeRampGeometry(ramp), [ramp]);
  const skirtGeometry = useMemo(() => makeRampSkirtGeometry(ramp), [ramp]);
  const markGeometry = useMemo(() => makeRampMarkGeometry(ramp), [ramp]);
  const guideGeometry = useMemo(() => makeRampGuideGeometry(ramp), [ramp]);
  const skirtColor = useMemo(() => new Color(ramp.color).multiplyScalar(0.76), [ramp.color]);
  useEffect(
    () => () => {
      topGeometry.dispose();
      skirtGeometry.dispose();
      markGeometry.dispose();
      guideGeometry.dispose();
    },
    [guideGeometry, markGeometry, skirtGeometry, topGeometry],
  );
  return (
    <group>
      <mesh geometry={skirtGeometry}>
        <meshLambertMaterial color={skirtColor} side={DoubleSide} />
      </mesh>
      <mesh geometry={topGeometry}>
        <meshLambertMaterial color={ramp.color} side={DoubleSide} />
      </mesh>
      <lineSegments geometry={markGeometry}>
        <lineBasicMaterial color={ramp.guideColor} transparent opacity={0.42} />
      </lineSegments>
      <mesh geometry={guideGeometry}>
        <meshBasicMaterial
          color={ramp.guideColor}
          transparent
          opacity={0.62}
          depthWrite={false}
          side={DoubleSide}
        />
      </mesh>
    </group>
  );
}

function RouteLine({ course }: { course: SurfCourseDefinition }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    let previousEnd: Point | undefined;
    for (const ramp of course.ramps) {
      const startY = sampleRampSurface(ramp, ramp.centerX, ramp.startZ)!.height + 0.07;
      const endY = sampleRampSurface(ramp, ramp.centerX, ramp.endZ)!.height + 0.07;
      const start: Point = [ramp.centerX, startY, ramp.startZ];
      const end: Point = [ramp.centerX, endY, ramp.endZ];
      positions.push(...start, ...end);
      if (previousEnd) positions.push(...previousEnd, ...start);
      previousEnd = end;
    }
    const value = new BufferGeometry();
    value.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return value;
  }, [course]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={course.accent} transparent opacity={0.76} />
    </lineSegments>
  );
}

function Architecture({ course }: { course: SurfCourseDefinition }) {
  const colors = {
    near: course.structure,
    far: new Color(course.structure).multiplyScalar(0.82),
    accent: course.accent,
  } as const;
  return (
    <group>
      {course.landmarks.map((item) => (
        <mesh key={item.id} position={item.position} scale={item.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshLambertMaterial color={colors[item.tone]} />
        </mesh>
      ))}
    </group>
  );
}

function GoalGate({ course }: { course: SurfCourseDefinition }) {
  const { position, radius } = course.goal;
  return (
    <group position={position}>
      <mesh>
        <torusGeometry args={[radius, 0.22, 8, 48]} />
        <meshBasicMaterial color={course.accent} transparent opacity={0.94} fog={false} />
      </mesh>
      <mesh position={[0, 0, 0.08]}>
        <circleGeometry args={[radius * 0.93, 48]} />
        <meshBasicMaterial color={course.accent} transparent opacity={0.055} depthWrite={false} />
      </mesh>
      <mesh position={[-radius * 1.22, 0, 0.7]} scale={[0.34, radius * 2.6, 0.5]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color={course.structure} />
      </mesh>
      <mesh position={[radius * 1.22, 0, 0.7]} scale={[0.34, radius * 2.6, 0.5]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshLambertMaterial color={course.structure} />
      </mesh>
    </group>
  );
}

function SpeedMarkers({ course }: { course: SurfCourseDefinition }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (let index = 0; index < 72; index += 1) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (15 + ((index * 19) % 17));
      const z = 5 + ((index * 37) % Math.max(10, Math.floor(course.goal.position.z - 8)));
      const y = -8 + ((index * 23) % 31) - z * 0.035;
      positions.push(x, y, z, x, y + 0.16 + (index % 4) * 0.08, z + 0.8);
    }
    const value = new BufferGeometry();
    value.setAttribute('position', new Float32BufferAttribute(positions, 3));
    return value;
  }, [course]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color={course.accent} transparent opacity={0.27} />
    </lineSegments>
  );
}

function makeDynamicLineGeometry(pointCount: number) {
  const geometry = new BufferGeometry();
  const attribute = new Float32BufferAttribute(new Float32Array(pointCount * 3), 3);
  attribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  return geometry;
}

function writeDebugSegment(
  geometry: BufferGeometry,
  origin: Vector3,
  direction: Vector3,
  scale: number,
) {
  const attribute = geometry.getAttribute('position') as Float32BufferAttribute;
  attribute.setXYZ(0, origin.x, origin.y, origin.z);
  attribute.setXYZ(
    1,
    origin.x + direction.x * scale,
    origin.y + direction.y * scale,
    origin.z + direction.z * scale,
  );
  attribute.needsUpdate = true;
}

function writeDebugTrajectory(
  geometry: BufferGeometry,
  position: Vector3,
  velocity: Vector3,
) {
  const attribute = geometry.getAttribute('position') as Float32BufferAttribute;
  const pointAt = (index: number, time: number) => {
    attribute.setXYZ(index, position.x + velocity.x * time,
      position.y + velocity.y * time - 0.5 * SURF_TUNING.gravity * time * time,
      position.z + velocity.z * time);
  };
  for (let segment = 0; segment < attribute.count / 2; segment += 1) {
    pointAt(segment * 2, segment * 0.075);
    pointAt(segment * 2 + 1, (segment + 1) * 0.075);
  }
  attribute.needsUpdate = true;
}

function SurfController({
  course,
  running,
  debug,
  onDebug,
  onReset,
  onComplete,
}: {
  course: SurfCourseDefinition;
  running: boolean;
  debug: boolean;
  onDebug: (stats: SurfDebugStats) => void;
  onReset: (resets: number) => void;
  onComplete: () => void;
}) {
  const player = useRef<SurfPlayerState>(createSurfPlayer(course));
  const scratch = useRef(createSurfSimulationScratch());
  const keys = useRef({ left: false, right: false });
  const look = useRef({ x: 0, y: 0 });
  const accumulator = useRef(0);
  const lastDebug = useRef(0);
  const completed = useRef(false);
  const lastReset = useRef(0);
  const smoothedFps = useRef(60);
  const cameraRoll = useRef(0);
  const lookTarget = useRef(new Vector3());
  const forward = useRef(new Vector3());
  const cameraRight = useRef(new Vector3());
  const velocityGeometry = useMemo(() => makeDynamicLineGeometry(2), []);
  const normalGeometry = useMemo(() => makeDynamicLineGeometry(2), []);
  const trajectoryGeometry = useMemo(() => makeDynamicLineGeometry(46), []);

  useEffect(
    () => () => {
      velocityGeometry.dispose();
      normalGeometry.dispose();
      trajectoryGeometry.dispose();
    },
    [normalGeometry, trajectoryGeometry, velocityGeometry],
  );

  useEffect(() => {
    const clearInput = () => {
      keys.current.left = false;
      keys.current.right = false;
      look.current.x = 0;
      look.current.y = 0;
    };
    const onKey = (event: KeyboardEvent, pressed: boolean) => {
      if (event.code === 'KeyA' || event.code === 'ArrowLeft') {
        keys.current.left = pressed;
        if (running) event.preventDefault();
      }
      if (event.code === 'KeyD' || event.code === 'ArrowRight') {
        keys.current.right = pressed;
        if (running) event.preventDefault();
      }
    };
    const down = (event: KeyboardEvent) => onKey(event, true);
    const up = (event: KeyboardEvent) => onKey(event, false);
    const move = (event: MouseEvent) => {
      if (!document.pointerLockElement || !running) return;
      look.current.x += event.movementX;
      look.current.y += event.movementY;
    };
    const visibility = () => {
      if (document.hidden) clearInput();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clearInput);
    document.addEventListener('mousemove', move);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [running]);

  useEffect(() => {
    if (running) return;
    keys.current.left = false;
    keys.current.right = false;
    look.current.x = 0;
    look.current.y = 0;
    accumulator.current = 0;
  }, [running]);

  useFrame((frameState, delta) => {
    const input: SurfInput = {
      strafe: running ? Number(keys.current.right) - Number(keys.current.left) : 0,
      lookDeltaX: running ? look.current.x : 0,
      lookDeltaY: running ? look.current.y : 0,
    };
    look.current.x = 0;
    look.current.y = 0;

    let simulationSteps = 0;
    if (running || player.current.complete) {
      const advanced = advanceWithFixedSteps(
        player.current,
        input,
        course,
        delta,
        accumulator.current,
        scratch.current,
      );
      player.current = advanced.state;
      accumulator.current = advanced.accumulator;
      simulationSteps = advanced.steps;
    }

    const current = player.current;
    const camera = frameState.camera as PerspectiveCamera;
    camera.position.copy(current.position);
    const cosinePitch = Math.cos(current.pitch);
    forward.current.set(
      Math.sin(current.yaw) * cosinePitch,
      Math.sin(current.pitch),
      Math.cos(current.yaw) * cosinePitch,
    );
    lookTarget.current.copy(current.position).addScaledVector(forward.current, 6.5);
    camera.lookAt(lookTarget.current);

    computeCameraRight(current.yaw, cameraRight.current);
    const lateralSpeed = current.velocity.dot(cameraRight.current);
    const surfaceLean = current.contactNormal.dot(cameraRight.current);
    const targetRoll = Math.max(
      -SURF_TUNING.cameraRollMaximum,
      Math.min(
        SURF_TUNING.cameraRollMaximum,
        -lateralSpeed * SURF_TUNING.cameraRollVelocityScale -
          surfaceLean * SURF_TUNING.cameraRollSurfaceScale,
      ),
    );
    const rollBlend = 1 - Math.exp(-SURF_TUNING.cameraRollResponse * Math.min(delta, 0.05));
    cameraRoll.current += (targetRoll - cameraRoll.current) * rollBlend;
    camera.rotateZ(cameraRoll.current);

    const horizontalSpeed = Math.hypot(current.velocity.x, current.velocity.z);
    const targetFov = Math.min(
      SURF_TUNING.maxFov,
      SURF_TUNING.baseFov +
        Math.max(0, horizontalSpeed - SURF_TUNING.fovStartSpeed) * SURF_TUNING.fovSpeedGain,
    );
    const fovBlend = 1 - Math.exp(-SURF_TUNING.fovResponse * Math.min(delta, 0.05));
    if (Math.abs(camera.fov - targetFov) > 0.015) {
      camera.fov += (targetFov - camera.fov) * fovBlend;
      camera.updateProjectionMatrix();
    }

    if (current.resets !== lastReset.current) {
      lastReset.current = current.resets;
      onReset(current.resets);
    }
    if (current.complete && !completed.current) {
      completed.current = true;
      onComplete();
    }

    smoothedFps.current += ((delta > 0 ? 1 / delta : 60) - smoothedFps.current) * 0.08;
    if (debug && frameState.clock.elapsedTime - lastDebug.current >= SURF_TUNING.debugUpdateInterval) {
      lastDebug.current = frameState.clock.elapsedTime;
      writeDebugSegment(velocityGeometry, current.position, current.velocity, 0.36);
      writeDebugSegment(normalGeometry, current.position, current.contactNormal, 4.2);
      writeDebugTrajectory(trajectoryGeometry, current.position, current.velocity);
      onDebug({
        speed: current.velocity.length(),
        velocity: [current.velocity.x, current.velocity.y, current.velocity.z],
        contactNormal: [current.contactNormal.x, current.contactNormal.y, current.contactNormal.z],
        contactState: current.contactState,
        wishDirection: [current.wishDirection.x, current.wishDirection.y, current.wishDirection.z],
        wishSpeed: current.wishSpeed,
        fps: smoothedFps.current,
        simulationSteps,
        checkpointIndex: current.checkpointIndex,
        resets: current.resets,
      });
    }
  });
  if (!debug) return null;
  return (
    <group>
      <lineSegments geometry={trajectoryGeometry} frustumCulled={false}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.44} depthTest={false} />
      </lineSegments>
      <lineSegments geometry={velocityGeometry} frustumCulled={false}>
        <lineBasicMaterial color="#e9d46f" depthTest={false} />
      </lineSegments>
      <lineSegments geometry={normalGeometry} frustumCulled={false}>
        <lineBasicMaterial color="#a8e3b0" depthTest={false} />
      </lineSegments>
    </group>
  );
}

function SurfDebugPanel({ stats }: { stats: SurfDebugStats }) {
  const vector = (value: readonly [number, number, number]) => value.map((item) => item.toFixed(2)).join('  ');
  return (
    <output className={styles.debug} aria-label="Surf physics debug information">
      <span>speed {stats.speed.toFixed(2)}</span>
      <span>velocity {vector(stats.velocity)}</span>
      <span>contact {stats.contactState} · {vector(stats.contactNormal)}</span>
      <span>wish {stats.wishSpeed.toFixed(1)} · {vector(stats.wishDirection)}</span>
      <span>{stats.fps.toFixed(0)} fps · {stats.simulationSteps} steps</span>
      <span>checkpoint {stats.checkpointIndex + 1} · resets {stats.resets}</span>
      <span>lines velocity · normal · ballistic arc</span>
    </output>
  );
}

class SurfErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    // The calm glide is the intentional no-WebGL recovery path.
  }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
