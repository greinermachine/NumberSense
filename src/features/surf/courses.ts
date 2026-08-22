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
): RampDefinition => ({
  id,
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

const nearA = ramp('near-a', -8, 50, -3, 26, 8, 0, 0.5, '#58665a', '#d8e1c4');
const nearB = ramp('near-b', 56, 112, 4, 28, -3.2, -11.2, -0.48, '#687365', '#e3e7d0');
const nearC = ramp('near-c', 119, 174, -2, 30, -14.5, -20.5, 0.44, '#4e5e52', '#d7dfbd');

const foldedA = ramp('fold-a', -8, 48, 4, 24, 9, 1, -0.56, '#6c6657', '#eadfbf');
const foldedB = ramp('fold-b', 58, 112, -5, 24, -0.7, -8.7, 0.56, '#7a715f', '#f1ddb3');
const foldedC = ramp('fold-c', 122, 176, 6, 25, -9, -17, -0.57, '#5d594f', '#e5d5b2');
const foldedD = ramp('fold-d', 184, 216, 0, 30, -20.4, -22.4, 0.24, '#827963', '#f2dfb8');

const openA = ramp('open-a', -8, 48, -5, 23, 11, 2, 0.62, '#486462', '#c8e4df');
const openB = ramp('open-b', 60, 116, 7, 24, 1, -9, -0.64, '#58736f', '#cbe7e2');
const openC = ramp('open-c', 130, 184, -8, 23, -10, -20, 0.64, '#405b59', '#b9dcda');
const openD = ramp('open-d', 197, 244, 5, 27, -21, -26, -0.52, '#647d79', '#c9e5e1');

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
    spawn: { position: eyePosition(nearA, 3, -1), yaw: 0, speed: 16 },
    ramps: [nearA, nearB, nearC],
    checkpoints: [checkpoint('near-middle', 74, nearB, -4, 64, 0.04, 17)],
    landmarks: [
      landmark('near-left-1', -24, 1, 27, 2.6, 27, 3.4, 'near'),
      landmark('near-right-1', 24, -1, 78, 2.4, 24, 3.4, 'far'),
      landmark('near-left-2', -26, -8, 132, 3.2, 25, 3.8, 'far'),
      landmark('near-right-2', 25, -10, 164, 2.2, 20, 3, 'accent'),
    ],
    goal: { position: new Vector3(-2, -18, 169), radius: 5.8 },
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
    spawn: { position: eyePosition(foldedA, -2, -1), yaw: 0, speed: 16.5 },
    ramps: [foldedA, foldedB, foldedC, foldedD],
    checkpoints: [
      checkpoint('folded-middle', 76, foldedB, 1, 66, -0.03, 18),
      checkpoint('folded-late', 143, foldedC, 0, 130, 0.04, 19),
    ],
    landmarks: [
      landmark('fold-left-1', -23, 2, 23, 2.8, 30, 3.8, 'far'),
      landmark('fold-right-1', 25, -3, 84, 3, 26, 3.2, 'near'),
      landmark('fold-left-2', -27, -10, 145, 2.4, 25, 4, 'accent'),
      landmark('fold-right-2', 27, -14, 197, 3.4, 22, 3.5, 'far'),
    ],
    goal: { position: new Vector3(0, -20.5, 211), radius: 6.1 },
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
    spawn: { position: eyePosition(openA, 1, -1), yaw: 0, speed: 17 },
    ramps: [openA, openB, openC, openD],
    checkpoints: [
      checkpoint('open-middle', 78, openB, 1, 68, -0.04, 18.5),
      checkpoint('open-late', 150, openC, -2, 138, 0.05, 20),
    ],
    landmarks: [
      landmark('open-left-1', -25, 4, 25, 2.4, 34, 3.2, 'near'),
      landmark('open-right-1', 27, -2, 89, 3.2, 30, 4, 'accent'),
      landmark('open-left-2', -29, -13, 157, 3.4, 27, 4, 'far'),
      landmark('open-right-2', 30, -18, 220, 2.6, 24, 3.5, 'near'),
    ],
    goal: { position: new Vector3(5, -23.8, 239), radius: 6.3 },
  },
] as const;

export function getSurfCourse(index: number): SurfCourseDefinition {
  return SURF_COURSES[index % SURF_COURSES.length];
}
