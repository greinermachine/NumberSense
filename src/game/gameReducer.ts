import { selectAlternateView } from '../data/alternateViews';
import { getDailyNumber, selectDailyProblems, toDailyKey } from '../data/daily';
import { canonicalDecompositionKey, parseDecomposition } from '../math/decomposition';
import { createGuidedPlan } from '../math/guidedSolving';
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
          ...baseState(state),
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
        state.phase !== 'guided'
      ) {
        return state;
      }
      const hintsUsed = state.hintsUsed.map((used, index) =>
        index === state.stageIndex ? true : used,
      );
      return { ...state, hintsUsed };
    }

    case 'SUBMIT_GUIDED': {
      if (state.phase !== 'guided') return state;
      const step = state.plan.steps[state.stepIndex];
      if (action.answer !== step.expected) {
        return {
          ...state,
          feedback: 'That piece needs another look. Stay with this step.',
        };
      }
      const answers = [...state.answers, action.answer];
      if (state.stepIndex < state.plan.steps.length - 1) {
        return { ...state, stepIndex: state.stepIndex + 1, answers, feedback: undefined };
      }
      return completeMath({ ...state, answers } as GameState, 'guided');
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
