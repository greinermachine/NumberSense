import type { ProblemDefinition } from './types';

export const PROBLEM_BANK: readonly ProblemDefinition[] = [
  {
    id: '24x11', left: 24, right: 11, tier: 'warm',
    hint: { side: 'right', text: 'Look at 11. What sits just beside ten?' },
    alternateViews: [
      { side: 'right', left: 10, operator: '+', right: 1 },
      { side: 'left', left: 20, operator: '+', right: 4 },
      { side: 'left', left: 6, operator: '*', right: 4 },
    ],
  },
  {
    id: '32x15', left: 32, right: 15, tier: 'warm',
    hint: { side: 'right', text: 'Could 15 split into two familiar pieces?' },
    alternateViews: [
      { side: 'right', left: 10, operator: '+', right: 5 },
      { side: 'left', left: 30, operator: '+', right: 2 },
      { side: 'left', left: 4, operator: '*', right: 8 },
    ],
  },
  {
    id: '58x11', left: 58, right: 11, tier: 'warm',
    hint: { side: 'right', text: 'Look just beyond ten.' },
    alternateViews: [
      { side: 'right', left: 10, operator: '+', right: 1 },
      { side: 'left', left: 60, operator: '-', right: 2 },
      { side: 'left', left: 50, operator: '+', right: 8 },
    ],
  },
  {
    id: '36x12', left: 36, right: 12, tier: 'warm',
    hint: { side: 'right', text: 'Twelve has a useful relationship with ten.' },
    alternateViews: [
      { side: 'right', left: 10, operator: '+', right: 2 },
      { side: 'left', left: 6, operator: '*', right: 6 },
      { side: 'left', left: 40, operator: '-', right: 4 },
    ],
  },
  {
    id: '25x18', left: 25, right: 18, tier: 'warm',
    hint: { side: 'right', text: 'Is 18 close to a round number?' },
    alternateViews: [
      { side: 'right', left: 20, operator: '-', right: 2 },
      { side: 'left', left: 100, operator: '-', right: 75 },
      { side: 'right', left: 9, operator: '*', right: 2 },
    ],
  },
  {
    id: '42x9', left: 42, right: 9, tier: 'warm',
    hint: { side: 'right', text: 'What friendly number is one step from 9?' },
    alternateViews: [
      { side: 'right', left: 10, operator: '-', right: 1 },
      { side: 'left', left: 40, operator: '+', right: 2 },
      { side: 'left', left: 6, operator: '*', right: 7 },
    ],
  },
  {
    id: '39x12', left: 39, right: 12, tier: 'explore',
    hint: { side: 'left', text: 'Look at 39. Is a round number nearby?' },
    alternateViews: [
      { side: 'left', left: 40, operator: '-', right: 1 },
      { side: 'right', left: 10, operator: '+', right: 2 },
      { side: 'left', left: 30, operator: '+', right: 9 },
    ],
  },
  {
    id: '47x18', left: 47, right: 18, tier: 'explore',
    hint: { side: 'right', text: 'Try looking just beyond 18.' },
    alternateViews: [
      { side: 'right', left: 20, operator: '-', right: 2 },
      { side: 'left', left: 50, operator: '-', right: 3 },
      { side: 'right', left: 9, operator: '*', right: 2 },
    ],
  },
  {
    id: '51x14', left: 51, right: 14, tier: 'explore',
    hint: { side: 'left', text: 'What sits one step away from 51?' },
    alternateViews: [
      { side: 'left', left: 50, operator: '+', right: 1 },
      { side: 'right', left: 10, operator: '+', right: 4 },
      { side: 'right', left: 7, operator: '*', right: 2 },
    ],
  },
  {
    id: '64x15', left: 64, right: 15, tier: 'explore',
    hint: { side: 'right', text: 'Could 15 be ten and something more?' },
    alternateViews: [
      { side: 'right', left: 10, operator: '+', right: 5 },
      { side: 'left', left: 8, operator: '*', right: 8 },
      { side: 'left', left: 60, operator: '+', right: 4 },
    ],
  },
  {
    id: '75x16', left: 75, right: 16, tier: 'explore',
    hint: { side: 'left', text: 'Seventy-five can be split into familiar quarters.' },
    alternateViews: [
      { side: 'left', left: 50, operator: '+', right: 25 },
      { side: 'right', left: 8, operator: '*', right: 2 },
      { side: 'left', left: 100, operator: '-', right: 25 },
    ],
  },
  {
    id: '54x19', left: 54, right: 19, tier: 'explore',
    hint: { side: 'right', text: 'What round number is one away from 19?' },
    alternateViews: [
      { side: 'right', left: 20, operator: '-', right: 1 },
      { side: 'left', left: 50, operator: '+', right: 4 },
      { side: 'left', left: 6, operator: '*', right: 9 },
    ],
  },
  {
    id: '48x19', left: 48, right: 19, tier: 'puzzle',
    hint: { side: 'right', text: 'Look at 19. Is there a nearby round number?' },
    alternateViews: [
      { side: 'right', left: 20, operator: '-', right: 1 },
      { side: 'right', left: 10, operator: '+', right: 9 },
      { side: 'left', left: 50, operator: '-', right: 2 },
    ],
  },
  {
    id: '49x16', left: 49, right: 16, tier: 'puzzle',
    hint: { side: 'left', text: '49 has a shape beyond its nearest round number.' },
    alternateViews: [
      { side: 'left', left: 50, operator: '-', right: 1 },
      { side: 'left', left: 40, operator: '+', right: 9 },
      { side: 'left', left: 7, operator: '*', right: 7 },
    ],
  },
  {
    id: '98x12', left: 98, right: 12, tier: 'puzzle',
    hint: { side: 'left', text: 'What round number is very close to 98?' },
    alternateViews: [
      { side: 'left', left: 100, operator: '-', right: 2 },
      { side: 'right', left: 10, operator: '+', right: 2 },
      { side: 'left', left: 49, operator: '*', right: 2 },
    ],
  },
  {
    id: '99x17', left: 99, right: 17, tier: 'puzzle',
    hint: { side: 'left', text: 'One small step changes 99 completely.' },
    alternateViews: [
      { side: 'left', left: 100, operator: '-', right: 1 },
      { side: 'right', left: 10, operator: '+', right: 7 },
      { side: 'left', left: 90, operator: '+', right: 9 },
    ],
  },
  {
    id: '63x24', left: 63, right: 24, tier: 'puzzle',
    hint: { side: 'left', text: 'Can 63 be made from equal factors?' },
    alternateViews: [
      { side: 'left', left: 7, operator: '*', right: 9 },
      { side: 'right', left: 20, operator: '+', right: 4 },
      { side: 'left', left: 60, operator: '+', right: 3 },
    ],
  },
  {
    id: '125x24', left: 125, right: 24, tier: 'puzzle',
    hint: { side: 'right', text: 'Twenty-four can break into a compact pair.' },
    alternateViews: [
      { side: 'right', left: 6, operator: '*', right: 4 },
      { side: 'right', left: 20, operator: '+', right: 4 },
      { side: 'left', left: 100, operator: '+', right: 25 },
    ],
  },
] as const;
