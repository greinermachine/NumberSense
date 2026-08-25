import { describe, expect, it } from 'vitest';
import { binaryExpression, numberExpression } from './expression';
import {
  createExpressionAssistance,
  findFriendlySuggestion,
} from './expressionHints';

describe('expression assistance', () => {
  const awkward = binaryExpression(
    numberExpression(960),
    '-',
    numberExpression(48),
  );

  it('targets the awkward term without immediately disclosing a decomposition', () => {
    expect(createExpressionAssistance(awkward, 1, 0, false)?.message).toBe(
      'Can either number become friendlier?',
    );
    expect(createExpressionAssistance(awkward, 2, 0, false)?.message).toBe(
      'Look at 48.',
    );
    expect(createExpressionAssistance(awkward, 3, 0, false)?.message).toBe(
      '48 is close to 50.',
    );
  });

  it('offers an equivalent nearby-number view only at the stronger level', () => {
    expect(findFriendlySuggestion(awkward)).toMatchObject({
      path: ['right'],
      value: 48,
      input: '50-2',
    });
    expect(createExpressionAssistance(awkward, 4, 0, false)).toMatchObject({
      message: 'Have you considered 48 = 50 − 2?',
      suggestion: { input: '50-2' },
    });
  });

  it('points multiplication toward a player-chosen factor decomposition', () => {
    const product = binaryExpression(
      numberExpression(40),
      '*',
      numberExpression(12),
    );
    expect(createExpressionAssistance(product, 1, 0, false)?.message).toBe(
      'Can either number become easier pieces?',
    );
    expect(createExpressionAssistance(product, 2, 0, false)?.message).toBe(
      'Look at 40.',
    );
    expect(createExpressionAssistance(product, 3, 0, false)?.message).toBe(
      '40 has a 10 hiding inside it.',
    );
    expect(createExpressionAssistance(product, 4, 0, false)).toMatchObject({
      message: 'Have you considered 40 = 4 × 10?',
      suggestion: { path: ['left'], input: '4*10', kind: 'factor' },
    });
  });

  it('advances beyond an attempt-triggered clue when a hint is requested', () => {
    expect(createExpressionAssistance(awkward, 0, 1, false)).toMatchObject({
      level: 1,
      message: 'Can either number become friendlier?',
    });
    expect(createExpressionAssistance(awkward, 1, 1, false)).toMatchObject({
      level: 2,
      message: 'Look at 48.',
    });
  });

  it('switches to one-step rescue at the depth bound', () => {
    expect(createExpressionAssistance(awkward, 0, 0, true)).toMatchObject({
      level: 5,
      rescue: { before: '960 − 48', value: 912 },
    });
  });
});
