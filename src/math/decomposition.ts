import type {
  BinaryOperator,
  DecompositionValidation,
  ParsedDecomposition,
} from './types';

export const MAX_DECOMPOSITION_LENGTH = 32;
const MAX_TERM_MAGNITUDE = 1_000_000;

const operatorGlyph = (operator: BinaryOperator) =>
  operator === '*' ? '×' : operator;

export function evaluateBinary(
  left: number,
  operator: BinaryOperator,
  right: number,
): number {
  if (operator === '+') return left + right;
  if (operator === '-') return left - right;
  return left * right;
}

export function canonicalDecompositionKey(
  expression: Pick<ParsedDecomposition, 'left' | 'operator' | 'right'>,
): string {
  const { left, operator, right } = expression;
  if (operator === '+' || operator === '*') {
    const [first, second] = [left, right].sort((a, b) => a - b);
    return `${first}${operator}${second}`;
  }
  return `${left}-${right}`;
}

function isTrivial(
  operand: number,
  left: number,
  operator: BinaryOperator,
  right: number,
) {
  if (left === operand || right === operand) return true;
  if (operator === '+' && (left === 0 || right === 0)) return true;
  if (operator === '-' && right === 0) return true;
  return operator === '*' && (left === 1 || right === 1);
}

export function parseDecomposition(
  rawInput: string,
  operand: number,
): DecompositionValidation {
  const input = rawInput.trim();
  if (!input) {
    return { ok: false, code: 'empty', message: 'Try another way to make the number.' };
  }
  if (input.length > MAX_DECOMPOSITION_LENGTH) {
    return { ok: false, code: 'too-long', message: 'Keep it to one short expression.' };
  }

  const match = input.match(/^([+-]?\d+)\s*([+*xX×-])\s*([+-]?\d+)$/u);
  if (!match) {
    return {
      ok: false,
      code: 'syntax',
      message: 'Use two whole numbers with +, −, or ×.',
    };
  }

  const left = Number(match[1]);
  const right = Number(match[3]);
  const rawOperator = match[2];
  const operator: BinaryOperator =
    rawOperator === 'x' || rawOperator === 'X' || rawOperator === '×'
      ? '*'
      : (rawOperator as BinaryOperator);

  if (
    !Number.isSafeInteger(left) ||
    !Number.isSafeInteger(right) ||
    Math.abs(left) > MAX_TERM_MAGNITUDE ||
    Math.abs(right) > MAX_TERM_MAGNITUDE
  ) {
    return {
      ok: false,
      code: 'unsafe-integer',
      message: 'Use smaller whole numbers.',
    };
  }

  const result = evaluateBinary(left, operator, right);
  if (result !== operand) {
    return {
      ok: false,
      code: 'not-equivalent',
      message: `That makes ${result}, not ${operand}. Keep turning it over.`,
    };
  }

  if (isTrivial(operand, left, operator, right)) {
    return {
      ok: false,
      code: 'not-a-decomposition',
      message: 'Make the number from two different pieces.',
    };
  }

  return {
    ok: true,
    expression: {
      left,
      operator,
      right,
      result,
      normalized: `${left} ${operatorGlyph(operator)} ${right}`,
    },
  };
}
