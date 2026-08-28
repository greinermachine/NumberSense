import { describe, expect, it } from 'vitest';
import { formatExpression } from '../math/expression';
import { createInitialGameState, gameReducer } from './gameReducer';
import { restoreGameState, serializeGameState, STORAGE_VERSION } from './persistence';
import type { GameState } from './types';

const today = new Date('2026-08-22T12:00:00.000Z');
const recursiveDate = new Date('2026-01-06T12:00:00.000Z');

function stateForProblem(problemId: string): GameState {
  const initial = createInitialGameState(recursiveDate);
  if (initial.problems[0]?.id !== problemId) {
    throw new Error(`V2 daily fixture ${recursiveDate.toISOString()} no longer selects ${problemId}`);
  }
  return initial;
}

describe('persistence', () => {
  it('round-trips a valid in-progress daily state', () => {
    const state = gameReducer(createInitialGameState(today), { type: 'START' });
    const restored = restoreGameState(serializeGameState(state), today);
    expect(restored).toMatchObject({ phase: 'problem', dateKey: '2026-08-22' });
    expect(restored?.problems.map((problem) => problem.id)).toEqual(
      state.problems.map((problem) => problem.id),
    );
  });

  it('uses a new snapshot version while migrating safe V1 progress', () => {
    const current = JSON.parse(
      serializeGameState(gameReducer(createInitialGameState(today), { type: 'START' })),
    );
    expect(current.version).toBe(STORAGE_VERSION);
    const legacy = {
      ...current,
      version: 1,
      hintCounts: undefined,
      attemptCounts: undefined,
      manipulationCounts: undefined,
    };
    const restored = restoreGameState(JSON.stringify(legacy), today);
    expect(restored).toMatchObject({
      phase: 'problem',
      hintCounts: [0, 0, 0],
      attemptCounts: [0, 0, 0],
      manipulationCounts: [0, 0, 0],
    });
  });

  it('migrates a V1 guided combine checkpoint into an active expression', () => {
    let state = gameReducer(createInitialGameState(today), { type: 'START' });
    const problem = state.problems[0];
    const view = problem.teachingViews.find(
      (item) => item.operator === '+' || item.operator === '-',
    )!;
    state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: view.side });
    state = gameReducer(state, {
      type: 'SUBMIT_DECOMPOSITION',
      input: `${view.left}${view.operator}${view.right}`,
    });
    if (state.phase !== 'guided' || state.plan.completion.type !== 'expression') {
      throw new Error('Expected additive guided fixture');
    }
    const snapshot = JSON.parse(serializeGameState(state));
    const legacy = {
      ...snapshot,
      version: 1,
      expression: snapshot.guidedDecomposition,
      guidedDecomposition: undefined,
      hintCounts: undefined,
      attemptCounts: undefined,
      manipulationCounts: undefined,
      stepIndex: state.plan.steps.length,
      answers: state.plan.steps.map((step) => step.expected),
    };
    const restored = restoreGameState(JSON.stringify(legacy), today);
    expect(restored?.phase).toBe('expression');
    if (restored?.phase === 'expression') {
      expect(formatExpression(restored.expression)).toBe(
        formatExpression(state.plan.completion.expression),
      );
    }
  });

  it('round-trips an active recursive expression', () => {
    let state = gameReducer(createInitialGameState(today), { type: 'START' });
    const problem = state.problems[0];
    const view = problem.teachingViews.find(
      (item) => item.operator === '+' || item.operator === '-',
    )!;
    state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: view.side });
    state = gameReducer(state, {
      type: 'SUBMIT_DECOMPOSITION',
      input: `${view.left}${view.operator}${view.right}`,
    });
    if (state.phase !== 'guided') throw new Error('Expected guided state');
    for (const step of state.plan.steps) {
      state = gameReducer(state, { type: 'SUBMIT_GUIDED', answer: step.expected });
    }
    if (state.phase !== 'expression') throw new Error('Expected active expression');
    const expected = formatExpression(state.expression);
    const restored = restoreGameState(serializeGameState(state), today);
    expect(restored?.phase).toBe('expression');
    if (restored?.phase === 'expression') {
      expect(formatExpression(restored.expression)).toBe(expected);
    }
  });

  it('round-trips a recursive guided multiplication checkpoint', () => {
    let state = gameReducer(stateForProblem('36x12'), { type: 'START' });
    state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: 'left' });
    state = gameReducer(state, { type: 'SUBMIT_DECOMPOSITION', input: '40-4' });
    expect(state.phase).toBe('guided');

    const restored = restoreGameState(serializeGameState(state), recursiveDate);
    expect(restored).toMatchObject({ phase: 'guided', stepIndex: 0, answers: [] });
    if (restored?.phase === 'guided') {
      expect(formatExpression(restored.workingExpression)).toBe('40 × 12 − 4 × 12');
    }
  });

  it('restores a completed guided regrouping at the next partial product', () => {
    let state = gameReducer(stateForProblem('36x12'), { type: 'START' });
    state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: 'left' });
    state = gameReducer(state, { type: 'SUBMIT_DECOMPOSITION', input: '40-4' });
    state = gameReducer(state, {
      type: 'OPEN_EXPRESSION_DECOMPOSITION',
      path: ['left'],
    });
    state = gameReducer(state, {
      type: 'SUBMIT_EXPRESSION_DECOMPOSITION',
      input: '4*10',
    });
    expect(state.phase).toBe('expressionTransforming');

    const restored = restoreGameState(serializeGameState(state), recursiveDate);
    expect(restored).toMatchObject({
      phase: 'guided',
      stepIndex: 1,
      answers: [480],
      manipulationCounts: [1, 0, 0],
    });
    if (restored?.phase === 'guided') {
      expect(formatExpression(restored.workingExpression)).toBe('480 − 4 × 12');
    }
  });

  it('restores a transformation at its clean final-expression checkpoint', () => {
    let state = gameReducer(createInitialGameState(today), { type: 'START' });
    const problem = state.problems[0];
    const view = problem.teachingViews.find(
      (item) => item.operator === '+' || item.operator === '-',
    )!;
    state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: view.side });
    state = gameReducer(state, {
      type: 'SUBMIT_DECOMPOSITION',
      input: `${view.left}${view.operator}${view.right}`,
    });
    if (state.phase !== 'guided') throw new Error('Expected guided state');
    for (const step of state.plan.steps) {
      state = gameReducer(state, { type: 'SUBMIT_GUIDED', answer: step.expected });
    }
    if (state.phase !== 'expression' || state.expression.type !== 'binary') {
      throw new Error('Expected active expression');
    }
    const target = state.expression.right;
    if (target.type !== 'number') throw new Error('Expected numeric term');
    state = gameReducer(state, {
      type: 'OPEN_EXPRESSION_DECOMPOSITION',
      path: ['right'],
    });
    state = gameReducer(state, {
      type: 'SUBMIT_EXPRESSION_DECOMPOSITION',
      input: `${target.value + 1}-1`,
    });
    expect(state.phase).toBe('expressionTransforming');
    const restored = restoreGameState(serializeGameState(state), today);
    expect(restored?.phase).toBe('expression');
    if (state.phase === 'expressionTransforming' && restored?.phase === 'expression') {
      expect(formatExpression(restored.expression)).toBe(
        formatExpression(state.finalExpression),
      );
    }
  });

  it('restores an accepted final expression at the completed reveal', () => {
    let state = gameReducer(createInitialGameState(today), { type: 'START' });
    const problem = state.problems[0];
    const view = problem.teachingViews.find(
      (item) => item.operator === '+' || item.operator === '-',
    )!;
    state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: view.side });
    state = gameReducer(state, {
      type: 'SUBMIT_DECOMPOSITION',
      input: `${view.left}${view.operator}${view.right}`,
    });
    if (state.phase !== 'guided') throw new Error('Expected guided state');
    for (const step of state.plan.steps) {
      state = gameReducer(state, { type: 'SUBMIT_GUIDED', answer: step.expected });
    }
    if (state.phase !== 'expression') throw new Error('Expected active expression');

    state = gameReducer(state, {
      type: 'SUBMIT_EXPRESSION_ANSWER',
      answer: `${problem.left * problem.right + 10} - 10`,
    });
    expect(state.phase).toBe('expressionTransforming');

    const restored = restoreGameState(serializeGameState(state), today);
    expect(restored).toMatchObject({
      phase: 'alternateReveal',
      solvedBy: 'guided',
      results: [{ problemId: problem.id, solvedBy: 'guided' }],
    });
  });

  it('restores an accepted direct expression at reflection without pre-solving it', () => {
    let state = gameReducer(createInitialGameState(today), { type: 'START' });
    const problem = state.problems[0];
    const expected = problem.left * problem.right;
    state = gameReducer(state, {
      type: 'SUBMIT_DIRECT',
      answer: `${expected + 10} - 10`,
    });
    expect(state.phase).toBe('expressionTransforming');

    const restored = restoreGameState(serializeGameState(state), today);
    expect(restored).toMatchObject({ phase: 'reflection', results: [] });
  });

  it('restores an accepted guided expression at the next exact partial', () => {
    let state = gameReducer(createInitialGameState(today), { type: 'START' });
    const problem = state.problems[0];
    const view = problem.teachingViews.find(
      (item) => item.operator === '+' || item.operator === '-',
    )!;
    state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: view.side });
    state = gameReducer(state, {
      type: 'SUBMIT_DECOMPOSITION',
      input: `${view.left}${view.operator}${view.right}`,
    });
    if (state.phase !== 'guided') throw new Error('Expected guided state');
    const expected = state.plan.steps[0].expected;
    state = gameReducer(state, {
      type: 'SUBMIT_GUIDED',
      answer: `${expected + 10} - 10`,
    });
    expect(state.phase).toBe('expressionTransforming');

    const restored = restoreGameState(serializeGameState(state), today);
    expect(restored).toMatchObject({
      phase: 'guided',
      stepIndex: 1,
      answers: [expected],
    });
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

  it.each(['surfTransition', 'surfing'])(
    'migrates a legacy %s snapshot past the removed reward phase',
    (legacyPhase) => {
    let state = gameReducer(createInitialGameState(today), { type: 'START' });
    const problem = state.problems[0];
    state = gameReducer(state, { type: 'SUBMIT_DIRECT', answer: problem.left * problem.right });
    state = gameReducer(state, { type: 'JUST_KNEW' });
    expect(state.phase).toBe('alternateReveal');
    const snapshot = JSON.parse(serializeGameState(state)) as Record<string, unknown>;
    snapshot.phase = legacyPhase;
    expect(restoreGameState(JSON.stringify(snapshot), today)).toMatchObject({
      phase: 'problem',
      stageIndex: 1,
    });
    },
  );
});
