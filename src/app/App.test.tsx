import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/gameReducer';
import { parseDecomposition } from '../math/decomposition';
import { createGuidedPlan } from '../math/guidedSolving';
import { App } from './App';

describe('central math interaction', () => {
  beforeEach(() => window.localStorage.clear());

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

    expect(screen.getByRole('heading', { name: 'Another perspective unfolds' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You saw');
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
