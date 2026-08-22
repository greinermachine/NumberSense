import { describe, expect, it } from 'vitest';
import { buildShareText } from './share';
import type { ProblemResult } from './types';

describe('buildShareText', () => {
  it('is compact and does not reveal problems or answers', () => {
    const results: ProblemResult[] = [
      { problemId: 'secret-a', hintUsed: false, discoveries: [], solvedBy: 'direct' },
      { problemId: 'secret-b', hintUsed: true, discoveries: [], solvedBy: 'guided' },
      { problemId: 'secret-c', hintUsed: false, discoveries: [], solvedBy: 'direct' },
    ];
    const text = buildShareText(143, results);
    expect(text).toContain('NUMBER SENSE #143');
    expect(text).toContain('3 ways seen');
    expect(text).toContain('1 hint');
    expect(text).not.toContain('secret');
    expect(text).not.toMatch(/\d+ × \d+/);
  });
});
