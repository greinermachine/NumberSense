import type { BinaryOperator, OperandSide } from '../math/types';

export type ProblemTier = 'warm' | 'explore' | 'puzzle';

export type TeachingRationale =
  | 'nearby-round-number'
  | 'split-place-value'
  | 'double-half'
  | 'factor-rearrangement'
  | 'friendly-product'
  | 'distributive-split';

/**
 * An intentionally authored view the game is willing to teach.
 *
 * Player-entered decompositions use ParsedDecomposition and are validated by
 * equivalence. They never become TeachingView records automatically.
 */
export type TeachingView = {
  side: OperandSide;
  left: number;
  operator: BinaryOperator;
  right: number;
  rationaleTag?: TeachingRationale;
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
  teachingViews: TeachingView[];
  hint: HintDefinition;
};
