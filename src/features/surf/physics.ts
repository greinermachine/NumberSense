import { Vector3 } from 'three';
import { SURF_TUNING } from './config';
import type {
  RampDefinition,
  SurfCourseDefinition,
  SurfInput,
  SurfPlayerState,
} from './types';

export type SurfaceSample = {
  ramp: RampDefinition;
  height: number;
  normal: Vector3;
};

type RampPlane = {
  xSlope: number;
  zSlope: number;
  normalX: number;
  normalY: number;
  normalZ: number;
};

export type SurfSimulationScratch = {
  forward: Vector3;
  right: Vector3;
  wish: Vector3;
  previousPosition: Vector3;
  surfaceNormal: Vector3;
  surfaceHeight: number;
};

const rampPlanes = new WeakMap<RampDefinition, RampPlane>();

function getRampPlane(ramp: RampDefinition): RampPlane {
  const cached = rampPlanes.get(ramp);
  if (cached) return cached;

  const zSpan = ramp.endZ - ramp.startZ;
  const zSlope = zSpan === 0 ? 0 : (ramp.endY - ramp.startY) / zSpan;
  const xSlope = Math.tan(ramp.bankRadians);
  const inverseLength = 1 / Math.hypot(xSlope, 1, zSlope);
  const plane = {
    xSlope,
    zSlope,
    normalX: -xSlope * inverseLength,
    normalY: inverseLength,
    normalZ: -zSlope * inverseLength,
  };
  rampPlanes.set(ramp, plane);
  return plane;
}

function heightOnRamp(ramp: RampDefinition, x: number, z: number) {
  const plane = getRampPlane(ramp);
  return (
    ramp.startY +
    plane.zSlope * (z - ramp.startZ) +
    plane.xSlope * (x - ramp.centerX)
  );
}

function isInsideRamp(ramp: RampDefinition, x: number, z: number, forgiveness: number) {
  return (
    z >= ramp.startZ - forgiveness &&
    z <= ramp.endZ + forgiveness &&
    Math.abs(x - ramp.centerX) <= ramp.width / 2 + forgiveness
  );
}

function isFiniteVector(vector: Vector3) {
  return Number.isFinite(vector.x) && Number.isFinite(vector.y) && Number.isFinite(vector.z);
}

export function createSurfSimulationScratch(): SurfSimulationScratch {
  return {
    forward: new Vector3(),
    right: new Vector3(),
    wish: new Vector3(),
    previousPosition: new Vector3(),
    surfaceNormal: new Vector3(),
    surfaceHeight: 0,
  };
}

export function sampleRampSurface(
  ramp: RampDefinition,
  x: number,
  z: number,
  forgiveness = 0,
): SurfaceSample | null {
  if (!isInsideRamp(ramp, x, z, forgiveness)) return null;
  const plane = getRampPlane(ramp);
  return {
    ramp,
    height: heightOnRamp(ramp, x, z),
    normal: new Vector3(plane.normalX, plane.normalY, plane.normalZ),
  };
}

export function findSurface(
  course: SurfCourseDefinition,
  position: Vector3,
): SurfaceSample | null {
  let closest: SurfaceSample | null = null;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const ramp of course.ramps) {
    const sample = sampleRampSurface(
      ramp,
      position.x,
      position.z,
      SURF_TUNING.rampBoundsForgiveness,
    );
    if (!sample) continue;
    const distance = Math.abs(position.y - SURF_TUNING.playerHeight - sample.height);
    if (distance < closestDistance) {
      closest = sample;
      closestDistance = distance;
    }
  }
  return closest;
}

export function computeCameraRight(yaw: number, target = new Vector3()): Vector3 {
  if (!Number.isFinite(yaw)) return target.set(0, 0, 0);

  // The camera looks along +Z at yaw 0, while Three.js cameras look down their
  // local -Z axis. Screen-right is therefore forward x world-up, not the
  // reverse cross product (which points to screen-left).
  return target.set(-Math.cos(yaw), 0, Math.sin(yaw));
}

export function computeWishDirection(
  yaw: number,
  strafe: number,
  target = new Vector3(),
): Vector3 {
  const clampedStrafe = Math.max(-1, Math.min(1, Number.isFinite(strafe) ? strafe : 0));
  if (Math.abs(clampedStrafe) < 0.001 || !Number.isFinite(yaw)) return target.set(0, 0, 0);

  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  computeCameraRight(yaw, target);
  const rightX = target.x;
  const rightZ = target.z;
  return target
    .set(
      rightX * clampedStrafe + forwardX * 0.22,
      0,
      rightZ * clampedStrafe + forwardZ * 0.22,
    )
    .normalize();
}

export function airAccelerate(
  velocity: Vector3,
  wishDirection: Vector3,
  wishSpeed: number,
  acceleration: number,
  maxWishSpeed: number,
  delta: number,
): Vector3 {
  const next = velocity.clone();
  if (
    !isFiniteVector(next) ||
    !isFiniteVector(wishDirection) ||
    wishDirection.lengthSq() < 1e-10 ||
    !Number.isFinite(delta) ||
    delta <= 0
  ) {
    return next;
  }

  const cappedWishSpeed = Math.max(0, Math.min(maxWishSpeed, wishSpeed));
  const currentSpeed = next.dot(wishDirection);
  const addSpeed = cappedWishSpeed - currentSpeed;
  if (addSpeed <= 0) return next;

  const accelerationSpeed = Math.min(
    Math.max(0, acceleration) * cappedWishSpeed * delta,
    addSpeed,
  );
  return next.addScaledVector(wishDirection, accelerationSpeed);
}

export function accelerateToward(
  velocity: Vector3,
  wishDirection: Vector3,
  acceleration: number,
  maxWishSpeed: number,
  delta: number,
): Vector3 {
  return airAccelerate(
    velocity,
    wishDirection.lengthSq() > 0 ? wishDirection.clone().normalize() : wishDirection,
    maxWishSpeed,
    acceleration,
    maxWishSpeed,
    delta,
  );
}

export function clipVelocityAgainstPlane(velocity: Vector3, normal: Vector3): Vector3 {
  const next = velocity.clone();
  if (!isFiniteVector(next) || !isFiniteVector(normal) || normal.lengthSq() < 1e-10) {
    return next;
  }

  const unitNormal = normal.clone().normalize();
  const intoSurface = next.dot(unitNormal);
  if (intoSurface < 0) next.addScaledVector(unitNormal, -intoSurface);

  const remainingIntoSurface = next.dot(unitNormal);
  if (remainingIntoSurface < 0) next.addScaledVector(unitNormal, -remainingIntoSurface);
  return next;
}

export const clipVelocity = clipVelocityAgainstPlane;

export function integrateGravity(velocity: Vector3, gravity: number, delta: number): Vector3 {
  const next = velocity.clone();
  if (!Number.isFinite(gravity) || !Number.isFinite(delta) || delta <= 0) return next;
  next.y -= Math.max(0, gravity) * delta;
  return next;
}

function copyPlayerState(target: SurfPlayerState, source: SurfPlayerState) {
  target.position.copy(source.position);
  target.velocity.copy(source.velocity);
  target.yaw = source.yaw;
  target.pitch = source.pitch;
  target.wishDirection.copy(source.wishDirection);
  target.wishSpeed = source.wishSpeed;
  target.contactNormal.copy(source.contactNormal);
  target.contactState = source.contactState;
  target.contactRampId = source.contactRampId;
  target.contactGraceRemaining = source.contactGraceRemaining;
  target.checkpointIndex = source.checkpointIndex;
  target.landingContactTime = source.landingContactTime;
  target.resets = source.resets;
  target.complete = source.complete;
  target.elapsed = source.elapsed;
}

function clonePlayerState(state: SurfPlayerState): SurfPlayerState {
  return {
    ...state,
    position: state.position.clone(),
    velocity: state.velocity.clone(),
    wishDirection: state.wishDirection.clone(),
    contactNormal: state.contactNormal.clone(),
  };
}

function findRampAtPosition(course: SurfCourseDefinition, position: Vector3) {
  return course.ramps.find((ramp) => isInsideRamp(ramp, position.x, position.z, 0));
}

export function createSurfPlayer(
  course: SurfCourseDefinition,
  resets = 0,
  checkpointIndex = -1,
): SurfPlayerState {
  const safeCheckpointIndex = Math.max(-1, Math.min(course.checkpoints.length - 1, checkpointIndex));
  const checkpoint = safeCheckpointIndex >= 0 ? course.checkpoints[safeCheckpointIndex] : undefined;
  const position = (checkpoint?.position ?? course.spawn.position).clone();
  const yaw = checkpoint?.yaw ?? course.spawn.yaw;
  const speed = checkpoint?.speed ?? course.spawn.speed ?? SURF_TUNING.entrySpeed;
  const velocity = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)).multiplyScalar(speed);
  const ramp = findRampAtPosition(course, position);
  const plane = ramp ? getRampPlane(ramp) : undefined;

  return {
    position,
    velocity,
    yaw,
    pitch: -0.08,
    wishDirection: new Vector3(),
    wishSpeed: 0,
    contactNormal: plane
      ? new Vector3(plane.normalX, plane.normalY, plane.normalZ)
      : new Vector3(),
    contactState: ramp ? 'ramp' : 'air',
    contactRampId: ramp?.id,
    contactGraceRemaining: ramp ? SURF_TUNING.contactGraceTime : 0,
    checkpointIndex: safeCheckpointIndex,
    landingContactTime: 0,
    resets,
    complete: false,
    elapsed: 0,
  };
}

function applyLookInput(state: SurfPlayerState, input: SurfInput) {
  const lookX = Number.isFinite(input.lookDeltaX) ? input.lookDeltaX : 0;
  const lookY = Number.isFinite(input.lookDeltaY) ? input.lookDeltaY : 0;
  state.yaw -= lookX * SURF_TUNING.cameraSensitivity;
  state.pitch = Math.max(
    -SURF_TUNING.cameraPitchLimit,
    Math.min(
      SURF_TUNING.cameraPitchLimit,
      state.pitch - lookY * SURF_TUNING.cameraSensitivity,
    ),
  );
}

function accelerateInPlace(
  velocity: Vector3,
  wishDirection: Vector3,
  wishSpeed: number,
  acceleration: number,
  delta: number,
) {
  if (wishDirection.lengthSq() < 1e-10 || wishSpeed <= 0) return;
  const currentSpeed = velocity.dot(wishDirection);
  const addSpeed = wishSpeed - currentSpeed;
  if (addSpeed <= 0) return;
  const accelerationSpeed = Math.min(acceleration * wishSpeed * delta, addSpeed);
  velocity.addScaledVector(wishDirection, accelerationSpeed);
}

function clipVelocityInPlace(velocity: Vector3, normal: Vector3) {
  const intoSurface = velocity.dot(normal);
  if (intoSurface < 0) velocity.addScaledVector(normal, -intoSurface);
  const remainingIntoSurface = velocity.dot(normal);
  if (remainingIntoSurface < 0) velocity.addScaledVector(normal, -remainingIntoSurface);
}

function findContactCandidate(
  state: SurfPlayerState,
  course: SurfCourseDefinition,
  previousPosition: Vector3,
  delta: number,
  scratch: SurfSimulationScratch,
): RampDefinition | undefined {
  let bestRamp: RampDefinition | undefined;
  let bestHeight = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  let bestNormalX = 0;
  let bestNormalY = 0;
  let bestNormalZ = 0;
  const stepDistance = Math.sqrt(state.velocity.lengthSq()) * delta;
  const penetrationLimit =
    SURF_TUNING.surfacePenetrationTolerance +
    stepDistance +
    SURF_TUNING.surfaceSweepPadding;

  for (const ramp of course.ramps) {
    if (
      !isInsideRamp(
        ramp,
        state.position.x,
        state.position.z,
        SURF_TUNING.rampBoundsForgiveness,
      )
    ) {
      continue;
    }

    const plane = getRampPlane(ramp);
    const height = heightOnRamp(ramp, state.position.x, state.position.z);
    const targetY = height + SURF_TUNING.playerHeight;
    const clearance = state.position.y - targetY;
    if (clearance > SURF_TUNING.surfaceSnapDistance || clearance < -penetrationLimit) continue;

    const previousHeight = heightOnRamp(ramp, previousPosition.x, previousPosition.z);
    const previousClearance =
      previousPosition.y - (previousHeight + SURF_TUNING.playerHeight);
    if (
      previousClearance < -SURF_TUNING.surfacePenetrationTolerance &&
      clearance < 0
    ) {
      continue;
    }

    const separationSpeed =
      state.velocity.x * plane.normalX +
      state.velocity.y * plane.normalY +
      state.velocity.z * plane.normalZ;
    if (separationSpeed > SURF_TUNING.contactSeparationSpeed && clearance > 0) continue;

    const continuityPenalty = ramp.id === state.contactRampId ? 0 : 0.18;
    const score = Math.abs(clearance) + continuityPenalty;
    if (score >= bestScore) continue;
    bestRamp = ramp;
    bestHeight = height;
    bestScore = score;
    bestNormalX = plane.normalX;
    bestNormalY = plane.normalY;
    bestNormalZ = plane.normalZ;
  }

  if (bestRamp) {
    scratch.surfaceHeight = bestHeight;
    scratch.surfaceNormal.set(bestNormalX, bestNormalY, bestNormalZ);
  }
  return bestRamp;
}

function resolveSurfaceContact(
  state: SurfPlayerState,
  course: SurfCourseDefinition,
  previousPosition: Vector3,
  delta: number,
  scratch: SurfSimulationScratch,
) {
  const contact = findContactCandidate(state, course, previousPosition, delta, scratch);
  if (contact) {
    state.position.y = scratch.surfaceHeight + SURF_TUNING.playerHeight;
    clipVelocityInPlace(state.velocity, scratch.surfaceNormal);
    state.contactNormal.copy(scratch.surfaceNormal);
    state.contactState = 'ramp';
    state.contactRampId = contact.id;
    state.contactGraceRemaining = SURF_TUNING.contactGraceTime;
    return;
  }

  const previousRamp = state.contactRampId
    ? course.ramps.find((ramp) => ramp.id === state.contactRampId)
    : undefined;
  if (previousRamp && state.contactGraceRemaining > 0) {
    const withinGraceBounds = isInsideRamp(
      previousRamp,
      state.position.x,
      state.position.z,
      SURF_TUNING.contactGraceBounds,
    );
    if (withinGraceBounds) {
      const height = heightOnRamp(previousRamp, state.position.x, state.position.z);
      const targetY = height + SURF_TUNING.playerHeight;
      const clearance = state.position.y - targetY;
      if (
        clearance <= SURF_TUNING.contactGraceDistance &&
        clearance >= -SURF_TUNING.surfacePenetrationTolerance
      ) {
        const maximumCorrection = SURF_TUNING.contactSnapSpeed * delta;
        const correction = Math.max(
          -maximumCorrection,
          Math.min(maximumCorrection, targetY - state.position.y),
        );
        state.position.y += correction;
        const plane = getRampPlane(previousRamp);
        scratch.surfaceNormal.set(plane.normalX, plane.normalY, plane.normalZ);
        clipVelocityInPlace(state.velocity, scratch.surfaceNormal);
        state.contactNormal.copy(scratch.surfaceNormal);
        state.contactState = 'grace';
        state.contactGraceRemaining = Math.max(0, state.contactGraceRemaining - delta);
        return;
      }
    }
  }

  state.contactState = 'air';
  state.contactNormal.set(0, 0, 0);
  state.contactGraceRemaining = Math.max(0, state.contactGraceRemaining - delta);
  if (state.contactGraceRemaining === 0) state.contactRampId = undefined;
}

function updateCheckpoint(state: SurfPlayerState, course: SurfCourseDefinition) {
  let nextIndex = state.checkpointIndex + 1;
  while (
    nextIndex < course.checkpoints.length &&
    state.position.z >= course.checkpoints[nextIndex].triggerZ &&
    state.contactState !== 'air' &&
    state.contactRampId === course.checkpoints[nextIndex].rampId
  ) {
    state.checkpointIndex = nextIndex;
    nextIndex += 1;
  }
}

function routeReferenceHeight(course: SurfCourseDefinition, position: Vector3) {
  let nearestDistance = Number.POSITIVE_INFINITY;
  let referenceHeight = course.spawn.position.y;
  for (const ramp of course.ramps) {
    const clampedZ = Math.max(ramp.startZ, Math.min(ramp.endZ, position.z));
    const zDistance = Math.abs(clampedZ - position.z);
    if (zDistance >= nearestDistance) continue;
    nearestDistance = zDistance;
    referenceHeight = heightOnRamp(ramp, ramp.centerX, clampedZ) + SURF_TUNING.playerHeight;
  }
  return referenceHeight;
}

function resetPlayerInPlace(state: SurfPlayerState, course: SurfCourseDefinition) {
  const elapsed = state.elapsed;
  const restored = createSurfPlayer(course, state.resets + 1, state.checkpointIndex);
  copyPlayerState(state, restored);
  state.elapsed = elapsed;
}

function stepSurfPlayerInPlace(
  state: SurfPlayerState,
  input: SurfInput,
  course: SurfCourseDefinition,
  delta: number,
  scratch: SurfSimulationScratch,
) {
  if (state.complete) {
    state.position.addScaledVector(state.velocity, delta);
    state.velocity.multiplyScalar(Math.exp(-SURF_TUNING.completionDrag * delta));
    state.elapsed += delta;
    return;
  }

  state.elapsed += delta;
  scratch.previousPosition.copy(state.position);
  computeWishDirection(state.yaw, input.strafe, scratch.wish);
  state.wishDirection.copy(scratch.wish);
  state.wishSpeed = Math.abs(Math.max(-1, Math.min(1, input.strafe))) * SURF_TUNING.maxWishSpeed;

  accelerateInPlace(
    state.velocity,
    scratch.wish,
    state.wishSpeed,
    state.contactState === 'air'
      ? SURF_TUNING.airAcceleration
      : SURF_TUNING.rampAcceleration,
    delta,
  );
  state.velocity.y -= SURF_TUNING.gravity * delta;
  if (state.velocity.lengthSq() > SURF_TUNING.maximumSpeed ** 2) {
    state.velocity.setLength(SURF_TUNING.maximumSpeed);
  }
  state.position.addScaledVector(state.velocity, delta);

  resolveSurfaceContact(state, course, scratch.previousPosition, delta, scratch);
  updateCheckpoint(state, course);

  const settledOnLanding =
    state.contactState === 'ramp' && state.contactRampId === course.goal.rampId;
  if (settledOnLanding) {
    state.landingContactTime += delta;
    state.velocity.multiplyScalar(Math.exp(-SURF_TUNING.landingDrag * delta));
  } else {
    state.landingContactTime = 0;
  }

  const transverseDistance = Math.hypot(
    state.position.x - course.goal.position.x,
    state.position.y - course.goal.position.y,
  );
  if (
    state.position.z >= course.goal.position.z - SURF_TUNING.goalPadding &&
    transverseDistance <= course.goal.radius + SURF_TUNING.goalPadding &&
    settledOnLanding &&
    state.landingContactTime >= SURF_TUNING.minimumLandingContactTime
  ) {
    state.complete = true;
    return;
  }

  const referenceHeight = routeReferenceHeight(course, state.position);
  if (
    !isFiniteVector(state.position) ||
    !isFiniteVector(state.velocity) ||
    state.position.y < SURF_TUNING.resetHeight ||
    state.position.y < referenceHeight - SURF_TUNING.resetDropDistance
  ) {
    resetPlayerInPlace(state, course);
  }
}

export function stepSurfPlayer(
  state: SurfPlayerState,
  input: SurfInput,
  course: SurfCourseDefinition,
  delta: number,
): SurfPlayerState {
  if (state.complete && (!Number.isFinite(delta) || delta <= 0)) return clonePlayerState(state);
  const next = clonePlayerState(state);
  const dt = Math.min(Math.max(Number.isFinite(delta) ? delta : 0, 0), SURF_TUNING.maxFrameDelta);
  applyLookInput(next, input);
  if (dt > 0) stepSurfPlayerInPlace(next, input, course, dt, createSurfSimulationScratch());
  return next;
}

export function advanceWithFixedSteps(
  state: SurfPlayerState,
  input: SurfInput,
  course: SurfCourseDefinition,
  frameDelta: number,
  accumulator: number,
  scratch = createSurfSimulationScratch(),
): { state: SurfPlayerState; accumulator: number; steps: number } {
  applyLookInput(state, input);
  const safeFrameDelta = Math.min(
    Math.max(Number.isFinite(frameDelta) ? frameDelta : 0, 0),
    SURF_TUNING.maxFrameDelta,
  );
  let remaining = Math.min(
    Math.max(0, Number.isFinite(accumulator) ? accumulator : 0) + safeFrameDelta,
    SURF_TUNING.fixedStep * SURF_TUNING.maxSubsteps,
  );
  let steps = 0;
  const stepInput: SurfInput = {
    strafe: Math.max(-1, Math.min(1, Number.isFinite(input.strafe) ? input.strafe : 0)),
    lookDeltaX: 0,
    lookDeltaY: 0,
  };

  while (remaining + 1e-10 >= SURF_TUNING.fixedStep && steps < SURF_TUNING.maxSubsteps) {
    stepSurfPlayerInPlace(state, stepInput, course, SURF_TUNING.fixedStep, scratch);
    remaining -= SURF_TUNING.fixedStep;
    steps += 1;
  }
  if (remaining < 1e-9) remaining = 0;
  return { state, accumulator: remaining, steps };
}
