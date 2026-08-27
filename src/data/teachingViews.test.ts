import { describe, expect, it } from 'vitest';
import { parseDecomposition } from '../math/decomposition';
import { PROBLEM_BANK } from './problems';
import { selectTeachingView, teachingViewKey } from './teachingViews';

describe('selectTeachingView', () => {
  it('prefers an unused and structurally different authored view', () => {
    const problem = PROBLEM_BANK.find((item) => item.id === '54x19')!;
    const parsed = parseDecomposition('50+4', 54);
    if (!parsed.ok) throw new Error('Fixture must be valid');
    const selected = selectTeachingView(problem, [
      { side: 'left', expression: parsed.expression },
    ]);
    expect(teachingViewKey(selected)).not.toBe('left:4+50');
    expect(selected.operator).not.toBe('+');
    expect(selected.side).toBe('right');
  });

  it('can return only a view explicitly present in teaching metadata', () => {
    for (const problem of PROBLEM_BANK) {
      const selected = selectTeachingView(problem, []);
      expect(problem.teachingViews).toContain(selected);
    }
  });

  it('does not echo an unusual valid player view unless content explicitly authored it', () => {
    const problem = PROBLEM_BANK.find((item) => item.id === '25x12')!;
    const parsed = parseDecomposition('100-75', 25);
    if (!parsed.ok) throw new Error('Fixture must be valid player math');
    const selected = selectTeachingView(problem, [
      { side: 'left', expression: parsed.expression },
    ]);
    expect(teachingViewKey(selected)).not.toBe('left:100-75');
    expect(problem.teachingViews).toContain(selected);
  });
});
