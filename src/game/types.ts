import type { AlternateView, ProblemDefinition } from '../data/types';
import type {
  ExpressionPath,
  GuidedPlan,
  MathExpression,
  OperandSide,
  ParsedDecomposition,
} from '../math/types';
import type { ExpressionTransformFrame } from '../math/expression';

export type Discovery = {
  side: OperandSide;
  expression: ParsedDecomposition;
};

export type SolveMethod = 'direct' | 'guided';

export type ProblemResult = {
  problemId: string;
  hintUsed: boolean;
  discoveries: Discovery[];
  solvedBy: SolveMethod;
  attemptCount: number;
  manipulationCount: number;
  assisted: boolean;
};

export type GameBase = {
  dateKey: string;
  dailyNumber: number;
  problems: readonly ProblemDefinition[];
  stageIndex: number;
  hintsUsed: boolean[];
  hintCounts: number[];
  attemptCounts: number[];
  manipulationCounts: number[];
  discoveries: Discovery[][];
  results: ProblemResult[];
};

export type GameState =
  | (GameBase & { phase: 'intro' })
  | (GameBase & { phase: 'problem'; feedback?: string })
  | (GameBase & {
      phase: 'decomposing';
      selectedSide: OperandSide;
      afterDirect: boolean;
      inputError?: string;
    })
  | (GameBase & {
      phase: 'guided';
      selectedSide: OperandSide;
      expression: ParsedDecomposition;
      plan: GuidedPlan;
      stepIndex: number;
      answers: number[];
      feedback?: string;
    })
  | (GameBase & {
      phase: 'expression';
      expression: MathExpression;
      feedback?: string;
    })
  | (GameBase & {
      phase: 'expressionDecomposing';
      expression: MathExpression;
      selectedPath: ExpressionPath;
      inputError?: string;
    })
  | (GameBase & {
      phase: 'expressionTransforming';
      frames: ExpressionTransformFrame[];
      frameIndex: number;
      finalExpression: MathExpression;
    })
  | (GameBase & { phase: 'reflection' })
  | (GameBase & {
      phase: 'alternateReveal';
      alternate: AlternateView;
      solvedBy: SolveMethod;
    })
  | (GameBase & {
      phase: 'surfTransition';
      alternate: AlternateView;
      solvedBy: SolveMethod;
    })
  | (GameBase & { phase: 'surfing'; courseIndex: number })
  | (GameBase & { phase: 'results' });

export type GameAction =
  | { type: 'START' }
  | { type: 'OPEN_DECOMPOSITION'; side: OperandSide }
  | { type: 'CLOSE_DECOMPOSITION' }
  | { type: 'SUBMIT_DECOMPOSITION'; input: string }
  | { type: 'SUBMIT_DIRECT'; answer: number }
  | { type: 'USE_HINT' }
  | { type: 'SUBMIT_GUIDED'; answer: number }
  | { type: 'SUBMIT_EXPRESSION_ANSWER'; answer: number }
  | { type: 'OPEN_EXPRESSION_DECOMPOSITION'; path: ExpressionPath }
  | { type: 'CLOSE_EXPRESSION_DECOMPOSITION' }
  | { type: 'SUBMIT_EXPRESSION_DECOMPOSITION'; input: string }
  | { type: 'ADVANCE_EXPRESSION_TRANSFORM' }
  | { type: 'APPLY_EXPRESSION_SUGGESTION' }
  | { type: 'ACCEPT_EXPRESSION_RESCUE' }
  | { type: 'JUST_KNEW' }
  | { type: 'CONTINUE_TO_SURF' }
  | { type: 'BEGIN_SURF' }
  | { type: 'FINISH_SURF' }
  | { type: 'START_OVER' };
