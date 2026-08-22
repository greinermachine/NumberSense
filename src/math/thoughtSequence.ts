import type { AlternateView, ProblemDefinition } from '../data/types';
import type { OperandSide, ParsedDecomposition } from './types';

export type ThoughtPartTone = 'quiet' | 'player' | 'focus' | 'operator' | 'answer';

export type ThoughtPart = {
  id: string;
  text: string;
  tone?: ThoughtPartTone;
};

export type ThoughtStepKind =
  | 'player'
  | 'focus'
  | 'decompose'
  | 'transform'
  | 'simplify'
  | 'result'
  | 'handoff';

export type ThoughtStep = {
  id: string;
  kind: ThoughtStepKind;
  annotation?: string;
  expression: string;
  accessibleExpression: string;
  parts: ThoughtPart[];
  emphasisSide?: OperandSide;
  autoAdvanceMs?: number;
  extendsLine?: boolean;
  equivalence: {
    value: number;
    target: number;
  };
};

export type PlayerThought = {
  side: OperandSide;
  expression: ParsedDecomposition;
};

const operatorGlyph = (operator: AlternateView['operator']) =>
  operator === '*' ? '×' : operator === '-' ? '−' : '+';

const grouped = (view: Pick<AlternateView, 'left' | 'operator' | 'right'>) =>
  `(${view.left} ${operatorGlyph(view.operator)} ${view.right})`;

const ungrouped = (view: Pick<AlternateView, 'left' | 'operator' | 'right'>) =>
  `${view.left} ${operatorGlyph(view.operator)} ${view.right}`;

const part = (id: string, text: string, tone?: ThoughtPartTone): ThoughtPart => ({
  id,
  text,
  ...(tone ? { tone } : {}),
});

function speak(expression: string): string {
  return expression
    .replaceAll('×', ' times ')
    .replaceAll('−', ' minus ')
    .replaceAll('+', ' plus ')
    .replaceAll('=', ' equals ')
    .replaceAll('(', ' open parenthesis ')
    .replaceAll(')', ' close parenthesis ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeStep(
  step: Omit<ThoughtStep, 'expression' | 'accessibleExpression'>,
): ThoughtStep {
  const expression = step.parts.map(({ text }) => text).join(' ');
  return {
    ...step,
    expression,
    accessibleExpression: speak(expression),
  };
}

function originalParts(
  problem: ProblemDefinition,
  focusSide?: OperandSide,
  quietSide?: OperandSide,
): ThoughtPart[] {
  const tone = (side: OperandSide): ThoughtPartTone | undefined => {
    if (side === focusSide) return 'focus';
    if (side === quietSide) return 'quiet';
    return undefined;
  };
  return [
    part('whole-left', String(problem.left), tone('left')),
    part('multiply', '×', 'operator'),
    part('whole-right', String(problem.right), tone('right')),
  ];
}

function decomposedParts(
  problem: ProblemDefinition,
  view: Pick<AlternateView, 'side' | 'left' | 'operator' | 'right'>,
  tone: ThoughtPartTone,
): ThoughtPart[] {
  const group = part('decomposition', grouped(view), tone);
  return view.side === 'left'
    ? [group, part('multiply', '×', 'operator'), part('whole-right', String(problem.right))]
    : [part('whole-left', String(problem.left)), part('multiply', '×', 'operator'), group];
}

function finalParts(problem: ProblemDefinition, answer: number): ThoughtPart[] {
  return [
    part('whole-left', String(problem.left)),
    part('multiply', '×', 'operator'),
    part('whole-right', String(problem.right)),
    part('equals', '=', 'operator'),
    part('answer', String(answer), 'answer'),
  ];
}

export function createThoughtSequence(
  problem: ProblemDefinition,
  alternate: AlternateView,
  player?: PlayerThought,
): ThoughtStep[] {
  const answer = problem.left * problem.right;
  const alternateOperand = alternate.side === 'left' ? problem.left : problem.right;
  const otherOperand = alternate.side === 'left' ? problem.right : problem.left;
  const quietSide = player && player.side !== alternate.side ? player.side : undefined;
  const playerParts = player
    ? decomposedParts(problem, { side: player.side, ...player.expression }, 'player')
    : finalParts(problem, answer);

  const steps: ThoughtStep[] = [
    makeStep({
      id: 'player-thought',
      kind: 'player',
      annotation: player ? 'You saw…' : 'You knew it.',
      parts: playerParts,
      emphasisSide: player?.side,
      autoAdvanceMs: 700,
      equivalence: { value: answer, target: answer },
    }),
    makeStep({
      id: 'shift-attention',
      kind: 'focus',
      annotation: 'I looked over here.',
      parts: originalParts(problem, alternate.side, quietSide),
      emphasisSide: alternate.side,
      equivalence: { value: answer, target: answer },
    }),
    makeStep({
      id: 'alternate-decomposition',
      kind: 'decompose',
      parts: decomposedParts(problem, alternate, 'focus'),
      emphasisSide: alternate.side,
      equivalence: { value: answer, target: answer },
    }),
  ];

  if (alternate.operator === '+' || alternate.operator === '-') {
    const firstProduct = alternate.left * otherOperand;
    const secondProduct = alternate.right * otherOperand;
    const result = alternate.operator === '+'
      ? firstProduct + secondProduct
      : firstProduct - secondProduct;
    const combineOperator = operatorGlyph(alternate.operator);
    const expanded = alternate.side === 'left'
      ? [
          part('first-left', String(alternate.left), 'focus'),
          part('first-multiply', '×', 'operator'),
          part('first-right', String(otherOperand)),
          part('combine', combineOperator, 'operator'),
          part('second-left', String(alternate.right), 'focus'),
          part('second-multiply', '×', 'operator'),
          part('second-right', String(otherOperand)),
        ]
      : [
          part('first-left', String(otherOperand)),
          part('first-multiply', '×', 'operator'),
          part('first-right', String(alternate.left), 'focus'),
          part('combine', combineOperator, 'operator'),
          part('second-left', String(otherOperand)),
          part('second-multiply', '×', 'operator'),
          part('second-right', String(alternate.right), 'focus'),
        ];

    steps.push(
      makeStep({
        id: 'distribute',
        kind: 'transform',
        parts: expanded,
        emphasisSide: alternate.side,
        equivalence: { value: result, target: answer },
      }),
      makeStep({
        id: 'combine-parts',
        kind: 'simplify',
        parts: [
          part('first-product', String(firstProduct), 'player'),
          part('combine', combineOperator, 'operator'),
          part('second-product', String(secondProduct), 'player'),
        ],
        equivalence: { value: result, target: answer },
      }),
    );
  } else {
    const firstProduct = alternate.side === 'left'
      ? alternate.right * otherOperand
      : otherOperand * alternate.left;
    const regrouped = alternate.side === 'left'
      ? [
          part('factor-a', String(alternate.left), 'focus'),
          part('multiply-a', '×', 'operator'),
          part('factor-group', `(${alternate.right} × ${otherOperand})`, 'player'),
        ]
      : [
          part('factor-group', `(${otherOperand} × ${alternate.left})`, 'player'),
          part('multiply-b', '×', 'operator'),
          part('factor-b', String(alternate.right), 'focus'),
        ];
    const partial = alternate.side === 'left'
      ? [
          part('factor-a', String(alternate.left), 'focus'),
          part('multiply', '×', 'operator'),
          part('partial', String(firstProduct), 'player'),
        ]
      : [
          part('partial', String(firstProduct), 'player'),
          part('multiply', '×', 'operator'),
          part('factor-b', String(alternate.right), 'focus'),
        ];

    steps.push(
      makeStep({
        id: 'regroup',
        kind: 'transform',
        parts: regrouped,
        emphasisSide: alternate.side,
        equivalence: { value: answer, target: answer },
      }),
      makeStep({
        id: 'regroup-partial',
        kind: 'simplify',
        parts: partial,
        equivalence: { value: answer, target: answer },
      }),
    );
  }

  steps.push(
    makeStep({
      id: 'same-answer',
      kind: 'result',
      annotation: 'Same answer.',
      parts: finalParts(problem, answer),
      equivalence: { value: answer, target: answer },
    }),
    makeStep({
      id: 'line-handoff',
      kind: 'handoff',
      annotation: 'Not better. Another door.',
      parts: [
        part('operand', String(alternateOperand), 'quiet'),
        part('equals', '=', 'operator'),
        part('alternate', ungrouped(alternate), 'focus'),
      ],
      emphasisSide: alternate.side,
      extendsLine: true,
      equivalence: { value: alternateOperand, target: alternateOperand },
    }),
  );

  return steps;
}
