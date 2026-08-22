export type BinaryOperator = '+' | '-' | '*';

export type OperandSide = 'left' | 'right';

export type ParsedDecomposition = {
  left: number;
  operator: BinaryOperator;
  right: number;
  result: number;
  normalized: string;
};

export type DecompositionErrorCode =
  | 'empty'
  | 'too-long'
  | 'syntax'
  | 'unsafe-integer'
  | 'not-equivalent'
  | 'not-a-decomposition';

export type DecompositionValidation =
  | { ok: true; expression: ParsedDecomposition }
  | { ok: false; code: DecompositionErrorCode; message: string };

export type GuidedStep = {
  id: string;
  before: string;
  after?: string;
  expected: number;
  purpose: 'partial' | 'combine';
};

export type GuidedPlan = {
  expressionLabel: string;
  steps: GuidedStep[];
  family: 'distribute' | 'regroup';
};
