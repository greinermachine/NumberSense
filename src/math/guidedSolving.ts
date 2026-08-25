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
    const firstExpression = selectedSide === 'left'
      ? binaryExpression(numberExpression(expression.left), '*', numberExpression(other))
      : binaryExpression(numberExpression(other), '*', numberExpression(expression.left));
    const secondExpression = selectedSide === 'left'
      ? binaryExpression(numberExpression(expression.right), '*', numberExpression(other))
      : binaryExpression(numberExpression(other), '*', numberExpression(expression.right));
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
      workingExpression: binaryExpression(
        firstExpression,
        expression.operator,
        secondExpression,
      ),
      steps: [
        {
          id: 'partial-a',
          before: firstBefore,
          expected: first,
          purpose: 'partial',
          path: ['left'],
        },
        {
          id: 'partial-b',
          before: secondBefore,
          expected: second,
          purpose: 'partial',
          path: ['right'],
        },
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
  const firstExpression = selectedSide === 'left'
    ? binaryExpression(numberExpression(expression.right), '*', numberExpression(other))
    : binaryExpression(numberExpression(other), '*', numberExpression(expression.left));
  const workingExpression = selectedSide === 'left'
    ? binaryExpression(numberExpression(expression.left), '*', firstExpression)
    : binaryExpression(firstExpression, '*', numberExpression(expression.right));

  return {
    expressionLabel,
    family: 'regroup',
    workingExpression,
    steps: [
      {
        id: 'regroup-a',
        before: firstBefore,
        expected: first,
        purpose: 'partial',
        path: [selectedSide === 'left' ? 'right' : 'left'],
      },
      {
        id: 'regroup-b',
        before: secondBefore,
        expected: wholeLeft * wholeRight,
        purpose: 'combine',
        path: [],
      },
    ],
    completion: { type: 'answer', value: wholeLeft * wholeRight },
  };
}
