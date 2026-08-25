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
  kind:
    | 'answer'
    | 'replace'
    | 'sign'
    | 'reassociate'
    | 'distribute'
    | 'reorder'
    | 'regroup'
    | 'simplify';
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

export function expressionAtPath(
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

export function replaceExpressionAtPath(
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

export function flattenMultiplication(expression: MathExpression): MathExpression[] {
  if (expression.type !== 'binary' || expression.operator !== '*') return [expression];
  return [
    ...flattenMultiplication(expression.left),
    ...flattenMultiplication(expression.right),
  ];
}

function buildMultiplication(factors: MathExpression[]): MathExpression {
  const [first, ...rest] = factors;
  return rest.reduce(
    (current, factor) => binaryExpression(current, '*', factor),
    first,
  );
}

function multiplicationChainPath(
  expression: MathExpression,
  path: ExpressionPath,
): ExpressionPath | null {
  let current = expression;
  let currentPath: ExpressionPath = [];
  let chainPath: ExpressionPath | null = null;
  let insideChain = false;
  for (const branch of path) {
    if (current.type !== 'binary') return null;
    if (current.operator === '*') {
      if (!insideChain) chainPath = currentPath;
      insideChain = true;
    } else {
      chainPath = null;
      insideChain = false;
    }
    current = current[branch];
    currentPath = [...currentPath, branch];
  }
  return chainPath;
}

function hasNegativeAdditiveContext(
  expression: MathExpression,
  path: ExpressionPath,
): boolean {
  let current = expression;
  let sign = 1;
  for (const branch of path) {
    if (current.type !== 'binary') return false;
    if (current.operator === '-' && branch === 'right') sign *= -1;
    current = current[branch];
  }
  return sign === -1;
}

function distributeInsertedFactor(
  replaced: MathExpression,
  chainPath: ExpressionPath,
  inserted: MathExpression & { type: 'binary'; operator: '+' | '-' },
): MathExpression | null {
  const chain = expressionAtPath(replaced, chainPath);
  if (!chain) return null;
  const factors = flattenMultiplication(chain);
  const insertedIndex = factors.indexOf(inserted);
  if (insertedIndex < 0) return null;
  const withBranch = (branch: MathExpression) => {
    const next = [...factors];
    next[insertedIndex] = branch;
    return buildMultiplication(next);
  };
  return replaceExpressionAtPath(
    replaced,
    chainPath,
    binaryExpression(
      withBranch(inserted.left),
      inserted.operator,
      withBranch(inserted.right),
    ),
  );
}

function isPowerOfTenFactor(expression: MathExpression) {
  if (expression.type !== 'number' || expression.value < 10) return false;
  let value = expression.value;
  while (value > 1 && value % 10 === 0) value /= 10;
  return value === 1;
}

function regroupInsertedFactors(
  replaced: MathExpression,
  chainPath: ExpressionPath,
  inserted: MathExpression & { type: 'binary'; operator: '*' },
): { frames: ExpressionTransformFrame[]; expression: MathExpression } | null {
  const chain = expressionAtPath(replaced, chainPath);
  if (!chain) return null;
  const factors = flattenMultiplication(chain);
  if (factors.some((factor) => factor.type !== 'number')) return null;
  const insertedFactors = flattenMultiplication(inserted);
  const otherFactors = factors.filter((factor) => !insertedFactors.includes(factor));
  if (otherFactors.length === 0) return null;

  const primary = insertedFactors.find((factor) => !isPowerOfTenFactor(factor)) ??
    insertedFactors[0];
  const scaleFactors = insertedFactors.filter(
    (factor) => factor !== primary && isPowerOfTenFactor(factor),
  );
  const remainingInserted = insertedFactors.filter(
    (factor) => factor !== primary && !scaleFactors.includes(factor),
  );
  const ordered = [
    primary,
    otherFactors[0],
    ...otherFactors.slice(1),
    ...remainingInserted,
    ...scaleFactors,
  ];
  if (ordered.length < 3) return null;

  const frames: ExpressionTransformFrame[] = [];
  const reorderedChain = buildMultiplication(ordered);
  const reordered = replaceExpressionAtPath(replaced, chainPath, reorderedChain);
  if (!reordered) return null;
  if (formatExpression(reordered) !== formatExpression(replaced)) {
    frames.push({
      kind: 'reorder',
      expression: reordered,
      display: formatExpression(reordered),
    });
  }

  const pair = binaryExpression(ordered[0], '*', ordered[1]);
  const rest = ordered.slice(2);
  const groupedChain = binaryExpression(pair, '*', buildMultiplication(rest));
  const grouped = replaceExpressionAtPath(reordered, chainPath, groupedChain);
  if (!grouped) return null;
  frames.push({
    kind: 'regroup',
    expression: grouped,
    display: formatExpression(grouped, [...chainPath, 'left']),
  });

  const pairValue = evaluateExpression(pair);
  const simplifiedChain = buildMultiplication([
    numberExpression(pairValue),
    ...rest,
  ]);
  const simplified = replaceExpressionAtPath(grouped, chainPath, simplifiedChain);
  if (!simplified) return null;
  frames.push({
    kind: 'simplify',
    expression: simplified,
    display: formatExpression(simplified),
  });

  const settled = replaceExpressionAtPath(
    simplified,
    chainPath,
    numberExpression(evaluateExpression(simplifiedChain)),
  );
  if (!settled) return null;
  frames.push({
    kind: 'simplify',
    expression: settled,
    display: formatExpression(settled),
  });
  return { frames, expression: settled };
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
  const chainPath = multiplicationChainPath(expression, path);

  if (
    chainPath &&
    (decomposition.operator === '+' || decomposition.operator === '-')
  ) {
    const distributed = distributeInsertedFactor(
      replaced,
      chainPath,
      inserted as MathExpression & {
        type: 'binary';
        operator: '+' | '-';
      },
    );
    if (distributed) {
      frames.push({
        kind: 'distribute',
        expression: distributed,
        display: formatExpression(distributed),
      });
      return { frames, finalExpression: distributed };
    }
  }

  if (chainPath && decomposition.operator === '*') {
    const regrouped = regroupInsertedFactors(
      replaced,
      chainPath,
      inserted as MathExpression & { type: 'binary'; operator: '*' },
    );
    if (regrouped) {
      frames.push(...regrouped.frames);
      return { frames, finalExpression: regrouped.expression };
    }
  }

  if (
    decomposition.operator === '+' || decomposition.operator === '-'
  ) {
    const normalized = normalizeInsertedAdditive(
      expression,
      path,
      inserted as MathExpression & { type: 'binary' },
      replaced,
    );
    frames.push({
      kind: hasNegativeAdditiveContext(expression, path) ? 'sign' : 'reassociate',
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
