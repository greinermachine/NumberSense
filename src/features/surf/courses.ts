import { Vector3 } from 'three';
import { SURF_TUNING } from './config';
import type {
  RampDefinition,
  SurfCheckpoint,
  SurfCourseDefinition,
  SurfLandmark,
} from './types';

const ramp = (
  id: string,
  startZ: number,
  endZ: number,
  centerX: number,
  width: number,
  startY: number,
  endY: number,
  bankRadians: number,
  color: string,
  guideColor: string,
  kind: RampDefinition['kind'] = 'bank',
): RampDefinition => ({
  id,
  kind,
  startZ,
  endZ,
  centerX,
  width,
  startY,
  endY,
  bankRadians,
  color,
  guideColor,
});

const landing = (
  id: string,
  startZ: number,
  endZ: number,
  centerX: number,
  width: number,
  height: number,
  color: string,
  guideColor: string,
) => ramp(
  id,
  startZ,
  endZ,
  centerX,
  width,
  height,
  height,
  0,
  color,
  guideColor,
  'landing',
);

const surfaceHeight = (definition: RampDefinition, x: number, z: number) => {
  const zSlope = (definition.endY - definition.startY) / (definition.endZ - definition.startZ);
  return (
    definition.startY +
    zSlope * (z - definition.startZ) +
    Math.tan(definition.bankRadians) * (x - definition.centerX)
  );
};

const eyePosition = (definition: RampDefinition, x: number, z: number) =>
  new Vector3(x, surfaceHeight(definition, x, z) + SURF_TUNING.playerHeight, z);

const checkpoint = (
  id: string,
  triggerZ: number,
  definition: RampDefinition,
  x: number,
  z: number,
  yaw: number,
  speed: number,
): SurfCheckpoint => ({
  id,
  rampId: definition.id,
  triggerZ,
  position: eyePosition(definition, x, z),
  yaw,
  speed,
});

const landmark = (
  id: string,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number,
  depth: number,
  tone: SurfLandmark['tone'],
): SurfLandmark => ({
  id,
  position: new Vector3(x, y, z),
  scale: new Vector3(width, height, depth),
  tone,
});

// Stage I teaches one readable A-side language on two broad banks, then gives
// the rider a long, generous flat runway before the goal.
const nearA = ramp('near-a', -8, 50, -3, 30, 8, 0, 0.38, '#58665a', '#d8e1c4');
const nearB = ramp('near-b', 56, 112, 4, 31, -2.8, -10.8, 0.34, '#687365', '#e3e7d0');
const nearLanding = landing(
  'near-landing', 122, 178, 1, 38, -15, '#667064', '#edf0d8',
);

// Stage II introduces the opposite bank and asks for two clear transfers,
// while keeping broad catches and a substantial exit runway.
const foldedA = ramp('fold-a', -8, 50, 4, 26, 9, 1, -0.48, '#6c6657', '#eadfbf');
const foldedB = ramp('fold-b', 60, 116, -5, 25, -0.8, -8.8, 0.5, '#7a715f', '#f1ddb3');
const foldedC = ramp('fold-c', 126, 180, 6, 24, -9.4, -17.4, -0.53, '#5d594f', '#e5d5b2');
const foldedLanding = landing(
  'fold-landing', 192, 240, 1, 32, -19.4, '#817967', '#f6e6c4',
);

// Stage III alternates both orientations across the longest, fastest line.
// Gaps grow deliberately, but collision forgiveness and input response do not.
const openA = ramp('open-a', -8, 48, -5, 24, 11, 2, 0.6, '#486462', '#c8e4df');
const openB = ramp('open-b', 60, 116, 7, 23, 1, -9, -0.61, '#58736f', '#cbe7e2');
const openC = ramp('open-c', 130, 184, -8, 22, -10, -20, 0.62, '#405b59', '#b9dcda');
const openD = ramp('open-d', 197, 244, 5, 22, -21, -26, -0.55, '#647d79', '#c9e5e1');
const openLanding = landing(
  'open-landing', 260, 314, 0, 29, -29.5, '#5f7773', '#d7efeb',
);

export const SURF_COURSES: readonly SurfCourseDefinition[] = [
  {
    id: 'near-line',
    name: 'The near line',
    stageLabel: 'I / III',
    cue: 'Hold A into the first face.',
    sky: '#e5e4da',
    fog: '#d7d8cb',
    floor: '#35403a',
    structure: '#9ba298',
    accent: '#dce8b1',
    spawn: { position: eyePosition(nearA, 1, -1), yaw: 0, speed: 15.5 },
    ramps: [nearA, nearB, nearLanding],
    checkpoints: [checkpoint('near-middle', 74, nearB, 7, 66, 0.02, 16.5)],
    landmarks: [
      landmark('near-left-1', -24, 1, 27, 2.6, 27, 3.4, 'near'),
      landmark('near-right-1', 24, -1, 78, 2.4, 24, 3.4, 'far'),
      landmark('near-left-2', -26, -7, 130, 3.2, 25, 3.8, 'far'),
      landmark('near-right-2', 25, -8, 164, 2.2, 20, 3, 'accent'),
    ],
    completionDelayMs: 700,
    goal: {
      rampId: nearLanding.id,
      position: eyePosition(nearLanding, 1, 161),
      radius: 7.2,
    },
  },
  {
    id: 'folded-line',
    name: 'The folded line',
    stageLabel: 'II / III',
    cue: 'Hold D into the first face.',
    sky: '#e6e0d4',
    fog: '#d8cfbd',
    floor: '#3d3931',
    structure: '#aaa08a',
    accent: '#f0d59c',
    spawn: { position: eyePosition(foldedA, -2, -1), yaw: 0, speed: 17 },
    ramps: [foldedA, foldedB, foldedC, foldedLanding],
    checkpoints: [
      checkpoint('folded-middle', 76, foldedB, 1, 66, -0.03, 18),
      checkpoint('folded-late', 146, foldedC, 0, 136, 0.04, 19.5),
    ],
    landmarks: [
      landmark('fold-left-1', -23, 2, 23, 2.8, 30, 3.8, 'far'),
      landmark('fold-right-1', 25, -3, 84, 3, 26, 3.2, 'near'),
      landmark('fold-left-2', -27, -10, 145, 2.4, 25, 4, 'accent'),
      landmark('fold-right-2', 27, -13, 211, 3.4, 22, 3.5, 'far'),
    ],
    completionDelayMs: 760,
    goal: {
      rampId: foldedLanding.id,
      position: eyePosition(foldedLanding, 1, 224),
      radius: 6.2,
    },
  },
  {
    id: 'open-line',
    name: 'The open line',
    stageLabel: 'III / III',
    cue: 'Hold A. Let the gap come to you.',
    sky: '#dde7e4',
    fog: '#cbd9d6',
    floor: '#2e3b39',
    structure: '#8ea6a1',
    accent: '#bde1df',
    spawn: { position: eyePosition(openA, 1, -1), yaw: 0, speed: 18.5 },
    ramps: [openA, openB, openC, openD, openLanding],
    checkpoints: [
      checkpoint('open-middle', 78, openB, 1, 68, -0.04, 18.5),
      checkpoint('open-late', 150, openC, -2, 138, 0.05, 20),
    ],
    landmarks: [
      landmark('open-left-1', -25, 4, 25, 2.4, 34, 3.2, 'near'),
      landmark('open-right-1', 27, -2, 89, 3.2, 30, 4, 'accent'),
      landmark('open-left-2', -29, -13, 157, 3.4, 27, 4, 'far'),
      landmark('open-right-2', 30, -19, 231, 2.6, 24, 3.5, 'near'),
      landmark('open-landing-frame', -23, -19, 286, 2.2, 22, 3.4, 'accent'),
    ],
    completionDelayMs: 900,
    goal: {
      rampId: openLanding.id,
      position: eyePosition(openLanding, 0, 296),
      radius: 5.4,
    },
  },
] as const;

export function getSurfCourse(index: number): SurfCourseDefinition {
  return SURF_COURSES[index % SURF_COURSES.length];
}
