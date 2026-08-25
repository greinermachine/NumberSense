import { evaluateBinary } from './decomposition';
import {
  binaryExpression,
  formatExpression,
  numberExpression,
} from './expression';
import type { BinaryOperator, MathExpression } from './types';

export const MAX_ANSWER_EXPRESSION_LENGTH = 64;
export const MAX_ANSWER_EXPRESSION_DEPTH = 8;
export const MAX_ANSWER_EXPRESSION_NODES = 31;
export const MAX_ANSWER_VALUE_MAGNITUDE = 1_000_000_000;

export type AnswerExpressionErrorCode =
  | 'empty'
  | 'too-long'
  | 'syntax'
  | 'unsafe-integer'
  | 'too-complex';

export type ParsedAnswerExpression = {
  expression: MathExpression;
  value: number;
  normalized: string;
  isPlainInteger: boolean;
};

export type AnswerExpressionValidation =
  | { ok: true; answer: ParsedAnswerExpression }
  | { ok: false; code: AnswerExpressionErrorCode; message: string };

type ParsedNode = {
  expression: MathExpression;
  value: number;
  depth: number;
};

class ParseFailure extends Error {
  constructor(readonly code: AnswerExpressionErrorCode) {
    super(code);
  }
}

const errorMessage = (code: AnswerExpressionErrorCode) => {
  switch (code) {
    case 'empty':
      return 'Enter a whole number or a short expression.';
    case 'too-long':
      return 'Keep the answer to one short expression.';
    case 'unsafe-integer':
      return 'Use smaller whole numbers.';
    case 'too-complex':
      return 'Keep the answer expression simple.';
    default:
      return 'Use whole numbers with +, −, ×, and parentheses.';
  }
};

class AnswerParser {
  private index = 0;
  private nodeCount = 0;
  private parenthesisDepth = 0;

  constructor(private readonly input: string) {}

  parse(): ParsedNode {
    const answer = this.parseAdditive();
    this.skipWhitespace();
    if (this.index !== this.input.length) this.fail('syntax');
    return answer;
  }

  private parseAdditive(): ParsedNode {
    let left = this.parseMultiplicative();
    while (true) {
      this.skipWhitespace();
      const operator = this.input[this.index];
      if (operator !== '+' && operator !== '-') return left;
      this.index += 1;
      left = this.combine(left, operator, this.parseMultiplicative());
    }
  }

  private parseMultiplicative(): ParsedNode {
    let left = this.parsePrimary();
    while (true) {
      this.skipWhitespace();
      if (this.input[this.index] !== '*') return left;
      this.index += 1;
      left = this.combine(left, '*', this.parsePrimary());
    }
  }

  private parsePrimary(): ParsedNode {
    this.skipWhitespace();
    if (this.input[this.index] === '(') {
      this.index += 1;
      this.parenthesisDepth += 1;
      if (this.parenthesisDepth > MAX_ANSWER_EXPRESSION_DEPTH) {
        this.fail('too-complex');
      }
      const inner = this.parseAdditive();
      this.skipWhitespace();
      if (this.input[this.index] !== ')') this.fail('syntax');
      this.index += 1;
      this.parenthesisDepth -= 1;
      return inner;
    }
    return this.parseInteger();
  }

  private parseInteger(): ParsedNode {
    this.skipWhitespace();
    const start = this.index;
    if (this.input[this.index] === '+' || this.input[this.index] === '-') {
      this.index += 1;
    }
    const digitStart = this.index;
    while (/\d/u.test(this.input[this.index] ?? '')) this.index += 1;
    if (digitStart === this.index) this.fail('syntax');

    const value = Number(this.input.slice(start, this.index));
    if (
      !Number.isSafeInteger(value) ||
      Math.abs(value) > MAX_ANSWER_VALUE_MAGNITUDE
    ) {
      this.fail('unsafe-integer');
    }
    this.countNode();
    return { expression: numberExpression(value), value, depth: 1 };
  }

  private combine(
    left: ParsedNode,
    operator: BinaryOperator,
    right: ParsedNode,
  ): ParsedNode {
    const value = evaluateBinary(left.value, operator, right.value);
    if (
      !Number.isSafeInteger(value) ||
      Math.abs(value) > MAX_ANSWER_VALUE_MAGNITUDE
    ) {
      this.fail('unsafe-integer');
    }
    const depth = Math.max(left.depth, right.depth) + 1;
    if (depth > MAX_ANSWER_EXPRESSION_DEPTH) this.fail('too-complex');
    this.countNode();
    return {
      expression: binaryExpression(left.expression, operator, right.expression),
      value,
      depth,
    };
  }

  private countNode() {
    this.nodeCount += 1;
    if (this.nodeCount > MAX_ANSWER_EXPRESSION_NODES) this.fail('too-complex');
  }

  private skipWhitespace() {
    while (/\s/u.test(this.input[this.index] ?? '')) this.index += 1;
  }

  private fail(code: AnswerExpressionErrorCode): never {
    throw new ParseFailure(code);
  }
}

export function parseAnswerExpression(rawInput: string): AnswerExpressionValidation {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { ok: false, code: 'empty', message: errorMessage('empty') };
  }
  if (trimmed.length > MAX_ANSWER_EXPRESSION_LENGTH) {
    return { ok: false, code: 'too-long', message: errorMessage('too-long') };
  }

  const normalizedOperators = trimmed
    .replaceAll('−', '-')
    .replace(/[xX×]/gu, '*');

  try {
    const parsed = new AnswerParser(normalizedOperators).parse();
    return {
      ok: true,
      answer: {
        expression: parsed.expression,
        value: parsed.value,
        normalized: formatExpression(parsed.expression),
        isPlainInteger: parsed.expression.type === 'number',
      },
    };
  } catch (error) {
    const code = error instanceof ParseFailure ? error.code : 'syntax';
    return { ok: false, code, message: errorMessage(code) };
  }
}
