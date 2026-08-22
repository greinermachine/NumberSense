import { describe, expect, it } from 'vitest';
import { gameReducer, createInitialGameState } from './gameReducer';
import type { GameAction, GameState } from './types';

const date = new Date('2026-08-22T12:00:00.000Z');

function reduce(state: GameState, ...actions: GameAction[]) {
  return actions.reduce(gameReducer, state);
}

describe('gameReducer', () => {
  it('follows the direct-answer reflection path without forcing a decomposition', () => {
    let state = reduce(createInitialGameState(date), { type: 'START' });
    const problem = state.problems[0];
    state = reduce(
      state,
      { type: 'SUBMIT_DIRECT', answer: problem.left * problem.right },
      { type: 'JUST_KNEW' },
      { type: 'CONTINUE_TO_SURF' },
      { type: 'BEGIN_SURF' },
      { type: 'FINISH_SURF' },
    );
    expect(state.phase).toBe('problem');
    expect(state.stageIndex).toBe(1);
    expect(state.results[0]).toMatchObject({ solvedBy: 'direct', discoveries: [] });
    expect('courseIndex' in state).toBe(false);
    expect('alternate' in state).toBe(false);
  });

  it('preserves the exact guided step after a wrong answer', () => {
    let state = reduce(
      createInitialGameState(date),
      { type: 'START' },
      { type: 'OPEN_DECOMPOSITION', side: 'right' },
    );
    const problem = state.problems[0];
    const view = problem.alternateViews.find((item) => item.side === 'right')!;
    state = gameReducer(state, {
      type: 'SUBMIT_DECOMPOSITION',
      input: `${view.left}${view.operator}${view.right}`,
    });
    expect(state.phase).toBe('guided');
    state = gameReducer(state, { type: 'SUBMIT_GUIDED', answer: -999 });
    expect(state).toMatchObject({ phase: 'guided', stepIndex: 0 });
  });

  it('completes a valid guided plan and records the discovery once', () => {
    let state = reduce(
      createInitialGameState(date),
      { type: 'START' },
      { type: 'OPEN_DECOMPOSITION', side: 'right' },
    );
    const problem = state.problems[0];
    const view = problem.alternateViews.find((item) => item.side === 'right')!;
    state = gameReducer(state, {
      type: 'SUBMIT_DECOMPOSITION',
      input: `${view.left}${view.operator}${view.right}`,
    });
    if (state.phase !== 'guided') throw new Error('Expected guided state');
    for (const step of state.plan.steps) {
      state = gameReducer(state, { type: 'SUBMIT_GUIDED', answer: step.expected });
    }
    expect(state.phase).toBe('alternateReveal');
    expect(state.discoveries[0]).toHaveLength(1);
    expect(state.results[0].solvedBy).toBe('guided');
  });

  it('ignores illegal transitions', () => {
    const state = createInitialGameState(date);
    expect(gameReducer(state, { type: 'BEGIN_SURF' })).toBe(state);
  });

  it('finishes exactly three stages at results', () => {
    let state = reduce(createInitialGameState(date), { type: 'START' });
    for (let stage = 0; stage < 3; stage += 1) {
      const problem = state.problems[state.stageIndex];
      state = reduce(
        state,
        { type: 'SUBMIT_DIRECT', answer: problem.left * problem.right },
        { type: 'JUST_KNEW' },
        { type: 'CONTINUE_TO_SURF' },
        { type: 'BEGIN_SURF' },
        { type: 'FINISH_SURF' },
      );
    }
    expect(state.phase).toBe('results');
    expect(state.results).toHaveLength(3);
  });
});
