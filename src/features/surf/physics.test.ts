import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { SURF_TUNING } from './config';
import { getSurfCourse, SURF_COURSES } from './courses';
import {
  advanceWithFixedSteps,
  airAccelerate,
  clipVelocity,
  computeCameraRight,
  computeWishDirection,
  createSurfPlayer,
  integrateGravity,
  sampleRampSurface,
  stepSurfPlayer,
} from './physics';

function rideWithKeyboardSteering(courseIndex: number) {
  const course = getSurfCourse(courseIndex);
  let state = createSurfPlayer(course);
  let accumulator = 0;
  let furthestZ = state.position.z;
  let furthestSample = {
    position: state.position.toArray(),
    velocity: state.velocity.toArray(),
    contactState: state.contactState,
    contactRampId: state.contactRampId,
    resets: state.resets,
  };

  for (let frame = 0; frame < 60 * 20 && !state.complete; frame += 1) {
    const currentIndex = Math.max(
      0,
      course.ramps.findIndex(
        (ramp) => state.position.z <= ramp.endZ + SURF_TUNING.rampBoundsForgiveness,
      ),
    );
    const current = course.ramps[currentIndex] ?? course.ramps.at(-1)!;
    const next = course.ramps[currentIndex + 1];
    const progress = Math.max(
      0,
      Math.min(1, (state.position.z - current.startZ) / (current.endZ - current.startZ)),
    );
    const highSide =
      current.centerX + Math.sign(current.bankRadians) * current.width * 0.22;
    const nextHighSide = next
      ? next.centerX + Math.sign(next.bankRadians) * next.width * 0.2
      : course.goal.position.x;
    const transfer = Math.max(0, Math.min(1, (progress - 0.56) / 0.44));
    const targetX = highSide + (nextHighSide - highSide) * transfer;
    const targetZ = next ? next.startZ + 12 : course.goal.position.z;
    const desiredYaw = Math.atan2(targetX - state.position.x, targetZ - state.position.z);
    const yawError = Math.atan2(
      Math.sin(state.yaw - desiredYaw),
      Math.cos(state.yaw - desiredYaw),
    );
    const lookDeltaX = Math.max(
      -8,
      Math.min(8, yawError / SURF_TUNING.cameraSensitivity),
    );
    const correction = targetX - state.position.x - state.velocity.x * 0.06;
    const cameraRightX = -Math.cos(state.yaw);
    const correctionStrafe = Math.sign(correction * cameraRightX);
    const intoRamp = Math.sign(Math.sign(current.bankRadians) * cameraRightX);
    const strafe =
      Math.abs(correction) > current.width * 0.07 ? correctionStrafe : intoRamp;
    const advanced = advanceWithFixedSteps(
      state,
      { strafe, lookDeltaX, lookDeltaY: 0 },
      course,
      1 / 60,
      accumulator,
    );
    state = advanced.state;
    accumulator = advanced.accumulator;
    if (state.position.z > furthestZ) {
      furthestZ = state.position.z;
      furthestSample = {
        position: state.position.toArray(),
        velocity: state.velocity.toArray(),
        contactState: state.contactState,
        contactRampId: state.contactRampId,
        resets: state.resets,
      };
    }
  }

  return { state, furthestZ, furthestSample };
}

describe('surf physics', () => {
  it('clips only velocity entering a ramp and preserves tangential speed', () => {
    const normal = new Vector3(0, 1, 0);
    const clipped = clipVelocity(new Vector3(4, -8, 12), normal);
    expect(clipped.y).toBeCloseTo(0);
    expect(clipped.x).toBeCloseTo(4);
    expect(clipped.z).toBeCloseTo(12);
  });

  it('derives a normalized banked ramp normal from course data', () => {
    const ramp = getSurfCourse(0).ramps[0];
    const sample = sampleRampSurface(ramp, ramp.centerX, 10);
    expect(sample).not.toBeNull();
    expect(sample!.normal.length()).toBeCloseTo(1);
    expect(sample!.normal.x).not.toBe(0);
  });

  it('uses bounded fixed steps across different display frame rates', () => {
    const course = getSurfCourse(0);
    const simulate = (fps: number) => {
      let state = createSurfPlayer(course);
      let accumulator = 0;
      for (let frame = 0; frame < fps * 2; frame += 1) {
        const advanced = advanceWithFixedSteps(
          state,
          { strafe: 0.25, lookDeltaX: 0, lookDeltaY: 0 },
          course,
          1 / fps,
          accumulator,
        );
        state = advanced.state;
        accumulator = advanced.accumulator;
      }
      return state;
    };
    const at30 = simulate(30);
    const at144 = simulate(144);
    expect(at30.position.distanceTo(at144.position)).toBeLessThan(0.75);
    expect(at30.velocity.distanceTo(at144.velocity)).toBeLessThan(0.5);
  });

  it('resets immediately below the course', () => {
    const course = getSurfCourse(0);
    const state = createSurfPlayer(course);
    state.position.y = SURF_TUNING.resetHeight - 1;
    const next = stepSurfPlayer(
      state,
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );
    expect(next.resets).toBe(1);
    expect(next.position.distanceTo(course.spawn.position)).toBe(0);
  });

  it('requires stable contact with the flat landing before recognizing the goal', () => {
    const course = getSurfCourse(0);
    const airborne = createSurfPlayer(course);
    airborne.position.copy(course.goal.position).add(new Vector3(0, 4, 0));
    airborne.velocity.set(0, 0, 12);
    airborne.contactState = 'air';
    airborne.contactRampId = undefined;
    const crossing = stepSurfPlayer(
      airborne,
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );
    expect(crossing.complete).toBe(false);

    const landed = createSurfPlayer(course);
    landed.position.copy(course.goal.position);
    landed.velocity.set(0, 0, 12);
    landed.contactState = 'ramp';
    landed.contactRampId = course.goal.rampId;
    landed.contactNormal.set(0, 1, 0);
    landed.landingContactTime = SURF_TUNING.minimumLandingContactTime;
    const completed = stepSurfPlayer(
      landed,
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );
    expect(completed.complete).toBe(true);
    expect(completed.contactRampId).toBe(course.goal.rampId);
  });

  it('coasts on a flat landing without bouncing or zeroing momentum', () => {
    const course = getSurfCourse(0);
    const landing = course.ramps.find((ramp) => ramp.id === course.goal.rampId)!;
    const startZ = landing.startZ + 4;
    const surface = sampleRampSurface(landing, landing.centerX, startZ)!;
    let state = createSurfPlayer(course);
    state.position.set(
      landing.centerX,
      surface.height + SURF_TUNING.playerHeight,
      startZ,
    );
    state.velocity.set(0, 0, 18);
    state.contactState = 'ramp';
    state.contactRampId = landing.id;
    state.contactNormal.set(0, 1, 0);

    for (let step = 0; step < 60; step += 1) {
      state = stepSurfPlayer(
        state,
        { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
        course,
        SURF_TUNING.fixedStep,
      );
    }

    expect(state.contactState).toBe('ramp');
    expect(state.contactRampId).toBe(landing.id);
    expect(state.velocity.y).toBeCloseTo(0);
    expect(state.velocity.z).toBeLessThan(18);
    expect(state.velocity.z).toBeGreaterThan(16);
    expect(state.position.z).toBeLessThan(course.goal.position.z);
    expect(state.complete).toBe(false);
  });

  it('maps A/D to visual left/right at yaw zero', () => {
    const cameraRight = computeCameraRight(0);
    const aWish = computeWishDirection(0, -1);
    const dWish = computeWishDirection(0, 1);

    expect(cameraRight.toArray()).toEqual([-1, 0, 0]);
    expect(aWish.x).toBeGreaterThan(0);
    expect(aWish.dot(cameraRight)).toBeLessThan(0);
    expect(dWish.x).toBeLessThan(0);
    expect(dWish.dot(cameraRight)).toBeGreaterThan(0);
  });

  it('keeps A/D camera-relative after yawing ninety degrees', () => {
    const cameraRight = computeCameraRight(Math.PI / 2);
    const aWish = computeWishDirection(Math.PI / 2, -1);
    const dWish = computeWishDirection(Math.PI / 2, 1);

    expect(cameraRight.x).toBeCloseTo(0);
    expect(cameraRight.z).toBeCloseTo(1);
    expect(aWish.z).toBeLessThan(0);
    expect(dWish.z).toBeGreaterThan(0);
  });

  it.each([
    ['left-side rise', getSurfCourse(0).ramps[0], -1, 1],
    ['right-side rise', getSurfCourse(1).ramps[0], 1, -1],
  ] as const)(
    'uses the natural key on a %s and rejects the opposite key',
    (_label, ramp, naturalStrafe, oppositeStrafe) => {
      const uphill = new Vector3(Math.sign(ramp.bankRadians), 0, 0);
      expect(computeWishDirection(0, naturalStrafe).dot(uphill)).toBeGreaterThan(0);
      expect(computeWishDirection(0, oppositeStrafe).dot(uphill)).toBeLessThan(0);
    },
  );

  it('turns A/D input into correctly signed camera-relative lateral velocity', () => {
    const course = getSurfCourse(0);
    const neutral = stepSurfPlayer(
      createSurfPlayer(course),
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );
    const aInput = stepSurfPlayer(
      createSurfPlayer(course),
      { strafe: -1, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );
    const dInput = stepSurfPlayer(
      createSurfPlayer(course),
      { strafe: 1, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );
    expect(aInput.velocity.x).toBeGreaterThan(neutral.velocity.x);
    expect(dInput.velocity.x).toBeLessThan(neutral.velocity.x);
  });

  it('caps air acceleration to the missing speed along wish direction', () => {
    const velocity = new Vector3(8, 0, 11);
    const wish = new Vector3(1, 0, 0);
    const next = airAccelerate(velocity, wish, 17, 6, 17, 1 / 120);
    expect(next.x).toBeGreaterThan(velocity.x);
    expect(next.x).toBeLessThanOrEqual(17);
    expect(next.z).toBe(velocity.z);
  });

  it('keeps zero-length wish and gravity integration finite', () => {
    const wish = computeWishDirection(0, 0);
    const accelerated = airAccelerate(new Vector3(4, 2, 8), wish, 17, 6, 17, 1 / 120);
    const falling = integrateGravity(accelerated, SURF_TUNING.gravity, 1 / 120);
    expect(wish.toArray()).toEqual([0, 0, 0]);
    expect(falling.toArray().every(Number.isFinite)).toBe(true);
  });

  it('applies one mouse delta once even when a frame consumes several substeps', () => {
    const course = getSurfCourse(0);
    const state = createSurfPlayer(course);
    const startYaw = state.yaw;
    const advanced = advanceWithFixedSteps(
      state,
      { strafe: 0, lookDeltaX: 20, lookDeltaY: 0 },
      course,
      1 / 30,
      0,
    );
    expect(advanced.steps).toBe(4);
    expect(advanced.state.yaw).toBeCloseTo(
      startYaw - 20 * SURF_TUNING.cameraSensitivity,
    );
  });

  it.each([0, 1])(
    'keeps left/right mouse look under player control on course %i entry',
    (courseIndex) => {
      const course = getSurfCourse(courseIndex);
      const state = createSurfPlayer(course);
      const startYaw = state.yaw;
      const startPitch = state.pitch;
      const mouseRight = advanceWithFixedSteps(
        state,
        { strafe: courseIndex === 0 ? -1 : 1, lookDeltaX: 24, lookDeltaY: 15 },
        course,
        1 / 60,
        0,
      );

      expect(mouseRight.state.yaw).toBeCloseTo(
        startYaw - 24 * SURF_TUNING.cameraSensitivity,
      );
      expect(mouseRight.state.pitch).toBeCloseTo(
        startPitch - 15 * SURF_TUNING.cameraSensitivity,
      );

      const yawAfterRight = mouseRight.state.yaw;
      const pitchAfterRight = mouseRight.state.pitch;
      const mouseLeft = advanceWithFixedSteps(
        mouseRight.state,
        { strafe: courseIndex === 0 ? -1 : 1, lookDeltaX: -31, lookDeltaY: -9 },
        course,
        1 / 60,
        mouseRight.accumulator,
      );
      expect(mouseLeft.state.yaw).toBeCloseTo(
        yawAfterRight + 31 * SURF_TUNING.cameraSensitivity,
      );
      expect(mouseLeft.state.pitch).toBeCloseTo(
        pitchAfterRight + 9 * SURF_TUNING.cameraSensitivity,
      );
    },
  );

  it('does not steer yaw or pitch from velocity, ramp contact, or strafe', () => {
    const course = getSurfCourse(0);
    let state = createSurfPlayer(course);
    state.yaw = 0.31;
    state.pitch = 0.12;
    state.velocity.set(-5, 0, 17);
    let accumulator = 0;

    for (let frame = 0; frame < 12; frame += 1) {
      const advanced = advanceWithFixedSteps(
        state,
        { strafe: -1, lookDeltaX: 0, lookDeltaY: 0 },
        course,
        1 / 60,
        accumulator,
      );
      state = advanced.state;
      accumulator = advanced.accumulator;
    }

    expect(state.yaw).toBeCloseTo(0.31);
    expect(state.pitch).toBeCloseTo(0.12);
  });

  it('applies mouse yaw and pitch continuously while airborne', () => {
    const course = getSurfCourse(0);
    const state = createSurfPlayer(course);
    state.position.y += 8;
    state.velocity.set(2, 1, 16);
    state.contactState = 'air';
    state.contactRampId = undefined;
    state.contactNormal.set(0, 0, 0);
    const startYaw = state.yaw;
    const startPitch = state.pitch;

    const advanced = advanceWithFixedSteps(
      state,
      { strafe: 1, lookDeltaX: 18, lookDeltaY: -12 },
      course,
      1 / 60,
      0,
    );

    expect(advanced.state.yaw).toBeCloseTo(
      startYaw - 18 * SURF_TUNING.cameraSensitivity,
    );
    expect(advanced.state.pitch).toBeCloseTo(
      startPitch + 12 * SURF_TUNING.cameraSensitivity,
    );
    expect(advanced.state.contactState).toBe('air');
  });

  it('bounds suspended-tab catch-up work and leftover time', () => {
    const course = getSurfCourse(0);
    const advanced = advanceWithFixedSteps(
      createSurfPlayer(course),
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      8,
      8,
    );
    expect(advanced.steps).toBe(SURF_TUNING.maxSubsteps);
    expect(advanced.accumulator).toBeLessThan(SURF_TUNING.fixedStep);
  });

  it('recovers a finite checkpoint state from invalid simulation values', () => {
    const course = getSurfCourse(1);
    const state = createSurfPlayer(course);
    state.position.set(Number.NaN, Number.NEGATIVE_INFINITY, 80);
    const next = stepSurfPlayer(
      state,
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );
    expect(next.position.toArray().every(Number.isFinite)).toBe(true);
    expect(next.velocity.toArray().every(Number.isFinite)).toBe(true);
    expect(next.resets).toBe(1);
  });

  it('uses short grace contact across a ramp seam', () => {
    const course = getSurfCourse(0);
    const ramp = course.ramps[0];
    const state = createSurfPlayer(course);
    const z = ramp.endZ + 0.42;
    const surface = sampleRampSurface(ramp, ramp.centerX, z, 1)!;
    state.position.set(ramp.centerX, surface.height + SURF_TUNING.playerHeight, z);
    state.velocity.set(0, 0, 16);
    state.contactRampId = ramp.id;
    state.contactState = 'ramp';
    state.contactNormal.copy(surface.normal);

    const next = stepSurfPlayer(
      state,
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );

    expect(next.contactState).toBe('grace');
    expect(next.contactRampId).toBe(ramp.id);
    expect(next.contactGraceRemaining).toBeGreaterThan(0);
  });

  it('restores the latest checkpoint after a fall', () => {
    const course = getSurfCourse(1);
    const checkpoint = course.checkpoints[0];
    const state = createSurfPlayer(course, 0, 0);
    state.position.y = SURF_TUNING.resetHeight - 1;

    const next = stepSurfPlayer(
      state,
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );

    expect(next.position.distanceTo(checkpoint.position)).toBe(0);
    expect(next.checkpointIndex).toBe(0);
    expect(next.resets).toBe(1);
  });

  it('activates a checkpoint only after contact with its ramp', () => {
    const course = getSurfCourse(1);
    const checkpoint = course.checkpoints[0];
    const ramp = course.ramps.find((item) => item.id === checkpoint.rampId)!;
    const surface = sampleRampSurface(ramp, checkpoint.position.x, checkpoint.triggerZ)!;
    const airborne = createSurfPlayer(course);
    airborne.position.set(
      checkpoint.position.x,
      surface.height + SURF_TUNING.playerHeight + 8,
      checkpoint.triggerZ,
    );
    airborne.velocity.set(0, 0, 0);
    airborne.contactState = 'air';
    airborne.contactRampId = undefined;

    const stillAirborne = stepSurfPlayer(
      airborne,
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );
    expect(stillAirborne.checkpointIndex).toBe(-1);

    const riding = createSurfPlayer(course);
    riding.position.set(
      checkpoint.position.x,
      surface.height + SURF_TUNING.playerHeight,
      checkpoint.triggerZ,
    );
    riding.velocity.set(0, 0, 12);
    riding.contactState = 'ramp';
    riding.contactRampId = ramp.id;
    riding.contactNormal.copy(surface.normal);
    const activated = stepSurfPlayer(
      riding,
      { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
      course,
      SURF_TUNING.fixedStep,
    );
    expect(activated.checkpointIndex).toBe(0);
  });

  it.each([0, 1, 2])('does not complete course %i without player input', (courseIndex) => {
    const course = getSurfCourse(courseIndex);
    let state = createSurfPlayer(course);
    let accumulator = 0;
    for (let frame = 0; frame < 60 * 12; frame += 1) {
      const advanced = advanceWithFixedSteps(
        state,
        { strafe: 0, lookDeltaX: 0, lookDeltaY: 0 },
        course,
        1 / 60,
        accumulator,
      );
      state = advanced.state;
      accumulator = advanced.accumulator;
    }
    expect(state.complete).toBe(false);
  });

  it.each(SURF_COURSES.map((course, index) => [index, course.id] as const))(
    'keeps course %i (%s) reachable with keyboard-like steering',
    (courseIndex) => {
      const { state, furthestZ, furthestSample } = rideWithKeyboardSteering(courseIndex);
      const diagnostics = JSON.stringify({ furthestSample, final: {
        position: state.position.toArray(),
        velocity: state.velocity.toArray(),
        contactState: state.contactState,
        contactRampId: state.contactRampId,
        landingContactTime: state.landingContactTime,
        resets: state.resets,
      } });
      expect(furthestZ, diagnostics).toBeGreaterThan(
        getSurfCourse(courseIndex).goal.position.z - 8,
      );
      expect(state.complete).toBe(true);
      expect(state.resets).toBe(0);
      expect(state.elapsed).toBeLessThanOrEqual(20);
      expect(state.contactState).toBe('ramp');
      expect(state.contactRampId).toBe(getSurfCourse(courseIndex).goal.rampId);
      expect(state.landingContactTime).toBeGreaterThanOrEqual(
        SURF_TUNING.minimumLandingContactTime,
      );
    },
  );

  it('makes the same steering harness spend progressively longer on each line', () => {
    const outcomes = SURF_COURSES.map((_course, index) => rideWithKeyboardSteering(index));
    const elapsed = outcomes.map(({ state }) => state.elapsed);
    const diagnostics = JSON.stringify(elapsed.map((time) => Number(time.toFixed(2))));
    expect(elapsed[0], diagnostics).toBeLessThan(elapsed[1]);
    expect(elapsed[1], diagnostics).toBeLessThan(elapsed[2]);
    expect(outcomes.every(({ state }) => state.complete && state.resets === 0)).toBe(true);
  });
});
