import { canonicalDecompositionKey } from '../math/decomposition';
import type { ParsedDecomposition } from '../math/types';
import type { ProblemDefinition, TeachingView } from './types';

export function teachingViewKey(view: TeachingView): string {
  return `${view.side}:${canonicalDecompositionKey(view)}`;
}

/** Selects only from the problem's authored teaching boundary. */
export function selectTeachingView(
  problem: ProblemDefinition,
  discoveries: readonly { side: 'left' | 'right'; expression: ParsedDecomposition }[],
): TeachingView {
  const used = new Set(
    discoveries.map(
      ({ side, expression }) => `${side}:${canonicalDecompositionKey(expression)}`,
    ),
  );

  const latestOperator = discoveries.at(-1)?.expression.operator;
  const latestSide = discoveries.at(-1)?.side;
  return (
    problem.teachingViews.find(
      (view) =>
        !used.has(teachingViewKey(view)) &&
        view.side !== latestSide &&
        view.operator !== latestOperator,
    ) ??
    problem.teachingViews.find(
      (view) => !used.has(teachingViewKey(view)) && view.side !== latestSide,
    ) ??
    problem.teachingViews.find(
      (view) => !used.has(teachingViewKey(view)) && view.operator !== latestOperator,
    ) ??
    problem.teachingViews.find((view) => !used.has(teachingViewKey(view))) ??
    problem.teachingViews[0]
  );
}

export function formatTeachingView(view: TeachingView): string {
  const operator = view.operator === '*' ? '×' : view.operator === '-' ? '−' : '+';
  return `${view.left} ${operator} ${view.right}`;
}
