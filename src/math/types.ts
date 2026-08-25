export type BinaryOperator = '+' | '-' | '*';

export type OperandSide = 'left' | 'right';

export type ExpressionBranch = 'left' | 'right';

export type ExpressionPath = ExpressionBranch[];

export type MathExpression =
  | { type: 'number'; value: number }
  | {
      type: 'binary';
      operator: BinaryOperator;
      left: MathExpression;
      right: MathExpression;
    };

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
  path: ExpressionPath;
};

export type GuidedPlan = {
  expressionLabel: string;
  workingExpression: MathExpression;
  steps: GuidedStep[];
  family: 'distribute' | 'regroup';
  completion:
    | { type: 'expression'; expression: MathExpression }
    | { type: 'answer'; value: number };
};
