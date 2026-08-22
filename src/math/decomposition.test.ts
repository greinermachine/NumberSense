import { describe, expect, it } from 'vitest';
import {
  MAX_DECOMPOSITION_LENGTH,
  canonicalDecompositionKey,
  parseDecomposition,
} from './decomposition';

describe('parseDecomposition', () => {
  it.each([
    ['10 + 9', 19, '+'],
    ['20-1', 19, '-'],
    ['7*7', 49, '*'],
    ['  7 x 7  ', 49, '*'],
  ])('accepts %s as a decomposition of %i', (input, operand, operator) => {
    const result = parseDecomposition(input, operand);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.expression.operator).toBe(operator);
  });

  it.each([
    ['', 'empty'],
    ['19', 'syntax'],
    ['10 / 2', 'syntax'],
    ['alert(19)', 'syntax'],
    ['1;globalThis.hacked=true', 'syntax'],
    ['20 + 1', 'not-equivalent'],
    ['19 + 0', 'not-a-decomposition'],
    ['1 * 19', 'not-a-decomposition'],
  ])('rejects %s with %s', (input, code) => {
    const result = parseDecomposition(input, 19);
    expect(result).toMatchObject({ ok: false, code });
  });

  it('bounds input length before parsing', () => {
    const result = parseDecomposition('1'.repeat(MAX_DECOMPOSITION_LENGTH + 1), 19);
    expect(result).toMatchObject({ ok: false, code: 'too-long' });
  });

  it('canonicalizes commutative decompositions', () => {
    expect(canonicalDecompositionKey({ left: 10, operator: '+', right: 9 })).toBe(
      canonicalDecompositionKey({ left: 9, operator: '+', right: 10 }),
    );
  });
});
