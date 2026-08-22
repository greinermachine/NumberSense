import { canonicalDecompositionKey } from '../math/decomposition';
import type { ParsedDecomposition } from '../math/types';
import type { AlternateView, ProblemDefinition } from './types';

export function alternateViewKey(view: AlternateView): string {
  return `${view.side}:${canonicalDecompositionKey(view)}`;
}

export function selectAlternateView(
  problem: ProblemDefinition,
  discoveries: readonly { side: 'left' | 'right'; expression: ParsedDecomposition }[],
): AlternateView {
  const used = new Set(
    discoveries.map(
      ({ side, expression }) => `${side}:${canonicalDecompositionKey(expression)}`,
    ),
  );

  const latestOperator = discoveries.at(-1)?.expression.operator;
  const latestSide = discoveries.at(-1)?.side;
  return (
    problem.alternateViews.find(
      (view) =>
        !used.has(alternateViewKey(view)) &&
        view.side !== latestSide &&
        view.operator !== latestOperator,
    ) ??
    problem.alternateViews.find(
      (view) => !used.has(alternateViewKey(view)) && view.side !== latestSide,
    ) ??
    problem.alternateViews.find(
      (view) => !used.has(alternateViewKey(view)) && view.operator !== latestOperator,
    ) ??
    problem.alternateViews.find((view) => !used.has(alternateViewKey(view))) ??
    problem.alternateViews[0]
  );
}

export function formatAlternateView(view: AlternateView): string {
  const operator = view.operator === '*' ? '×' : view.operator === '-' ? '−' : '+';
  return `${view.left} ${operator} ${view.right}`;
}
