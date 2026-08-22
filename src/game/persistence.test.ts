import { describe, expect, it } from 'vitest';
import { createInitialGameState, gameReducer } from './gameReducer';
import { restoreGameState, serializeGameState } from './persistence';

const today = new Date('2026-08-22T12:00:00.000Z');

describe('persistence', () => {
  it('round-trips a valid in-progress daily state', () => {
    const state = gameReducer(createInitialGameState(today), { type: 'START' });
    const restored = restoreGameState(serializeGameState(state), today);
    expect(restored).toMatchObject({ phase: 'problem', dateKey: '2026-08-22' });
    expect(restored?.problems.map((problem) => problem.id)).toEqual(
      state.problems.map((problem) => problem.id),
    );
  });

  it.each([
    ['corrupt JSON', '{not json'],
    ['unknown version', JSON.stringify({ version: 99 })],
    [
      'stale date',
      serializeGameState(createInitialGameState(new Date('2026-08-21T12:00:00.000Z'))),
    ],
    [
      'malformed result records',
      JSON.stringify({
        ...JSON.parse(serializeGameState(createInitialGameState(today))),
        results: [{ problemId: 'invented', discoveries: 'not-an-array' }],
      }),
    ],
  ])('rejects %s', (_label, raw) => {
    expect(restoreGameState(raw, today)).toBeNull();
  });

  it('moves an active surf back to the user-gesture launch state', () => {
    let state = gameReducer(createInitialGameState(today), { type: 'START' });
    const problem = state.problems[0];
    state = gameReducer(state, { type: 'SUBMIT_DIRECT', answer: problem.left * problem.right });
    state = gameReducer(state, { type: 'JUST_KNEW' });
    state = gameReducer(state, { type: 'CONTINUE_TO_SURF' });
    state = gameReducer(state, { type: 'BEGIN_SURF' });
    expect(state.phase).toBe('surfing');
    expect(restoreGameState(serializeGameState(state), today)?.phase).toBe('surfTransition');
  });
});
