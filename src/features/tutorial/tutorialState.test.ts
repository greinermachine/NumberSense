import { describe, expect, it } from 'vitest';
import { formatExpression } from '../../math/expression';
import {
  createTutorialGameState,
  tutorialReducer,
} from './tutorialState';

function finishTransformation(state: ReturnType<typeof createTutorialGameState>) {
  let current = state;
  for (let index = 0; index < 10 && current.phase === 'expressionTransforming'; index += 1) {
    current = tutorialReducer(current, { type: 'ADVANCE_EXPRESSION_TRANSFORM' });
  }
  return current;
}

describe('tutorial math path', () => {
  it('starts on the curated 24 × 19 problem without a slide or intro gate', () => {
    const state = createTutorialGameState();
    expect(state).toMatchObject({ phase: 'problem', stageIndex: 0 });
    expect(state.problems).toHaveLength(1);
    expect(state.problems[0]).toMatchObject({ left: 24, right: 19 });
  });

  it('turns 19 into 20 − 1 and automatically settles routine partial products', () => {
    let state = createTutorialGameState();
    state = tutorialReducer(state, { type: 'OPEN_DECOMPOSITION', side: 'right' });
    state = tutorialReducer(state, { type: 'SUBMIT_DECOMPOSITION', input: '20-1' });
    expect(state.phase).toBe('expressionTransforming');
    if (state.phase === 'expressionTransforming') {
      expect(state.frames.map((frame) => frame.display)).toEqual([
        '24 × (20 − 1)',
        '24 × 20 − 24 × 1',
        '480 − 24 × 1',
        '480 − 24',
      ]);
    }

    state = finishTransformation(state);
    expect(state.phase).toBe('expression');
    if (state.phase === 'expression') {
      expect(formatExpression(state.expression)).toBe('480 − 24');
    }
  });

  it('keeps recursion optional and lets 24 turn into 20 + 4', () => {
    let state = createTutorialGameState();
    state = tutorialReducer(state, { type: 'OPEN_DECOMPOSITION', side: 'right' });
    state = tutorialReducer(state, { type: 'SUBMIT_DECOMPOSITION', input: '20-1' });
    state = finishTransformation(state);
    expect(state.phase).toBe('expression');

    state = tutorialReducer(state, {
      type: 'OPEN_EXPRESSION_DECOMPOSITION',
      path: ['right'],
    });
    state = tutorialReducer(state, {
      type: 'SUBMIT_EXPRESSION_DECOMPOSITION',
      input: '20+4',
    });
    state = finishTransformation(state);
    expect(state.phase).toBe('expression');
    if (state.phase === 'expression') {
      expect(formatExpression(state.expression)).toBe('460 − 4');
    }

    state = tutorialReducer(state, { type: 'SUBMIT_EXPRESSION_ANSWER', answer: '456' });
    expect(state.phase).toBe('alternateReveal');
  });

  it('accepts a direct answer without forcing decomposition ceremony', () => {
    let state = tutorialReducer(createTutorialGameState(), {
      type: 'SUBMIT_DIRECT',
      answer: '456',
    });
    expect(state.phase).toBe('reflection');
    state = tutorialReducer(state, { type: 'JUST_KNEW' });
    expect(state.phase).toBe('alternateReveal');
    if (state.phase === 'alternateReveal') {
      expect(state.alternate).toMatchObject({
        side: 'right', left: 20, operator: '-', right: 1,
      });
    }
  });
});
