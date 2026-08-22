import { selectAlternateView } from '../data/alternateViews';
import { getDailyNumber, selectDailyProblems, toDailyKey } from '../data/daily';
import { canonicalDecompositionKey, parseDecomposition } from '../math/decomposition';
import {
  evaluateExpression,
  MAX_RECURSIVE_MANIPULATIONS,
  numberAtPath,
  simplifyNext,
  transformNumberNode,
} from '../math/expression';
import { findFriendlySuggestion } from '../math/expressionHints';
import { createGuidedPlan } from '../math/guidedSolving';
import type { ExpressionPath, MathExpression } from '../math/types';
import type { Discovery, GameAction, GameBase, GameState, SolveMethod } from './types';

export function createInitialGameState(date = new Date()): GameState {
  const dateKey = toDailyKey(date);
  return {
    phase: 'intro',
    dateKey,
    dailyNumber: getDailyNumber(dateKey),
    problems: selectDailyProblems(date),
    stageIndex: 0,
    hintsUsed: [false, false, false],
    hintCounts: [0, 0, 0],
    attemptCounts: [0, 0, 0],
    manipulationCounts: [0, 0, 0],
    discoveries: [[], [], []],
    results: [],
  };
}

function currentProblem(state: GameBase) {
  return state.problems[state.stageIndex];
}

function baseState(state: GameBase): GameBase {
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

function withDiscovery(state: GameBase, discovery: Discovery): GameBase {
  const existing = state.discoveries[state.stageIndex];
  const key = `${discovery.side}:${canonicalDecompositionKey(discovery.expression)}`;
  const alreadyFound = existing.some(
    (item) =>
      `${item.side}:${canonicalDecompositionKey(item.expression)}` === key,
  );
  if (alreadyFound) return baseState(state);
  const discoveries = state.discoveries.map((items, index) =>
    index === state.stageIndex ? [...items, discovery] : items,
  );
  return { ...baseState(state), discoveries };
}

function completeMath(state: GameBase, solvedBy: SolveMethod): GameState {
  const base = baseState(state);
  const problem = currentProblem(state);
  const results = state.results.some((result) => result.problemId === problem.id)
    ? state.results
    : [
        ...state.results,
        {
          problemId: problem.id,
          hintUsed: state.hintsUsed[state.stageIndex],
          discoveries: state.discoveries[state.stageIndex],
          solvedBy,
          attemptCount: state.attemptCounts[state.stageIndex],
          manipulationCount: state.manipulationCounts[state.stageIndex],
          assisted: state.hintsUsed[state.stageIndex],
        },
      ];

  return {
    ...base,
    phase: 'alternateReveal',
    results,
    alternate: selectAlternateView(problem, state.discoveries[state.stageIndex]),
    solvedBy,
  };
}

function incrementAt(values: number[], index: number): number[] {
  return values.map((value, current) => current === index ? value + 1 : value);
}

function withAttempt(state: GameBase): GameBase {
  return {
    ...baseState(state),
    attemptCounts: incrementAt(state.attemptCounts, state.stageIndex),
  };
}

function withHint(state: GameBase): GameBase {
  return {
    ...baseState(state),
    hintsUsed: state.hintsUsed.map((used, index) =>
      index === state.stageIndex ? true : used,
    ),
    hintCounts: incrementAt(state.hintCounts, state.stageIndex),
  };
}

function withManipulation(state: GameBase): GameBase {
  return {
    ...baseState(state),
    manipulationCounts: incrementAt(state.manipulationCounts, state.stageIndex),
  };
}

function beginExpressionTransformation(
  state: GameBase,
  expression: MathExpression,
  path: ExpressionPath,
  input: string,
): GameState | null {
  const operand = numberAtPath(expression, path);
  if (operand === null) return null;
  const validation = parseDecomposition(input, operand);
  if (!validation.ok) return null;
  const transformation = transformNumberNode(expression, path, validation.expression);
  if (!transformation) return null;
  return {
    ...withManipulation(state),
    phase: 'expressionTransforming',
    frames: transformation.frames,
    frameIndex: 0,
    finalExpression: transformation.finalExpression,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'START':
      return state.phase === 'intro' ? { ...baseState(state), phase: 'problem' } : state;

    case 'OPEN_DECOMPOSITION':
      if (state.phase !== 'problem' && state.phase !== 'reflection' && state.phase !== 'decomposing') {
        return state;
      }
      return {
        ...baseState(state),
        phase: 'decomposing',
        selectedSide: action.side,
        inputError: undefined,
        afterDirect:
          state.phase === 'reflection' ||
          (state.phase === 'decomposing' && state.afterDirect),
      };

    case 'CLOSE_DECOMPOSITION':
      if (state.phase !== 'decomposing') return state;
      return { ...baseState(state), phase: state.afterDirect ? 'reflection' : 'problem' };

    case 'SUBMIT_DECOMPOSITION': {
      if (state.phase !== 'decomposing') return state;
      const problem = currentProblem(state);
      const operand = state.selectedSide === 'left' ? problem.left : problem.right;
      const validation = parseDecomposition(action.input, operand);
      if (!validation.ok) return { ...state, inputError: validation.message };

      const discovered = withDiscovery(state, {
        side: state.selectedSide,
        expression: validation.expression,
      });
      if (state.afterDirect) return completeMath(discovered, 'direct');

      return {
        ...discovered,
        phase: 'guided',
        selectedSide: state.selectedSide,
        expression: validation.expression,
        plan: createGuidedPlan(
          problem.left,
          problem.right,
          state.selectedSide,
          validation.expression,
        ),
        stepIndex: 0,
        answers: [],
      };
    }

    case 'SUBMIT_DIRECT': {
      if (state.phase !== 'problem') return state;
      const problem = currentProblem(state);
      if (action.answer !== problem.left * problem.right) {
        return {
          ...withAttempt(state),
          phase: 'problem',
          feedback: 'Not quite. Your work is still here.',
        };
      }
      return { ...baseState(state), phase: 'reflection' };
    }

    case 'USE_HINT': {
      if (
        state.phase !== 'problem' &&
        state.phase !== 'decomposing' &&
        state.phase !== 'guided' &&
        state.phase !== 'expression' &&
        state.phase !== 'expressionDecomposing'
      ) {
        return state;
      }
      return { ...state, ...withHint(state) } as GameState;
    }

    case 'SUBMIT_GUIDED': {
      if (state.phase !== 'guided') return state;
      const step = state.plan.steps[state.stepIndex];
      if (action.answer !== step.expected) {
        return {
          ...state,
          ...withAttempt(state),
          feedback: 'That piece needs another look. Stay with this step.',
        };
      }
      const answers = [...state.answers, action.answer];
      if (state.stepIndex < state.plan.steps.length - 1) {
        return { ...state, stepIndex: state.stepIndex + 1, answers, feedback: undefined };
      }
      if (state.plan.completion.type === 'expression') {
        return {
          ...baseState(state),
          phase: 'expression',
          expression: state.plan.completion.expression,
        };
      }
      return completeMath({ ...state, answers } as GameState, 'guided');
    }

    case 'SUBMIT_EXPRESSION_ANSWER':
      if (state.phase !== 'expression') return state;
      if (action.answer !== evaluateExpression(state.expression)) {
        return {
          ...state,
          ...withAttempt(state),
          feedback: 'Not quite. This expression stays right here.',
        };
      }
      return completeMath(state, 'guided');

    case 'OPEN_EXPRESSION_DECOMPOSITION': {
      if (state.phase !== 'expression' && state.phase !== 'expressionDecomposing') {
        return state;
      }
      if (numberAtPath(state.expression, action.path) === null) return state;
      if (
        state.manipulationCounts[state.stageIndex] >= MAX_RECURSIVE_MANIPULATIONS
      ) {
        const hintCounts = state.hintCounts.map((count, index) =>
          index === state.stageIndex ? Math.max(5, count) : count,
        );
        return {
          ...baseState(state),
          phase: 'expression',
          expression: state.expression,
          feedback: 'This one has turned enough. Take the next step with me.',
          hintsUsed: state.hintsUsed.map((used, index) =>
            index === state.stageIndex ? true : used,
          ),
          hintCounts,
        };
      }
      return {
        ...baseState(state),
        phase: 'expressionDecomposing',
        expression: state.expression,
        selectedPath: action.path,
      };
    }

    case 'CLOSE_EXPRESSION_DECOMPOSITION':
      return state.phase === 'expressionDecomposing'
        ? {
            ...baseState(state),
            phase: 'expression',
            expression: state.expression,
          }
        : state;

    case 'SUBMIT_EXPRESSION_DECOMPOSITION': {
      if (state.phase !== 'expressionDecomposing') return state;
      const operand = numberAtPath(state.expression, state.selectedPath);
      if (operand === null) return state;
      const validation = parseDecomposition(action.input, operand);
      if (!validation.ok) return { ...state, inputError: validation.message };
      const transformation = transformNumberNode(
        state.expression,
        state.selectedPath,
        validation.expression,
      );
      if (!transformation) {
        return { ...state, inputError: 'That number moved. Choose it again.' };
      }
      return {
        ...withManipulation(state),
        phase: 'expressionTransforming',
        frames: transformation.frames,
        frameIndex: 0,
        finalExpression: transformation.finalExpression,
      };
    }

    case 'ADVANCE_EXPRESSION_TRANSFORM':
      if (state.phase !== 'expressionTransforming') return state;
      if (state.frameIndex < state.frames.length - 1) {
        return { ...state, frameIndex: state.frameIndex + 1 };
      }
      if (state.finalExpression.type === 'number') {
        return completeMath(state, 'guided');
      }
      return {
        ...baseState(state),
        phase: 'expression',
        expression: state.finalExpression,
      };

    case 'APPLY_EXPRESSION_SUGGESTION': {
      if (state.phase !== 'expression') return state;
      if (
        state.manipulationCounts[state.stageIndex] >= MAX_RECURSIVE_MANIPULATIONS
      ) {
        return state;
      }
      const suggestion = findFriendlySuggestion(state.expression);
      if (!suggestion) return state;
      return beginExpressionTransformation(
        state,
        state.expression,
        suggestion.path,
        suggestion.input,
      ) ?? state;
    }

    case 'ACCEPT_EXPRESSION_RESCUE': {
      if (state.phase !== 'expression') return state;
      const simplification = simplifyNext(state.expression);
      if (!simplification) return state;
      const assisted = withHint(state);
      if (simplification.expression.type === 'number') {
        return completeMath(assisted, 'guided');
      }
      return {
        ...assisted,
        phase: 'expression',
        expression: simplification.expression,
      };
    }

    case 'JUST_KNEW':
      return state.phase === 'reflection' ? completeMath(state, 'direct') : state;

    case 'CONTINUE_TO_SURF':
      return state.phase === 'alternateReveal'
        ? {
            ...baseState(state),
            phase: 'surfTransition',
            alternate: state.alternate,
            solvedBy: state.solvedBy,
          }
        : state;

    case 'BEGIN_SURF':
      return state.phase === 'surfTransition'
        ? { ...baseState(state), phase: 'surfing', courseIndex: state.stageIndex }
        : state;

    case 'FINISH_SURF':
      if (state.phase !== 'surfing') return state;
      if (state.stageIndex >= state.problems.length - 1) {
        return { ...baseState(state), phase: 'results' };
      }
      return {
        ...baseState(state),
        phase: 'problem',
        stageIndex: state.stageIndex + 1,
      };

    case 'START_OVER':
      return createInitialGameState(new Date(`${state.dateKey}T12:00:00.000Z`));

    default:
      return state;
  }
}
