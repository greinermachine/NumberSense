import type { GuidedPlan, OperandSide, ParsedDecomposition } from './types';
import { binaryExpression, numberExpression } from './expression';

export function createGuidedPlan(
  wholeLeft: number,
  wholeRight: number,
  selectedSide: OperandSide,
  expression: ParsedDecomposition,
): GuidedPlan {
  const other = selectedSide === 'left' ? wholeRight : wholeLeft;
  const expressionLabel =
    selectedSide === 'left'
      ? `(${expression.normalized}) × ${other}`
      : `${other} × (${expression.normalized})`;

  if (expression.operator === '+' || expression.operator === '-') {
    const first = expression.left * other;
    const second = expression.right * other;
    const firstBefore =
      selectedSide === 'left'
        ? `${expression.left} × ${other} =`
        : `${other} × ${expression.left} =`;
    const secondBefore =
      selectedSide === 'left'
        ? `${expression.right} × ${other} =`
        : `${other} × ${expression.right} =`;

    return {
      expressionLabel,
      family: 'distribute',
      steps: [
        { id: 'partial-a', before: firstBefore, expected: first, purpose: 'partial' },
        { id: 'partial-b', before: secondBefore, expected: second, purpose: 'partial' },
      ],
      completion: {
        type: 'expression',
        expression: binaryExpression(
          numberExpression(first),
          expression.operator,
          numberExpression(second),
        ),
      },
    };
  }

  const first =
    selectedSide === 'left'
      ? expression.right * other
      : other * expression.left;
  const firstBefore =
    selectedSide === 'left'
      ? `${expression.right} × ${other} =`
      : `${other} × ${expression.left} =`;
  const secondBefore =
    selectedSide === 'left'
      ? `${expression.left} × ${first} =`
      : `${first} × ${expression.right} =`;

  return {
    expressionLabel,
    family: 'regroup',
    steps: [
      { id: 'regroup-a', before: firstBefore, expected: first, purpose: 'partial' },
      {
        id: 'regroup-b',
        before: secondBefore,
        expected: wholeLeft * wholeRight,
        purpose: 'combine',
      },
    ],
    completion: { type: 'answer', value: wholeLeft * wholeRight },
  };
}
