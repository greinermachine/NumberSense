import { describe, expect, it } from 'vitest';
import { parseDecomposition } from './decomposition';
import {
  binaryExpression,
  evaluateExpression,
  formatExpression,
  listNumberNodes,
  numberExpression,
  replaceNumberAtPath,
  simplifyNext,
  transformNumberNode,
} from './expression';
import type { BinaryOperator, ExpressionPath, MathExpression } from './types';

function decomposition(input: string, value: number) {
  const parsed = parseDecomposition(input, value);
  if (!parsed.ok) throw new Error(`Invalid fixture: ${input}`);
  return parsed.expression;
}

function pair(left: number, operator: BinaryOperator, right: number): MathExpression {
  return binaryExpression(numberExpression(left), operator, numberExpression(right));
}

describe('recursive expressions', () => {
  it.each([
    {
      label: 'subtract subtraction',
      expression: pair(960, '-', 48),
      path: ['right'] as ExpressionPath,
      decomposition: decomposition('50-2', 48),
      displays: ['960 − (50 − 2)', '960 − 50 + 2', '910 + 2'],
    },
    {
      label: 'subtract addition',
      expression: pair(800, '-', 16),
      path: ['right'] as ExpressionPath,
      decomposition: decomposition('10+6', 16),
      displays: ['800 − (10 + 6)', '800 − 10 − 6', '790 − 6'],
    },
    {
      label: 'add subtraction',
      expression: pair(900, '+', 48),
      path: ['right'] as ExpressionPath,
      decomposition: decomposition('50-2', 48),
      displays: ['900 + (50 − 2)', '900 + 50 − 2', '950 − 2'],
    },
    {
      label: 'add addition',
      expression: pair(900, '+', 48),
      path: ['right'] as ExpressionPath,
      decomposition: decomposition('40+8', 48),
      displays: ['900 + (40 + 8)', '900 + 40 + 8', '940 + 8'],
    },
  ])('$label propagates signs and preserves value', ({ expression, path, decomposition: view, displays }) => {
    const originalValue = evaluateExpression(expression);
    const transformed = transformNumberNode(expression, path, view);
    expect(transformed?.frames.map((frame) => frame.display)).toEqual(displays);
    expect(evaluateExpression(transformed!.finalExpression)).toBe(originalValue);
  });

  it('reassociates a decomposition selected on the left into useful arithmetic', () => {
    const addition = transformNumberNode(
      pair(48, '+', 900),
      ['left'],
      decomposition('50-2', 48),
    );
    const subtraction = transformNumberNode(
      pair(48, '-', 10),
      ['left'],
      decomposition('50-2', 48),
    );

    expect(addition?.frames.map((frame) => frame.display)).toEqual([
      '(50 − 2) + 900',
      '900 + 50 − 2',
      '950 − 2',
    ]);
    expect(subtraction?.frames.map((frame) => frame.display)).toEqual([
      '(50 − 2) − 10',
      '50 − 10 − 2',
      '40 − 2',
    ]);
  });

  it('replaces the selected numeric node without changing siblings', () => {
    const expression = pair(960, '-', 48);
    const replacement = pair(50, '-', 2);
    const replaced = replaceNumberAtPath(expression, ['right'], replacement);

    expect(formatExpression(replaced!)).toBe('960 − (50 − 2)');
    expect(listNumberNodes(replaced!)).toEqual([
      { path: ['left'], value: 960 },
      { path: ['right', 'left'], value: 50 },
      { path: ['right', 'right'], value: 2 },
    ]);
    expect(evaluateExpression(replaced!)).toBe(evaluateExpression(expression));
  });

  it('distributes an additive decomposition inside multiplication', () => {
    const expression = binaryExpression(
      numberExpression(960),
      '-',
      binaryExpression(numberExpression(6), '*', numberExpression(8)),
    );
    const transformed = transformNumberNode(
      expression,
      ['right', 'left'],
      decomposition('10-4', 6),
    );

    expect(transformed?.frames.map((frame) => frame.display)).toEqual([
      '960 − (10 − 4) × 8',
      '960 − (10 × 8 − 4 × 8)',
    ]);
    expect(formatExpression(transformed!.finalExpression)).toBe(
      '960 − (10 × 8 − 4 × 8)',
    );
    expect(evaluateExpression(transformed!.finalExpression)).toBe(912);
  });

  it('regroups 40 = 4 × 10 across 40 × 12 visibly', () => {
    const expression = pair(40, '*', 12);
    const transformed = transformNumberNode(
      expression,
      ['left'],
      decomposition('4*10', 40),
    );

    expect(transformed?.frames.map((frame) => frame.display)).toEqual([
      '(4 × 10) × 12',
      '4 × 12 × 10',
      '(4 × 12) × 10',
      '48 × 10',
      '480',
    ]);
    expect(evaluateExpression(transformed!.finalExpression)).toBe(480);
  });

  it('reorders 5 × 10 × 19 into 5 × 19 × 10', () => {
    const transformed = transformNumberNode(
      pair(50, '*', 19),
      ['left'],
      decomposition('5*10', 50),
    );
    expect(transformed?.frames[1].display).toBe('5 × 19 × 10');
    expect(transformed?.frames.at(-1)?.display).toBe('950');
  });

  it('distributes either factor of an intermediate product', () => {
    const transformed = transformNumberNode(
      pair(40, '*', 12),
      ['right'],
      decomposition('10+2', 12),
    );
    expect(transformed?.frames.map((frame) => frame.display)).toEqual([
      '40 × (10 + 2)',
      '40 × 10 + 40 × 2',
    ]);
    expect(evaluateExpression(transformed!.finalExpression)).toBe(480);
  });

  it('preserves the surrounding expression while regrouping nested factors', () => {
    const expression = binaryExpression(pair(40, '*', 12), '-', numberExpression(48));
    const transformed = transformNumberNode(
      expression,
      ['left', 'left'],
      decomposition('4*10', 40),
    );
    expect(transformed?.frames.map((frame) => frame.display)).toEqual([
      '(4 × 10) × 12 − 48',
      '4 × 12 × 10 − 48',
      '(4 × 12) × 10 − 48',
      '48 × 10 − 48',
      '480 − 48',
    ]);
    expect(evaluateExpression(transformed!.finalExpression)).toBe(432);
  });

  it('uses subtraction copy only when an outer subtraction flips signs', () => {
    const subtracting = transformNumberNode(
      pair(960, '-', 48),
      ['right'],
      decomposition('50-2', 48),
    );
    const adding = transformNumberNode(
      pair(950, '+', 76),
      ['right'],
      decomposition('70+6', 76),
    );
    expect(subtracting?.frames[1].kind).toBe('sign');
    expect(adding?.frames[1].kind).toBe('reassociate');
  });

  it('systematically preserves full-expression value for equivalent replacements', () => {
    const fixtures: Array<{
      expression: MathExpression;
      path: ExpressionPath;
      input: string;
      value: number;
    }> = [
      { expression: pair(63, '+', 24), path: ['left'], input: '60+3', value: 63 },
      { expression: pair(63, '-', 24), path: ['left'], input: '70-7', value: 63 },
      { expression: pair(800, '-', 16), path: ['right'], input: '20-4', value: 16 },
      { expression: pair(900, '+', 48), path: ['right'], input: '6*8', value: 48 },
    ];

    for (const fixture of fixtures) {
      const transformed = transformNumberNode(
        fixture.expression,
        fixture.path,
        decomposition(fixture.input, fixture.value),
      );
      expect(evaluateExpression(transformed!.finalExpression)).toBe(
        evaluateExpression(fixture.expression),
      );
    }
  });

  it('reduces one innermost operation at a time for guided rescue', () => {
    const nested = binaryExpression(pair(960, '-', 50), '+', numberExpression(2));
    const first = simplifyNext(nested);
    const second = simplifyNext(first!.expression);

    expect(formatExpression(first!.expression)).toBe('910 + 2');
    expect(first?.value).toBe(910);
    expect(second?.expression).toEqual(numberExpression(912));
  });
});
