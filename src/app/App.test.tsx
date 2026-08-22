import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/gameReducer';
import { parseDecomposition } from '../math/decomposition';
import { createGuidedPlan } from '../math/guidedSolving';
import { App } from './App';

describe('central math interaction', () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => cleanup());

  it('opens an operand, accepts a valid typed view, and completes guided work', async () => {
    const user = userEvent.setup();
    const initial = createInitialGameState();
    const problem = initial.problems[0];
    const view = problem.alternateViews[0];
    const operand = view.side === 'left' ? problem.left : problem.right;
    const raw = `${view.left}${view.operator}${view.right}`;
    const parsed = parseDecomposition(raw, operand);
    if (!parsed.ok) throw new Error('Problem-bank fixture must be valid');
    const plan = createGuidedPlan(problem.left, problem.right, view.side, parsed.expression);

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Begin' }));
    await user.click(
      screen.getByRole('button', { name: `Explore another way to make ${operand}` }),
    );
    const editor = screen.getByLabelText(`Another way to make ${operand}`);
    await user.type(editor, raw);
    await user.keyboard('{Enter}');

    for (const step of plan.steps) {
      const input = screen.getByLabelText(`Complete ${step.before}`);
      await user.type(input, String(step.expected));
      await user.keyboard('{Enter}');
    }

    const expressionAnswer = screen.getByLabelText('Your answer');
    await user.type(expressionAnswer, String(problem.left * problem.right));
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'Another perspective unfolds' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You saw');
  });

  it('reuses the number editor inside intermediate arithmetic and stays keyboard operable', async () => {
    const user = userEvent.setup();
    const initial = createInitialGameState();
    const problem = initial.problems[0];
    const view = problem.alternateViews.find(
      (item) => item.operator === '+' || item.operator === '-',
    );
    if (!view) throw new Error('Daily fixture needs an additive view');
    const operand = view.side === 'left' ? problem.left : problem.right;
    const parsed = parseDecomposition(
      `${view.left}${view.operator}${view.right}`,
      operand,
    );
    if (!parsed.ok) throw new Error('Problem-bank fixture must be valid');
    const plan = createGuidedPlan(problem.left, problem.right, view.side, parsed.expression);
    if (plan.completion.type !== 'expression') {
      throw new Error('Additive fixture must create an expression');
    }

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Begin' }));
    await user.click(
      screen.getByRole('button', { name: `Explore another way to make ${operand}` }),
    );
    await user.type(
      screen.getByLabelText(`Another way to make ${operand}`),
      `${view.left}${view.operator}${view.right}`,
    );
    await user.keyboard('{Enter}');
    for (const step of plan.steps) {
      await user.type(
        screen.getByLabelText(`Complete ${step.before}`),
        String(step.expected),
      );
      await user.keyboard('{Enter}');
    }

    const intermediate = plan.completion.expression;
    if (intermediate.type !== 'binary' || intermediate.right.type !== 'number') {
      throw new Error('Fixture should finish with a numeric right term');
    }
    const target = intermediate.right.value;
    const turn = target >= 10 ? `${target - 2}+2` : `${target + 1}-1`;
    await user.click(
      screen.getByRole('button', {
        name: `Explore another way to make ${target} in this expression`,
      }),
    );
    await user.type(screen.getByLabelText(`Another way to make ${target}`), turn);
    await user.keyboard('{Enter}');

    expect(screen.getByRole('status')).toHaveAccessibleName(/Equivalent|[+−]/);
    while (screen.queryByRole('button', { name: /Continue/ })) {
      await user.keyboard('{Enter}');
    }

    expect(
      screen.getAllByRole('button', { name: /in this expression/ }).length,
    ).toBeGreaterThan(1);
    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByText('Can either number become friendlier?')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Your answer'), String(problem.left * problem.right));
    await user.keyboard('{Enter}');
    expect(
      screen.getByRole('heading', { name: 'Another perspective unfolds' }),
    ).toBeInTheDocument();
  });

  it('keeps a wrong direct answer in place for a gentle retry', async () => {
    const user = userEvent.setup();
    const initial = createInitialGameState();
    const problem = initial.problems[0];
    const wrong = problem.left * problem.right + 1;
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Begin' }));
    const answer = screen.getByLabelText('Your answer');
    await user.type(answer, String(wrong));
    await user.keyboard('{Enter}');
    expect(answer).toHaveValue(String(wrong));
    expect(screen.getByText('Not quite. Your work is still here.')).toBeInTheDocument();
  });
});
