import { describe, expect, it } from 'vitest';
import { getDailyNumber, selectDailyProblems, toDailyKey } from './daily';

describe('daily selection', () => {
  const date = new Date('2026-08-22T12:00:00.000Z');

  it('is stable for the same UTC date', () => {
    expect(selectDailyProblems(date).map((problem) => problem.id)).toEqual(
      selectDailyProblems(new Date('2026-08-22T23:59:00.000Z')).map(
        (problem) => problem.id,
      ),
    );
  });

  it('returns exactly one problem from every tier with no duplicates', () => {
    const problems = selectDailyProblems(date);
    expect(problems).toHaveLength(3);
    expect(problems.map((problem) => problem.tier)).toEqual([
      'warm',
      'explore',
      'puzzle',
    ]);
    expect(new Set(problems.map((problem) => problem.id)).size).toBe(3);
  });

  it('uses an explicit UTC key and monotonic display number', () => {
    expect(toDailyKey(date)).toBe('2026-08-22');
    expect(getDailyNumber('2026-01-01')).toBe(1);
    expect(getDailyNumber('2026-01-02')).toBe(2);
  });
});
