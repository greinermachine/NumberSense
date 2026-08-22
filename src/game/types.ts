import type { AlternateView, ProblemDefinition } from '../data/types';
import type {
  GuidedPlan,
  OperandSide,
  ParsedDecomposition,
} from '../math/types';

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
};

export type GameBase = {
  dateKey: string;
  dailyNumber: number;
  problems: readonly ProblemDefinition[];
  stageIndex: number;
  hintsUsed: boolean[];
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
  | { type: 'JUST_KNEW' }
  | { type: 'CONTINUE_TO_SURF' }
  | { type: 'BEGIN_SURF' }
  | { type: 'FINISH_SURF' }
  | { type: 'START_OVER' };
