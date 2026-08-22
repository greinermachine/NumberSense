import type { Vector3 } from 'three';

export type SurfContactState = 'air' | 'grace' | 'ramp';

export type RampDefinition = {
  id: string;
  startZ: number;
  endZ: number;
  centerX: number;
  width: number;
  startY: number;
  endY: number;
  bankRadians: number;
  color: string;
  guideColor: string;
};

export type SurfCheckpoint = {
  id: string;
  rampId: string;
  triggerZ: number;
  position: Vector3;
  yaw: number;
  speed: number;
};

export type SurfLandmark = {
  id: string;
  position: Vector3;
  scale: Vector3;
  tone: 'near' | 'far' | 'accent';
};

export type SurfCourseDefinition = {
  id: string;
  name: string;
  stageLabel: string;
  cue: string;
  sky: string;
  fog: string;
  floor: string;
  structure: string;
  accent: string;
  spawn: {
    position: Vector3;
    yaw: number;
    speed: number;
  };
  ramps: readonly RampDefinition[];
  checkpoints: readonly SurfCheckpoint[];
  landmarks: readonly SurfLandmark[];
  goal: {
    position: Vector3;
    radius: number;
  };
};

export type SurfPlayerState = {
  position: Vector3;
  velocity: Vector3;
  yaw: number;
  pitch: number;
  wishDirection: Vector3;
  wishSpeed: number;
  contactNormal: Vector3;
  contactState: SurfContactState;
  contactRampId?: string;
  contactGraceRemaining: number;
  checkpointIndex: number;
  resets: number;
  complete: boolean;
  elapsed: number;
};

export type SurfInput = {
  strafe: number;
  lookDeltaX: number;
  lookDeltaY: number;
};

export type SurfDebugStats = {
  speed: number;
  velocity: readonly [number, number, number];
  contactNormal: readonly [number, number, number];
  contactState: SurfContactState;
  wishDirection: readonly [number, number, number];
  wishSpeed: number;
  fps: number;
  simulationSteps: number;
  checkpointIndex: number;
  resets: number;
};
