import { describe, expect, it } from 'vitest';
import {
  MAX_ANSWER_EXPRESSION_LENGTH,
  parseAnswerExpression,
} from './answerExpression';

function expectValue(input: string, expected: number) {
  const parsed = parseAnswerExpression(input);
  expect(parsed).toMatchObject({ ok: true, answer: { value: expected } });
}

describe('parseAnswerExpression', () => {
  it.each([
    ['950', 950],
    ['1000 - 50', 950],
    ['900 + 50', 950],
    ['95 * 10', 950],
    ['95 x 10', 950],
    ['95 × 10', 950],
    ['1000-50', 950],
    ['1000 - 100 + 50', 950],
    ['(100 - 5) * 10', 950],
    ['2 + 3 * 4', 14],
    ['(2 + 3) * 4', 20],
  ])('safely evaluates %s', (input, expected) => {
    expectValue(input, expected as number);
  });

  it('distinguishes a plain integer from an expression answer', () => {
    expect(parseAnswerExpression('950')).toMatchObject({
      ok: true,
      answer: { isPlainInteger: true, normalized: '950' },
    });
    expect(parseAnswerExpression('1000 - 50')).toMatchObject({
      ok: true,
      answer: { isPlainInteger: false, normalized: '1000 − 50' },
    });
  });

  it.each([
    'hello',
    '950abc',
    'alert(1)',
    '1 / 0',
    '1 ** 2',
    '1.5 + 948.5',
    '(1000 - 50',
    '1000 - 50)',
    '1 +',
  ])('rejects unsupported or malformed input %s', (input) => {
    expect(parseAnswerExpression(input)).toMatchObject({ ok: false });
  });

  it('rejects unsafe intermediate arithmetic', () => {
    expect(parseAnswerExpression('1000000000 * 2')).toMatchObject({
      ok: false,
      code: 'unsafe-integer',
    });
  });

  it('rejects excessive input length gracefully', () => {
    expect(parseAnswerExpression('1'.repeat(MAX_ANSWER_EXPRESSION_LENGTH + 1))).toMatchObject({
      ok: false,
      code: 'too-long',
    });
  });

  it('bounds nested expression depth', () => {
    expect(parseAnswerExpression('(((((((((1 + 1)))))))))')).toMatchObject({
      ok: false,
      code: 'too-complex',
    });
  });
});
