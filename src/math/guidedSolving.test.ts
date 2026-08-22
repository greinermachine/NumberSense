import { describe, expect, it } from 'vitest';
import { parseDecomposition } from './decomposition';
import { formatExpression } from './expression';
import { createGuidedPlan } from './guidedSolving';

function expression(input: string, operand: number) {
  const result = parseDecomposition(input, operand);
  if (!result.ok) throw new Error('Fixture must be valid');
  return result.expression;
}

describe('createGuidedPlan', () => {
  it('distributes an addition on the right', () => {
    const plan = createGuidedPlan(39, 12, 'right', expression('10+2', 12));
    expect(plan.family).toBe('distribute');
    expect(plan.steps.map((step) => step.expected)).toEqual([390, 78]);
    expect(plan.completion.type).toBe('expression');
    if (plan.completion.type === 'expression') {
      expect(formatExpression(plan.completion.expression)).toBe('390 + 78');
    }
  });

  it('distributes a subtraction on the left in natural order', () => {
    const plan = createGuidedPlan(49, 16, 'left', expression('50-1', 49));
    expect(plan.steps.map((step) => step.expected)).toEqual([800, 16]);
    expect(plan.steps[0].before).toBe('50 × 16 =');
    expect(plan.completion.type).toBe('expression');
    if (plan.completion.type === 'expression') {
      expect(formatExpression(plan.completion.expression)).toBe('800 − 16');
    }
  });

  it('regroups a multiplication decomposition', () => {
    const plan = createGuidedPlan(49, 16, 'left', expression('7*7', 49));
    expect(plan.family).toBe('regroup');
    expect(plan.steps.map((step) => step.expected)).toEqual([112, 784]);
    expect(plan.completion).toEqual({ type: 'answer', value: 784 });
  });
});
