import { describe, expect, it } from 'vitest';
import { PROBLEM_BANK } from '../data/problems';
import { formatExpression } from '../math/expression';
import { gameReducer, createInitialGameState } from './gameReducer';
import type { GameAction, GameState } from './types';

const date = new Date('2026-08-22T12:00:00.000Z');

function reduce(state: GameState, ...actions: GameAction[]) {
  return actions.reduce(gameReducer, state);
}

function stateForProblem(problemId: string): GameState {
  const initial = createInitialGameState(date);
  const problem = PROBLEM_BANK.find((item) => item.id === problemId);
  if (!problem) throw new Error(`Missing fixture ${problemId}`);
  return { ...initial, problems: [problem, ...initial.problems.slice(1)] };
}

function reachExpression(problemId: '48x19' | '49x16'): Extract<GameState, { phase: 'expression' }> {
  let state = reduce(
    stateForProblem(problemId),
    { type: 'START' },
    { type: 'OPEN_DECOMPOSITION', side: problemId === '48x19' ? 'right' : 'left' },
    {
      type: 'SUBMIT_DECOMPOSITION',
      input: problemId === '48x19' ? '20-1' : '50-1',
    },
  );
  if (state.phase !== 'guided') throw new Error('Expected guided partial products');
  for (const step of state.plan.steps) {
    state = gameReducer(state, { type: 'SUBMIT_GUIDED', answer: step.expected });
  }
  if (state.phase !== 'expression') throw new Error('Expected active expression');
  return state;
}

function finishTransformation(state: GameState): GameState {
  let current = state;
  while (current.phase === 'expressionTransforming') {
    current = gameReducer(current, { type: 'ADVANCE_EXPRESSION_TRANSFORM' });
  }
  return current;
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
    expect(state.phase).toBe('expression');
    state = gameReducer(state, {
      type: 'SUBMIT_EXPRESSION_ANSWER',
      answer: problem.left * problem.right,
    });
    expect(state.phase).toBe('alternateReveal');
    expect(state.discoveries[0]).toHaveLength(1);
    expect(state.results[0].solvedBy).toBe('guided');
  });

  it('ignores illegal transitions', () => {
    const state = createInitialGameState(date);
    expect(gameReducer(state, { type: 'BEGIN_SURF' })).toBe(state);
  });

  it('keeps 960 - 48 interactive and carries a recursive 50 - 2 view through', () => {
    let state: GameState = reachExpression('48x19');
    expect(formatExpression(state.expression)).toBe('960 − 48');

    state = reduce(
      state,
      { type: 'SUBMIT_EXPRESSION_ANSWER', answer: 913 },
      { type: 'OPEN_EXPRESSION_DECOMPOSITION', path: ['right'] },
      { type: 'SUBMIT_EXPRESSION_DECOMPOSITION', input: '50-2' },
    );
    expect(state).toMatchObject({
      phase: 'expressionTransforming',
      frameIndex: 0,
    });
    if (state.phase !== 'expressionTransforming') throw new Error('Expected transformation');
    expect(state.frames.map((frame) => frame.display)).toEqual([
      '960 − (50 − 2)',
      '960 − 50 + 2',
      '910 + 2',
    ]);

    state = finishTransformation(state);
    expect(state.phase).toBe('expression');
    if (state.phase !== 'expression') throw new Error('Expected recursive expression');
    expect(formatExpression(state.expression)).toBe('910 + 2');
    expect(state.attemptCounts[0]).toBe(1);

    state = gameReducer(state, { type: 'SUBMIT_EXPRESSION_ANSWER', answer: 912 });
    expect(state.phase).toBe('alternateReveal');
    expect(state.results[0]).toMatchObject({
      solvedBy: 'guided',
      manipulationCount: 1,
      attemptCount: 1,
    });
  });

  it('rejects invalid recursive decompositions without losing the active expression', () => {
    let state: GameState = reachExpression('48x19');
    state = reduce(
      state,
      { type: 'OPEN_EXPRESSION_DECOMPOSITION', path: ['right'] },
      { type: 'SUBMIT_EXPRESSION_DECOMPOSITION', input: '60-2' },
    );
    expect(state).toMatchObject({
      phase: 'expressionDecomposing',
      inputError: 'That makes 58, not 48. Keep turning it over.',
    });
    if (state.phase === 'expressionDecomposing') {
      expect(formatExpression(state.expression)).toBe('960 − 48');
    }
  });

  it('allows two recursive manipulations in one problem', () => {
    let state: GameState = reachExpression('48x19');
    state = finishTransformation(reduce(
      state,
      { type: 'OPEN_EXPRESSION_DECOMPOSITION', path: ['right'] },
      { type: 'SUBMIT_EXPRESSION_DECOMPOSITION', input: '50-2' },
    ));
    state = finishTransformation(reduce(
      state,
      { type: 'OPEN_EXPRESSION_DECOMPOSITION', path: ['right'] },
      { type: 'SUBMIT_EXPRESSION_DECOMPOSITION', input: '1+1' },
    ));
    expect(state.phase).toBe('expression');
    expect(state.manipulationCounts[0]).toBe(2);
    if (state.phase === 'expression') {
      expect(formatExpression(state.expression)).toBe('911 + 1');
    }
  });

  it('turns the depth limit into guided help instead of an error state', () => {
    let state: GameState = reachExpression('48x19');
    for (const input of ['50-2', '1+1', '3-2']) {
      state = finishTransformation(reduce(
        state,
        { type: 'OPEN_EXPRESSION_DECOMPOSITION', path: ['right'] },
        { type: 'SUBMIT_EXPRESSION_DECOMPOSITION', input },
      ));
    }
    expect(state.manipulationCounts[0]).toBe(3);
    state = gameReducer(state, {
      type: 'OPEN_EXPRESSION_DECOMPOSITION',
      path: ['right'],
    });
    expect(state).toMatchObject({
      phase: 'expression',
      feedback: 'This one has turned enough. Take the next step with me.',
    });
    expect(state.hintCounts[0]).toBe(5);
  });

  it('offers a final rescue that completes rather than trapping the player', () => {
    let state: GameState = reachExpression('49x16');
    for (let count = 0; count < 5; count += 1) {
      state = gameReducer(state, { type: 'USE_HINT' });
    }
    state = gameReducer(state, { type: 'ACCEPT_EXPRESSION_RESCUE' });
    expect(state.phase).toBe('alternateReveal');
    expect(state.results[0]).toMatchObject({
      hintUsed: true,
      assisted: true,
      solvedBy: 'guided',
    });
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
