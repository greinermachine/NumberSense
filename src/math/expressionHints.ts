import { formatExpression, simplifyNext } from './expression';
import type { BinaryOperator, ExpressionPath, MathExpression } from './types';

export type FriendlySuggestion = {
  path: ExpressionPath;
  value: number;
  kind: 'nearby' | 'factor';
  nearby?: number;
  input: string;
  display: string;
};

export type ExpressionAssistance = {
  level: number;
  message: string;
  suggestion?: FriendlySuggestion;
  rescue?: {
    before: string;
    value: number;
  };
};

function suggestValue(value: number): Omit<FriendlySuggestion, 'path'> | null {
  if (!Number.isSafeInteger(value) || value < 2) return null;
  if (value >= 10 && value % 10 !== 0) {
    const below = Math.floor(value / 10) * 10;
    const above = Math.ceil(value / 10) * 10;
    const nearby = value - below < above - value ? below : above;
    const difference = Math.abs(nearby - value);
    if (difference > 0 && difference <= 5) {
      return nearby > value
        ? {
            value,
            kind: 'nearby' as const,
            nearby,
            input: `${nearby}-${difference}`,
            display: `${value} = ${nearby} − ${difference}`,
          }
        : {
            value,
            kind: 'nearby' as const,
            nearby,
            input: `${nearby}+${difference}`,
            display: `${value} = ${nearby} + ${difference}`,
          };
    }
  }
  if (value >= 6 && value < 10) {
    const difference = 10 - value;
    return {
      value,
      kind: 'nearby',
      nearby: 10,
      input: `10-${difference}`,
      display: `${value} = 10 − ${difference}`,
    };
  }
  return null;
}

function suggestFactor(value: number): Omit<FriendlySuggestion, 'path'> | null {
  if (!Number.isSafeInteger(value) || value < 20 || value % 10 !== 0) return null;
  const factor = value / 10;
  if (!Number.isSafeInteger(factor) || factor <= 1) return null;
  return {
    value,
    kind: 'factor',
    input: `${factor}*10`,
    display: `${value} = ${factor} × 10`,
  };
}

function collectSuggestions(
  expression: MathExpression,
  path: ExpressionPath,
  parentOperator: BinaryOperator | undefined,
  suggestions: FriendlySuggestion[],
) {
  if (expression.type === 'number') {
    const suggestion = parentOperator === '*'
      ? suggestFactor(expression.value) ?? suggestValue(expression.value)
      : suggestValue(expression.value);
    if (suggestion) suggestions.push({ ...suggestion, path });
    return;
  }
  collectSuggestions(expression.left, [...path, 'left'], expression.operator, suggestions);
  collectSuggestions(expression.right, [...path, 'right'], expression.operator, suggestions);
}

function containsMultiplication(expression: MathExpression): boolean {
  return expression.type === 'binary' &&
    (expression.operator === '*' ||
      containsMultiplication(expression.left) ||
      containsMultiplication(expression.right));
}

export function findFriendlySuggestion(
  expression: MathExpression,
): FriendlySuggestion | undefined {
  const candidates: FriendlySuggestion[] = [];
  collectSuggestions(expression, [], undefined, candidates);

  return candidates.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'factor' ? -1 : 1;
    const scaleA = a.value >= 10 ? 1 : 0;
    const scaleB = b.value >= 10 ? 1 : 0;
    if (scaleA !== scaleB) return scaleB - scaleA;
    return a.path.join('.').localeCompare(b.path.join('.'));
  })[0];
}

export function createExpressionAssistance(
  expression: MathExpression,
  hintCount: number,
  attemptCount: number,
  depthReached: boolean,
): ExpressionAssistance | undefined {
  // Both actions are evidence that the learner is still working through the
  // expression. Adding them ensures an explicit hint always advances beyond
  // any gentle clue already surfaced by a wrong attempt.
  const level = Math.min(5, hintCount + attemptCount);
  if (level === 0 && !depthReached) return undefined;

  const suggestion = depthReached ? undefined : findFriendlySuggestion(expression);
  const multiplication = containsMultiplication(expression);
  if (depthReached || level >= 5) {
    const rescue = simplifyNext(expression);
    return {
      level: 5,
      message: depthReached
        ? 'This one has turned enough. Take the next step with me.'
        : 'Take one small calculation at a time.',
      ...(rescue
        ? {
            rescue: {
              before: formatExpression(rescue.before),
              value: rescue.value,
            },
          }
        : {}),
    };
  }

  if (level === 1) {
    return {
      level,
      message: multiplication
        ? 'Can either number become easier pieces?'
        : 'Can either number become friendlier?',
    };
  }
  if (level === 2) {
    return {
      level,
      message: suggestion ? `Look at ${suggestion.value}.` : 'Turn one over?',
    };
  }
  if (level === 3) {
    return {
      level,
      message: suggestion
        ? suggestion.kind === 'factor'
          ? `${suggestion.value} has a 10 hiding inside it.`
          : `${suggestion.value} is close to ${suggestion.nearby}.`
        : multiplication
          ? 'Try changing one of the factors.'
          : 'Try changing one of the numbers.',
    };
  }
  return suggestion
    ? {
        level: 4,
        message: `Have you considered ${suggestion.display}?`,
        suggestion,
      }
    : {
        level: 4,
        message: 'This expression is ready to finish as it stands.',
      };
}
