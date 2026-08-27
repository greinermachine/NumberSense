import type { ProblemDefinition } from '../../data/types';
import { gameReducer, createInitialGameState } from '../../game/gameReducer';
import type { GameAction, GameBase, GameState } from '../../game/types';
import { parseDecomposition } from '../../math/decomposition';
import {
  binaryExpression,
  formatExpression,
  numberExpression,
  simplifyNext,
  transformNumberNode,
  type ExpressionTransformFrame,
} from '../../math/expression';

export const TUTORIAL_PROBLEM: ProblemDefinition = {
  id: 'tutorial-24x19',
  left: 24,
  right: 19,
  tier: 'warm',
  hint: { side: 'right', text: 'What is one more than 19?' },
  teachingViews: [
    { side: 'right', left: 20, operator: '-', right: 1, rationaleTag: 'nearby-round-number' },
    { side: 'left', left: 20, operator: '+', right: 4, rationaleTag: 'split-place-value' },
    { side: 'left', left: 6, operator: '*', right: 4, rationaleTag: 'factor-rearrangement' },
  ],
};

export type TutorialAction = GameAction | { type: 'RESET_TUTORIAL' };

function toBase(state: GameState): GameBase {
  return {
    dateKey: state.dateKey,
    dailyNumber: state.dailyNumber,
    problems: state.problems,
    stageIndex: state.stageIndex,
    hintsUsed: state.hintsUsed,
    hintCounts: state.hintCounts,
    attemptCounts: state.attemptCounts,
    manipulationCounts: state.manipulationCounts,
    discoveries: state.discoveries,
    results: state.results,
  };
}

export function createTutorialGameState(): GameState {
  const initial = createInitialGameState(new Date('2026-01-01T12:00:00.000Z'));
  return {
    ...initial,
    phase: 'problem',
    problems: [TUTORIAL_PROBLEM],
  };
}

function settleFriendlyArithmetic(
  frames: ExpressionTransformFrame[],
  expression: ExpressionTransformFrame['expression'],
) {
  let current = expression;
  // Resolve only nested routine arithmetic. The root remains a meaningful
  // choice: answer it directly or turn one of its numbers over again.
  while (current.type !== 'number') {
    const simplification = simplifyNext(current);
    if (!simplification || simplification.path.length === 0) break;
    current = simplification.expression;
    frames.push({
      kind: 'simplify',
      expression: current,
      display: formatExpression(current),
    });
  }
  return current;
}

export function tutorialReducer(state: GameState, action: TutorialAction): GameState {
  if (action.type === 'RESET_TUTORIAL') return createTutorialGameState();

  if (
    action.type === 'SUBMIT_DECOMPOSITION' &&
    state.phase === 'decomposing' &&
    !state.afterDirect
  ) {
    const problem = state.problems[state.stageIndex];
    const operand = state.selectedSide === 'left' ? problem.left : problem.right;
    const parsed = parseDecomposition(action.input, operand);
    const next = gameReducer(state, action);
    if (!parsed.ok || next.phase !== 'guided') return next;

    const original = binaryExpression(
      numberExpression(problem.left),
      '*',
      numberExpression(problem.right),
    );
    const path = state.selectedSide === 'left' ? ['left'] as const : ['right'] as const;
    const transformed = transformNumberNode(original, [...path], parsed.expression);
    if (!transformed) return next;

    const frames = [...transformed.frames];
    const finalExpression = settleFriendlyArithmetic(frames, transformed.finalExpression);
    return {
      ...toBase(next),
      phase: 'expressionTransforming',
      frames,
      frameIndex: 0,
      finalExpression,
      continuation: { type: 'problem' },
    };
  }

  return gameReducer(state, action);
}
