import { selectAlternateView } from '../data/alternateViews';
import { getDailyNumber, selectDailyProblems, toDailyKey } from '../data/daily';
import { canonicalDecompositionKey, parseDecomposition } from '../math/decomposition';
import {
  parseAnswerExpression,
  type ParsedAnswerExpression,
} from '../math/answerExpression';
import {
  evaluateExpression,
  expressionAtPath,
  formatExpression,
  MAX_RECURSIVE_MANIPULATIONS,
  numberExpression,
  numberAtPath,
  replaceExpressionAtPath,
  simplifyNext,
  transformNumberNode,
} from '../math/expression';
import { findFriendlySuggestion } from '../math/expressionHints';
import { createGuidedPlan } from '../math/guidedSolving';
import type { ExpressionPath, MathExpression } from '../math/types';
import type {
  Discovery,
  ExpressionContinuation,
  ExpressionTransformContinuation,
  GameAction,
  GameBase,
  GameState,
  GuidedProgress,
  SolveMethod,
} from './types';

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
  const completed = withCompletedResult(state, solvedBy);
  const problem = currentProblem(state);

  return {
    ...completed,
    phase: 'alternateReveal',
    alternate: selectAlternateView(problem, state.discoveries[state.stageIndex]),
    solvedBy,
  };
}

function withCompletedResult(state: GameBase, solvedBy: SolveMethod): GameBase {
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

  return { ...base, results };
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

type GuidedContinuation = Extract<ExpressionContinuation, { type: 'guided' }>;

function toGuidedContinuation(progress: GuidedProgress): GuidedContinuation {
  return {
    type: 'guided',
    selectedSide: progress.selectedSide,
    decomposition: progress.decomposition,
    plan: progress.plan,
    stepIndex: progress.stepIndex,
    answers: progress.answers,
  };
}

function focusPath(continuation: ExpressionContinuation): ExpressionPath {
  return continuation.type === 'guided'
    ? continuation.plan.steps[continuation.stepIndex].path
    : [];
}

function resumeExpression(
  state: GameBase,
  expression: MathExpression,
  continuation: ExpressionContinuation,
  feedback?: string,
): GameState {
  if (continuation.type === 'problem') {
    return {
      ...baseState(state),
      phase: 'expression',
      expression,
      ...(feedback ? { feedback } : {}),
    };
  }
  return {
    ...baseState(state),
    phase: 'guided',
    selectedSide: continuation.selectedSide,
    decomposition: continuation.decomposition,
    plan: continuation.plan,
    stepIndex: continuation.stepIndex,
    answers: continuation.answers,
    workingExpression: expression,
    ...(feedback ? { feedback } : {}),
  };
}

function resolveGuidedAnswer(
  state: GameBase,
  continuation: GuidedContinuation,
  workingExpression: MathExpression,
  answer: number,
): GameState {
  const step = continuation.plan.steps[continuation.stepIndex];
  if (answer !== step.expected) {
    return {
      ...resumeExpression(state, workingExpression, continuation),
      feedback: 'That piece needs another look. Stay with this step.',
      ...withAttempt(state),
    } as GameState;
  }
  const updated = replaceExpressionAtPath(
    workingExpression,
    step.path,
    { type: 'number', value: answer },
  );
  if (!updated) return resumeExpression(state, workingExpression, continuation);
  const answers = [...continuation.answers, answer];
  if (continuation.stepIndex < continuation.plan.steps.length - 1) {
    return {
      ...baseState(state),
      phase: 'guided',
      selectedSide: continuation.selectedSide,
      decomposition: continuation.decomposition,
      plan: continuation.plan,
      stepIndex: continuation.stepIndex + 1,
      answers,
      workingExpression: updated,
    };
  }
  if (continuation.plan.completion.type === 'expression') {
    return {
      ...baseState(state),
      phase: 'expression',
      expression: updated,
    };
  }
  return completeMath(state, 'guided');
}

function answerInput(rawAnswer: string | number) {
  return parseAnswerExpression(String(rawAnswer));
}

function beginAnswerResolution(
  state: GameBase,
  answer: ParsedAnswerExpression,
  expected: number,
  finalExpression: MathExpression,
  continuation: ExpressionTransformContinuation,
): GameState {
  const resolved = numberExpression(expected);
  return {
    ...baseState(state),
    phase: 'expressionTransforming',
    frames: [
      {
        kind: 'answer',
        expression: answer.expression,
        display: answer.normalized,
      },
      {
        kind: 'simplify',
        expression: resolved,
        display: formatExpression(resolved),
      },
    ],
    frameIndex: 0,
    finalExpression,
    continuation,
  };
}

function beginExpressionTransformation(
  state: GameBase,
  expression: MathExpression,
  path: ExpressionPath,
  input: string,
  continuation: ExpressionContinuation,
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
    continuation,
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

      const plan = createGuidedPlan(
        problem.left,
        problem.right,
        state.selectedSide,
        validation.expression,
      );
      return {
        ...discovered,
        phase: 'guided',
        selectedSide: state.selectedSide,
        decomposition: validation.expression,
        plan,
        stepIndex: 0,
        answers: [],
        workingExpression: plan.workingExpression,
      };
    }

    case 'SUBMIT_DIRECT': {
      if (state.phase !== 'problem') return state;
      const problem = currentProblem(state);
      const validation = answerInput(action.answer);
      if (!validation.ok) {
        return { ...state, feedback: validation.message };
      }
      const expected = problem.left * problem.right;
      if (validation.answer.value !== expected) {
        return {
          ...withAttempt(state),
          phase: 'problem',
          feedback: 'Not quite. Your work is still here.',
        };
      }
      if (!validation.answer.isPlainInteger) {
        return beginAnswerResolution(
          state,
          validation.answer,
          expected,
          numberExpression(expected),
          { type: 'direct' },
        );
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
      const validation = answerInput(action.answer);
      if (!validation.ok) {
        return { ...state, feedback: validation.message };
      }
      const continuation = toGuidedContinuation(state);
      const step = continuation.plan.steps[continuation.stepIndex];
      if (validation.answer.value !== step.expected) {
        return resolveGuidedAnswer(
          state,
          continuation,
          state.workingExpression,
          validation.answer.value,
        );
      }
      if (!validation.answer.isPlainInteger) {
        const updated = replaceExpressionAtPath(
          state.workingExpression,
          step.path,
          numberExpression(step.expected),
        );
        if (!updated) return state;
        if (
          continuation.stepIndex === continuation.plan.steps.length - 1 &&
          continuation.plan.completion.type === 'answer'
        ) {
          const expected = continuation.plan.completion.value;
          return beginAnswerResolution(
            withCompletedResult(state, 'guided'),
            validation.answer,
            expected,
            numberExpression(expected),
            { type: 'answer', solvedBy: 'guided' },
          );
        }
        return beginAnswerResolution(
          state,
          validation.answer,
          step.expected,
          updated,
          continuation,
        );
      }
      return resolveGuidedAnswer(
        state,
        continuation,
        state.workingExpression,
        validation.answer.value,
      );
    }

    case 'SUBMIT_EXPRESSION_ANSWER': {
      if (state.phase !== 'expression') return state;
      const validation = answerInput(action.answer);
      if (!validation.ok) {
        return { ...state, feedback: validation.message };
      }
      const expected = evaluateExpression(state.expression);
      if (validation.answer.value !== expected) {
        return {
          ...state,
          ...withAttempt(state),
          feedback: 'Not quite. This expression stays right here.',
        };
      }
      if (!validation.answer.isPlainInteger) {
        return beginAnswerResolution(
          withCompletedResult(state, 'guided'),
          validation.answer,
          expected,
          numberExpression(expected),
          { type: 'answer', solvedBy: 'guided' },
        );
      }
      return completeMath(state, 'guided');
    }

    case 'OPEN_EXPRESSION_DECOMPOSITION': {
      let expression: MathExpression;
      let continuation: ExpressionContinuation;
      if (state.phase === 'guided') {
        expression = state.workingExpression;
        continuation = toGuidedContinuation(state);
      } else if (state.phase === 'expression') {
        expression = state.expression;
        continuation = { type: 'problem' };
      } else if (state.phase === 'expressionDecomposing') {
        expression = state.expression;
        continuation = state.continuation;
      } else {
        return state;
      }
      const selectedPath = [...focusPath(continuation), ...action.path];
      if (numberAtPath(expression, selectedPath) === null) return state;
      if (
        state.manipulationCounts[state.stageIndex] >= MAX_RECURSIVE_MANIPULATIONS
      ) {
        const hintCounts = state.hintCounts.map((count, index) =>
          index === state.stageIndex ? Math.max(5, count) : count,
        );
        return resumeExpression({
          ...baseState(state),
          hintsUsed: state.hintsUsed.map((used, index) =>
            index === state.stageIndex ? true : used,
          ),
          hintCounts,
        }, expression, continuation, 'This one has turned enough. Take the next step with me.');
      }
      return {
        ...baseState(state),
        phase: 'expressionDecomposing',
        expression,
        selectedPath,
        continuation,
      };
    }

    case 'CLOSE_EXPRESSION_DECOMPOSITION':
      return state.phase === 'expressionDecomposing'
        ? resumeExpression(state, state.expression, state.continuation)
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
        continuation: state.continuation,
      };
    }

    case 'ADVANCE_EXPRESSION_TRANSFORM':
      if (state.phase !== 'expressionTransforming') return state;
      if (state.frameIndex < state.frames.length - 1) {
        return { ...state, frameIndex: state.frameIndex + 1 };
      }
      if (state.continuation.type === 'direct') {
        return { ...baseState(state), phase: 'reflection' };
      }
      if (state.continuation.type === 'answer') {
        return completeMath(state, state.continuation.solvedBy);
      }
      if (state.continuation.type === 'guided') {
        const target = expressionAtPath(
          state.finalExpression,
          focusPath(state.continuation),
        );
        if (target?.type === 'number') {
          return resolveGuidedAnswer(
            state,
            state.continuation,
            state.finalExpression,
            target.value,
          );
        }
        return resumeExpression(
          state,
          state.finalExpression,
          state.continuation,
        );
      }
      if (state.finalExpression.type === 'number') {
        return completeMath(state, 'guided');
      }
      return resumeExpression(state, state.finalExpression, state.continuation);

    case 'APPLY_EXPRESSION_SUGGESTION': {
      if (state.phase !== 'expression' && state.phase !== 'guided') return state;
      if (
        state.manipulationCounts[state.stageIndex] >= MAX_RECURSIVE_MANIPULATIONS
      ) {
        return state;
      }
      const expression = state.phase === 'guided'
        ? state.workingExpression
        : state.expression;
      const continuation: ExpressionContinuation = state.phase === 'guided'
        ? toGuidedContinuation(state)
        : { type: 'problem' };
      const focused = expressionAtPath(expression, focusPath(continuation));
      if (!focused) return state;
      const suggestion = findFriendlySuggestion(focused);
      if (!suggestion) return state;
      return beginExpressionTransformation(
        state,
        expression,
        [...focusPath(continuation), ...suggestion.path],
        suggestion.input,
        continuation,
      ) ?? state;
    }

    case 'ACCEPT_EXPRESSION_RESCUE': {
      if (state.phase !== 'expression' && state.phase !== 'guided') return state;
      const expression = state.phase === 'guided'
        ? state.workingExpression
        : state.expression;
      const continuation: ExpressionContinuation = state.phase === 'guided'
        ? toGuidedContinuation(state)
        : { type: 'problem' };
      const currentFocusPath = focusPath(continuation);
      const focused = expressionAtPath(expression, currentFocusPath);
      if (!focused) return state;
      const simplification = simplifyNext(focused);
      if (!simplification) return state;
      const assisted = withHint(state);
      const updated = replaceExpressionAtPath(
        expression,
        currentFocusPath,
        simplification.expression,
      );
      if (!updated) return state;
      if (
        continuation.type === 'guided' &&
        simplification.expression.type === 'number'
      ) {
        return resolveGuidedAnswer(
          assisted,
          continuation,
          updated,
          simplification.expression.value,
        );
      }
      if (continuation.type === 'problem' && updated.type === 'number') {
        return completeMath(assisted, 'guided');
      }
      return resumeExpression(assisted, updated, continuation);
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
