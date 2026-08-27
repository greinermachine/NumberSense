import { describe, expect, it } from 'vitest';
import { parseDecomposition } from '../math/decomposition';
import { PROBLEM_BANK } from './problems';

describe('curated problem bank', () => {
  it('uses unique IDs and at least two valid, rationale-tagged teaching views per problem', () => {
    expect(new Set(PROBLEM_BANK.map((problem) => problem.id)).size).toBe(PROBLEM_BANK.length);
    for (const problem of PROBLEM_BANK) {
      expect(problem.teachingViews.length).toBeGreaterThanOrEqual(2);
      for (const view of problem.teachingViews) {
        expect(view.rationaleTag, `${problem.id} needs an authored rationale`).toBeTruthy();
        const operand = view.side === 'left' ? problem.left : problem.right;
        const parsed = parseDecomposition(
          `${view.left}${view.operator}${view.right}`,
          operand,
        );
        expect(parsed.ok, `${problem.id} has an invalid curated view`).toBe(true);
      }
    }
  });

  it('removes the observed 25 = 100 − 75 teaching route from the whole bank', () => {
    const awkward = PROBLEM_BANK.flatMap((problem) => problem.teachingViews).find(
      (view) =>
        view.left === 100 &&
        view.operator === '-' &&
        view.right === 75,
    );
    expect(awkward).toBeUndefined();
  });

  it('authors useful 25 × 12 routes without restricting equivalent player input', () => {
    const problem = PROBLEM_BANK.find((item) => item.id === '25x12');
    expect(problem?.teachingViews).toEqual(expect.arrayContaining([
      expect.objectContaining({ side: 'right', left: 10, operator: '+', right: 2 }),
      expect.objectContaining({ side: 'right', left: 4, operator: '*', right: 3 }),
    ]));

    // The parser remains the player boundary: unusual, valid math is accepted
    // even though it is not promoted into authored teaching data.
    expect(parseDecomposition('100-75', 25).ok).toBe(true);
  });
});
