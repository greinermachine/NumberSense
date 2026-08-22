import { evaluateBinary } from './decomposition';
import type {
  BinaryOperator,
  ExpressionPath,
  MathExpression,
  ParsedDecomposition,
} from './types';

export const MAX_RECURSIVE_MANIPULATIONS = 3;

export type NumberNode = {
  path: ExpressionPath;
  value: number;
};

export type ExpressionTransformFrame = {
  kind: 'replace' | 'sign' | 'simplify';
  expression: MathExpression;
  display: string;
};

export type ExpressionTransformation = {
  frames: ExpressionTransformFrame[];
  finalExpression: MathExpression;
};

export type Simplification = {
  path: ExpressionPath;
  before: MathExpression;
  value: number;
  expression: MathExpression;
};

const glyph = (operator: BinaryOperator) =>
  operator === '*' ? '×' : operator === '-' ? '−' : '+';

const pathKey = (path: readonly string[]) => path.join('.');

export function numberExpression(value: number): MathExpression {
  return { type: 'number', value };
}

export function binaryExpression(
  left: MathExpression,
  operator: BinaryOperator,
  right: MathExpression,
): MathExpression {
  return { type: 'binary', operator, left, right };
}

export function decompositionExpression(
  decomposition: ParsedDecomposition,
): MathExpression {
  return binaryExpression(
    numberExpression(decomposition.left),
    decomposition.operator,
    numberExpression(decomposition.right),
  );
}

export function evaluateExpression(expression: MathExpression): number {
  if (expression.type === 'number') return expression.value;
  return evaluateBinary(
    evaluateExpression(expression.left),
    expression.operator,
    evaluateExpression(expression.right),
  );
}

function precedence(expression: MathExpression) {
  if (expression.type === 'number') return 3;
  return expression.operator === '*' ? 2 : 1;
}

function needsParentheses(
  child: MathExpression,
  parentOperator: BinaryOperator,
  side: 'left' | 'right',
) {
  if (child.type === 'number') return false;
  const childPrecedence = precedence(child);
  const parentPrecedence = parentOperator === '*' ? 2 : 1;
  if (childPrecedence < parentPrecedence) return true;
  return side === 'right' && parentOperator === '-' && childPrecedence === parentPrecedence;
}

export function formatExpression(
  expression: MathExpression,
  forceGroupPath?: ExpressionPath,
): string {
  const forcedKey = forceGroupPath ? pathKey(forceGroupPath) : undefined;

  const format = (
    current: MathExpression,
    path: ExpressionPath,
    parentOperator?: BinaryOperator,
    side?: 'left' | 'right',
  ): string => {
    if (current.type === 'number') return String(current.value).replace('-', '−');
    const left = format(current.left, [...path, 'left'], current.operator, 'left');
    const right = format(current.right, [...path, 'right'], current.operator, 'right');
    const text = `${left} ${glyph(current.operator)} ${right}`;
    const forced = path.length > 0 && pathKey(path) === forcedKey;
    const structural =
      parentOperator && side ? needsParentheses(current, parentOperator, side) : false;
    return forced || structural ? `(${text})` : text;
  };

  return format(expression, []);
}

export function speakExpression(expression: MathExpression): string {
  return formatExpression(expression)
    .replaceAll('×', ' times ')
    .replaceAll('−', ' minus ')
    .replaceAll('+', ' plus ')
    .replaceAll('(', ' open parenthesis ')
    .replaceAll(')', ' close parenthesis ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function listNumberNodes(
  expression: MathExpression,
  path: ExpressionPath = [],
): NumberNode[] {
  if (expression.type === 'number') return [{ path, value: expression.value }];
  return [
    ...listNumberNodes(expression.left, [...path, 'left']),
    ...listNumberNodes(expression.right, [...path, 'right']),
  ];
}

export function numberAtPath(
  expression: MathExpression,
  path: ExpressionPath,
): number | null {
  let current = expression;
  for (const branch of path) {
    if (current.type !== 'binary') return null;
    current = current[branch];
  }
  return current.type === 'number' ? current.value : null;
}

export function replaceNumberAtPath(
  expression: MathExpression,
  path: ExpressionPath,
  replacement: MathExpression,
): MathExpression | null {
  if (path.length === 0) {
    return expression.type === 'number' ? replacement : null;
  }
  if (expression.type !== 'binary') return null;
  const [branch, ...rest] = path;
  const replaced = replaceNumberAtPath(expression[branch], rest, replacement);
  if (!replaced) return null;
  return branch === 'left'
    ? binaryExpression(replaced, expression.operator, expression.right)
    : binaryExpression(expression.left, expression.operator, replaced);
}

type SignedTerm = { sign: 1 | -1; expression: MathExpression };

function collectAdditiveTerms(
  expression: MathExpression,
  sign: 1 | -1,
  terms: SignedTerm[],
) {
  if (expression.type === 'binary' && expression.operator === '+') {
    collectAdditiveTerms(expression.left, sign, terms);
    collectAdditiveTerms(expression.right, sign, terms);
    return;
  }
  if (expression.type === 'binary' && expression.operator === '-') {
    collectAdditiveTerms(expression.left, sign, terms);
    collectAdditiveTerms(expression.right, sign === 1 ? -1 : 1, terms);
    return;
  }
  terms.push({ sign, expression });
}

function rebuildAdditiveTerms(terms: SignedTerm[]): MathExpression {
  const [first, ...rest] = terms;
  let expression = first.sign === 1
    ? first.expression
    : binaryExpression(numberExpression(0), '-', first.expression);
  for (const term of rest) {
    expression = binaryExpression(
      expression,
      term.sign === 1 ? '+' : '-',
      term.expression,
    );
  }
  return expression;
}

function normalizeInsertedAdditive(
  original: MathExpression,
  selectedPath: ExpressionPath,
  decomposition: MathExpression & { type: 'binary' },
  replaced: MathExpression,
): MathExpression {
  if (
    original.type === 'binary' &&
    original.left.type === 'number' &&
    original.right.type === 'number' &&
    selectedPath.length === 1 &&
    selectedPath[0] === 'left' &&
    (original.operator === '+' || original.operator === '-')
  ) {
    const firstPair = original.operator === '+'
      ? binaryExpression(original.right, '+', decomposition.left)
      : binaryExpression(decomposition.left, '-', original.right);
    return binaryExpression(firstPair, decomposition.operator, decomposition.right);
  }

  const terms: SignedTerm[] = [];
  collectAdditiveTerms(replaced, 1, terms);
  return rebuildAdditiveTerms(terms);
}

function simplifiablePath(
  expression: MathExpression,
  path: ExpressionPath = [],
): ExpressionPath | null {
  if (expression.type === 'number') return null;
  const left = simplifiablePath(expression.left, [...path, 'left']);
  if (left) return left;
  const right = simplifiablePath(expression.right, [...path, 'right']);
  if (right) return right;
  return path.length > 0 &&
    expression.left.type === 'number' &&
    expression.right.type === 'number'
    ? path
    : null;
}

function expressionAtPath(
  expression: MathExpression,
  path: ExpressionPath,
): MathExpression | null {
  let current = expression;
  for (const branch of path) {
    if (current.type !== 'binary') return null;
    current = current[branch];
  }
  return current;
}

function replaceExpressionAtPath(
  expression: MathExpression,
  path: ExpressionPath,
  replacement: MathExpression,
): MathExpression | null {
  if (path.length === 0) return replacement;
  if (expression.type !== 'binary') return null;
  const [branch, ...rest] = path;
  const replaced = replaceExpressionAtPath(expression[branch], rest, replacement);
  if (!replaced) return null;
  return branch === 'left'
    ? binaryExpression(replaced, expression.operator, expression.right)
    : binaryExpression(expression.left, expression.operator, replaced);
}

function hasMultiplicationAncestor(
  expression: MathExpression,
  path: ExpressionPath,
): boolean {
  let current = expression;
  for (const branch of path) {
    if (current.type !== 'binary') return false;
    if (current.operator === '*') return true;
    current = current[branch];
  }
  return false;
}

export function simplifyNext(expression: MathExpression): Simplification | null {
  const path = simplifiablePath(expression) ??
    (expression.type === 'binary' &&
    expression.left.type === 'number' &&
    expression.right.type === 'number'
      ? []
      : null);
  if (!path) return null;
  const before = expressionAtPath(expression, path);
  if (!before || before.type !== 'binary') return null;
  const value = evaluateExpression(before);
  const simplified = replaceExpressionAtPath(
    expression,
    path,
    numberExpression(value),
  );
  return simplified ? { path, before, value, expression: simplified } : null;
}

export function transformNumberNode(
  expression: MathExpression,
  path: ExpressionPath,
  decomposition: ParsedDecomposition,
): ExpressionTransformation | null {
  if (numberAtPath(expression, path) !== decomposition.result) return null;
  const inserted = decompositionExpression(decomposition);
  const replaced = replaceNumberAtPath(expression, path, inserted);
  if (!replaced) return null;

  const frames: ExpressionTransformFrame[] = [
    {
      kind: 'replace',
      expression: replaced,
      display: formatExpression(replaced, path),
    },
  ];
  let finalExpression = replaced;

  if (
    (decomposition.operator === '+' || decomposition.operator === '-') &&
    !hasMultiplicationAncestor(expression, path)
  ) {
    const normalized = normalizeInsertedAdditive(
      expression,
      path,
      inserted as MathExpression & { type: 'binary' },
      replaced,
    );
    frames.push({
      kind: 'sign',
      expression: normalized,
      display: formatExpression(normalized),
    });
    finalExpression = normalized;

    const simplification = simplifyNext(normalized);
    if (simplification && simplification.path.length > 0) {
      finalExpression = simplification.expression;
      frames.push({
        kind: 'simplify',
        expression: finalExpression,
        display: formatExpression(finalExpression),
      });
    }
  }

  return { frames, finalExpression };
}
