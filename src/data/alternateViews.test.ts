import { describe, expect, it } from 'vitest';
import { parseDecomposition } from '../math/decomposition';
import { PROBLEM_BANK } from './problems';
import { alternateViewKey, selectAlternateView } from './alternateViews';

describe('selectAlternateView', () => {
  it('prefers an unused and structurally different curated view', () => {
    const problem = PROBLEM_BANK.find((item) => item.id === '54x19')!;
    const parsed = parseDecomposition('50+4', 54);
    if (!parsed.ok) throw new Error('Fixture must be valid');
    const selected = selectAlternateView(problem, [
      { side: 'left', expression: parsed.expression },
    ]);
    expect(alternateViewKey(selected)).not.toBe('left:4+50');
    expect(selected.operator).not.toBe('+');
    expect(selected.side).toBe('right');
  });
});
