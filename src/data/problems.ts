import type { ProblemDefinition } from './types';

export const PROBLEM_BANK: readonly ProblemDefinition[] = [
  {
    id: '24x11', left: 24, right: 11, tier: 'warm',
    hint: { side: 'right', text: 'Look at 11. What sits just beside ten?' },
    teachingViews: [
      { side: 'right', left: 10, operator: '+', right: 1, rationaleTag: 'nearby-round-number' },
      { side: 'left', left: 20, operator: '+', right: 4, rationaleTag: 'split-place-value' },
      { side: 'left', left: 6, operator: '*', right: 4, rationaleTag: 'factor-rearrangement' },
    ],
  },
  {
    id: '25x12', left: 25, right: 12, tier: 'warm',
    hint: { side: 'right', text: 'Twelve can open into a friendly product.' },
    teachingViews: [
      { side: 'right', left: 10, operator: '+', right: 2, rationaleTag: 'split-place-value' },
      { side: 'right', left: 4, operator: '*', right: 3, rationaleTag: 'friendly-product' },
      { side: 'left', left: 20, operator: '+', right: 5, rationaleTag: 'split-place-value' },
    ],
  },
  {
    id: '32x15', left: 32, right: 15, tier: 'warm',
    hint: { side: 'right', text: 'Could 15 split into two familiar pieces?' },
    teachingViews: [
      { side: 'right', left: 10, operator: '+', right: 5, rationaleTag: 'split-place-value' },
      { side: 'left', left: 30, operator: '+', right: 2, rationaleTag: 'split-place-value' },
      { side: 'left', left: 4, operator: '*', right: 8, rationaleTag: 'factor-rearrangement' },
    ],
  },
  {
    id: '58x11', left: 58, right: 11, tier: 'warm',
    hint: { side: 'right', text: 'Look just beyond ten.' },
    teachingViews: [
      { side: 'right', left: 10, operator: '+', right: 1, rationaleTag: 'nearby-round-number' },
      { side: 'left', left: 60, operator: '-', right: 2, rationaleTag: 'nearby-round-number' },
      { side: 'left', left: 50, operator: '+', right: 8, rationaleTag: 'split-place-value' },
    ],
  },
  {
    id: '36x12', left: 36, right: 12, tier: 'warm',
    hint: { side: 'right', text: 'Twelve has a useful relationship with ten.' },
    teachingViews: [
      { side: 'right', left: 10, operator: '+', right: 2, rationaleTag: 'split-place-value' },
      { side: 'left', left: 6, operator: '*', right: 6, rationaleTag: 'factor-rearrangement' },
      { side: 'left', left: 40, operator: '-', right: 4, rationaleTag: 'nearby-round-number' },
    ],
  },
  {
    id: '25x18', left: 25, right: 18, tier: 'warm',
    hint: { side: 'right', text: 'Is 18 close to a round number?' },
    teachingViews: [
      { side: 'right', left: 20, operator: '-', right: 2, rationaleTag: 'nearby-round-number' },
      { side: 'left', left: 20, operator: '+', right: 5, rationaleTag: 'split-place-value' },
      { side: 'right', left: 9, operator: '*', right: 2, rationaleTag: 'double-half' },
    ],
  },
  {
    id: '42x9', left: 42, right: 9, tier: 'warm',
    hint: { side: 'right', text: 'What friendly number is one step from 9?' },
    teachingViews: [
      { side: 'right', left: 10, operator: '-', right: 1, rationaleTag: 'nearby-round-number' },
      { side: 'left', left: 40, operator: '+', right: 2, rationaleTag: 'split-place-value' },
      { side: 'left', left: 6, operator: '*', right: 7, rationaleTag: 'factor-rearrangement' },
    ],
  },
  {
    id: '39x12', left: 39, right: 12, tier: 'explore',
    hint: { side: 'left', text: 'Look at 39. Is a round number nearby?' },
    teachingViews: [
      { side: 'left', left: 40, operator: '-', right: 1, rationaleTag: 'nearby-round-number' },
      { side: 'right', left: 10, operator: '+', right: 2, rationaleTag: 'split-place-value' },
      { side: 'left', left: 30, operator: '+', right: 9, rationaleTag: 'split-place-value' },
    ],
  },
  {
    id: '47x18', left: 47, right: 18, tier: 'explore',
    hint: { side: 'right', text: 'Try looking just beyond 18.' },
    teachingViews: [
      { side: 'right', left: 20, operator: '-', right: 2, rationaleTag: 'nearby-round-number' },
      { side: 'left', left: 50, operator: '-', right: 3, rationaleTag: 'nearby-round-number' },
      { side: 'right', left: 9, operator: '*', right: 2, rationaleTag: 'double-half' },
    ],
  },
  {
    id: '51x14', left: 51, right: 14, tier: 'explore',
    hint: { side: 'left', text: 'What sits one step away from 51?' },
    teachingViews: [
      { side: 'left', left: 50, operator: '+', right: 1, rationaleTag: 'nearby-round-number' },
      { side: 'right', left: 10, operator: '+', right: 4, rationaleTag: 'split-place-value' },
      { side: 'right', left: 7, operator: '*', right: 2, rationaleTag: 'double-half' },
    ],
  },
  {
    id: '64x15', left: 64, right: 15, tier: 'explore',
    hint: { side: 'right', text: 'Could 15 be ten and something more?' },
    teachingViews: [
      { side: 'right', left: 10, operator: '+', right: 5, rationaleTag: 'split-place-value' },
      { side: 'left', left: 8, operator: '*', right: 8, rationaleTag: 'factor-rearrangement' },
      { side: 'left', left: 60, operator: '+', right: 4, rationaleTag: 'split-place-value' },
    ],
  },
  {
    id: '75x16', left: 75, right: 16, tier: 'explore',
    hint: { side: 'left', text: 'Seventy-five can be split into familiar quarters.' },
    teachingViews: [
      { side: 'left', left: 50, operator: '+', right: 25, rationaleTag: 'friendly-product' },
      { side: 'right', left: 8, operator: '*', right: 2, rationaleTag: 'double-half' },
      { side: 'left', left: 100, operator: '-', right: 25, rationaleTag: 'friendly-product' },
    ],
  },
  {
    id: '54x19', left: 54, right: 19, tier: 'explore',
    hint: { side: 'right', text: 'What round number is one away from 19?' },
    teachingViews: [
      { side: 'right', left: 20, operator: '-', right: 1, rationaleTag: 'nearby-round-number' },
      { side: 'left', left: 50, operator: '+', right: 4, rationaleTag: 'split-place-value' },
      { side: 'left', left: 6, operator: '*', right: 9, rationaleTag: 'factor-rearrangement' },
    ],
  },
  {
    id: '48x19', left: 48, right: 19, tier: 'puzzle',
    hint: { side: 'right', text: 'Look at 19. Is there a nearby round number?' },
    teachingViews: [
      { side: 'right', left: 20, operator: '-', right: 1, rationaleTag: 'nearby-round-number' },
      { side: 'right', left: 10, operator: '+', right: 9, rationaleTag: 'split-place-value' },
      { side: 'left', left: 50, operator: '-', right: 2, rationaleTag: 'nearby-round-number' },
    ],
  },
  {
    id: '49x16', left: 49, right: 16, tier: 'puzzle',
    hint: { side: 'left', text: '49 has a shape beyond its nearest round number.' },
    teachingViews: [
      { side: 'left', left: 50, operator: '-', right: 1, rationaleTag: 'nearby-round-number' },
      { side: 'left', left: 40, operator: '+', right: 9, rationaleTag: 'split-place-value' },
      { side: 'left', left: 7, operator: '*', right: 7, rationaleTag: 'factor-rearrangement' },
    ],
  },
  {
    id: '98x12', left: 98, right: 12, tier: 'puzzle',
    hint: { side: 'left', text: 'What round number is very close to 98?' },
    teachingViews: [
      { side: 'left', left: 100, operator: '-', right: 2, rationaleTag: 'nearby-round-number' },
      { side: 'right', left: 10, operator: '+', right: 2, rationaleTag: 'split-place-value' },
      { side: 'left', left: 49, operator: '*', right: 2, rationaleTag: 'double-half' },
    ],
  },
  {
    id: '99x17', left: 99, right: 17, tier: 'puzzle',
    hint: { side: 'left', text: 'One small step changes 99 completely.' },
    teachingViews: [
      { side: 'left', left: 100, operator: '-', right: 1, rationaleTag: 'nearby-round-number' },
      { side: 'right', left: 10, operator: '+', right: 7, rationaleTag: 'split-place-value' },
      { side: 'left', left: 90, operator: '+', right: 9, rationaleTag: 'split-place-value' },
    ],
  },
  {
    id: '63x24', left: 63, right: 24, tier: 'puzzle',
    hint: { side: 'left', text: 'Can 63 be made from equal factors?' },
    teachingViews: [
      { side: 'left', left: 7, operator: '*', right: 9, rationaleTag: 'factor-rearrangement' },
      { side: 'right', left: 20, operator: '+', right: 4, rationaleTag: 'split-place-value' },
      { side: 'left', left: 60, operator: '+', right: 3, rationaleTag: 'split-place-value' },
    ],
  },
  {
    id: '125x24', left: 125, right: 24, tier: 'puzzle',
    hint: { side: 'right', text: 'Twenty-four can break into a compact pair.' },
    teachingViews: [
      { side: 'right', left: 6, operator: '*', right: 4, rationaleTag: 'friendly-product' },
      { side: 'right', left: 20, operator: '+', right: 4, rationaleTag: 'split-place-value' },
      { side: 'left', left: 100, operator: '+', right: 25, rationaleTag: 'friendly-product' },
    ],
  },
] as const;
