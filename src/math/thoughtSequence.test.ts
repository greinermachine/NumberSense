import { describe, expect, it } from 'vitest';
import type { AlternateView, ProblemDefinition } from '../data/types';
import { parseDecomposition } from './decomposition';
import { createThoughtSequence } from './thoughtSequence';

const problem = (left: number, right: number): ProblemDefinition => ({
  id: `${left}x${right}`,
  left,
  right,
  tier: 'explore',
  hint: { side: 'right', text: 'Fixture' },
  alternateViews: [],
});

function playerThought(raw: string, operand: number, side: 'left' | 'right') {
  const parsed = parseDecomposition(raw, operand);
  if (!parsed.ok) throw new Error('Player fixture must be valid');
  return { side, expression: parsed.expression };
}

function expressions(view: AlternateView, item: ProblemDefinition) {
  return createThoughtSequence(item, view).map((step) => step.expression);
}

describe('createThoughtSequence', () => {
  it('acknowledges the player and unfolds a subtraction on the other operand', () => {
    const item = problem(54, 19);
    const view: AlternateView = { side: 'right', left: 20, operator: '-', right: 1 };
    const steps = createThoughtSequence(item, view, playerThought('50+4', 54, 'left'));

    expect(steps.map((step) => step.expression)).toEqual([
      '(50 + 4) × 19',
      '54 × 19',
      '54 × (20 − 1)',
      '54 × 20 − 54 × 1',
      '1080 − 54',
      '54 × 19 = 1026',
      '19 = 20 − 1',
    ]);
    expect(steps[0].autoAdvanceMs).toBe(1_400);
    expect(steps[1]).toMatchObject({ emphasisSide: 'right', annotation: 'I looked over here.' });
  });

  it('distributes an addition on the left in the original operand order', () => {
    const item = problem(51, 14);
    const view: AlternateView = { side: 'left', left: 50, operator: '+', right: 1 };
    expect(expressions(view, item)).toContain('50 × 14 + 1 × 14');
    expect(expressions(view, item)).toContain('700 + 14');
    expect(expressions(view, item)).toContain('51 × 14 = 714');
  });

  it('regroups a multiplicative decomposition instead of distributing it', () => {
    const item = problem(63, 24);
    const view: AlternateView = { side: 'left', left: 7, operator: '*', right: 9 };
    expect(expressions(view, item)).toEqual([
      '63 × 24 = 1512',
      '63 × 24',
      '(7 × 9) × 24',
      '7 × (9 × 24)',
      '7 × 216',
      '63 × 24 = 1512',
      '63 = 7 × 9',
    ]);
  });

  it('regroups a factorization on the right without changing value', () => {
    const item = problem(125, 24);
    const view: AlternateView = { side: 'right', left: 6, operator: '*', right: 4 };
    expect(expressions(view, item)).toContain('(125 × 6) × 4');
    expect(expressions(view, item)).toContain('750 × 4');
  });

  it('marks every displayed transformation as equivalent to its stated target', () => {
    const fixtures: Array<[ProblemDefinition, AlternateView]> = [
      [problem(54, 19), { side: 'right', left: 20, operator: '-', right: 1 }],
      [problem(51, 14), { side: 'left', left: 50, operator: '+', right: 1 }],
      [problem(63, 24), { side: 'left', left: 7, operator: '*', right: 9 }],
      [problem(125, 24), { side: 'right', left: 6, operator: '*', right: 4 }],
    ];

    for (const [item, view] of fixtures) {
      for (const step of createThoughtSequence(item, view)) {
        expect(step.equivalence.value, step.expression).toBe(step.equivalence.target);
      }
    }
  });
});
