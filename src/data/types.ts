import type { BinaryOperator, OperandSide } from '../math/types';

export type ProblemTier = 'warm' | 'explore' | 'puzzle';

export type AlternateView = {
  side: OperandSide;
  left: number;
  operator: BinaryOperator;
  right: number;
};

export type HintDefinition = {
  side: OperandSide;
  text: string;
};

export type ProblemDefinition = {
  id: string;
  left: number;
  right: number;
  tier: ProblemTier;
  alternateViews: AlternateView[];
  hint: HintDefinition;
};
