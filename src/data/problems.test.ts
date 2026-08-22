import { describe, expect, it } from 'vitest';
import { parseDecomposition } from '../math/decomposition';
import { PROBLEM_BANK } from './problems';

describe('curated problem bank', () => {
  it('uses unique IDs and at least two valid views per problem', () => {
    expect(new Set(PROBLEM_BANK.map((problem) => problem.id)).size).toBe(PROBLEM_BANK.length);
    for (const problem of PROBLEM_BANK) {
      expect(problem.alternateViews.length).toBeGreaterThanOrEqual(2);
      for (const view of problem.alternateViews) {
        const operand = view.side === 'left' ? problem.left : problem.right;
        const parsed = parseDecomposition(
          `${view.left}${view.operator}${view.right}`,
          operand,
        );
        expect(parsed.ok, `${problem.id} has an invalid curated view`).toBe(true);
      }
    }
  });
});
