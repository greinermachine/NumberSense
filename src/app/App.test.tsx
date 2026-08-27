import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInitialGameState } from '../game/gameReducer';
import { serializeGameState, STORAGE_KEY } from '../game/persistence';
import {
  serializeTutorialProgress,
  TUTORIAL_STORAGE_KEY,
} from '../game/tutorialPersistence';
import { parseDecomposition } from '../math/decomposition';
import { createGuidedPlan } from '../math/guidedSolving';
import { App } from './App';

describe('central math interaction', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      serializeTutorialProgress('completed'),
    );
    window.history.replaceState({}, '', '/');
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
  });

  it('opens an operand, accepts a valid typed view, and completes guided work', async () => {
    const user = userEvent.setup();
    const initial = createInitialGameState();
    const problem = initial.problems[0];
    const view = problem.teachingViews[0];
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
      const input = screen.getByLabelText('Your answer');
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
    const view = problem.teachingViews.find(
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
        screen.getByLabelText('Your answer'),
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
    expect(screen.queryByRole('button', { name: /Continue/ })).not.toBeInTheDocument();

    for (let frame = 0; frame < 6 && screen.queryByRole('status'); frame += 1) {
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

  it('lets a guided partial product recurse through multiplication without losing context', async () => {
    const user = userEvent.setup();
    window.history.replaceState({}, '', '/?mathProblem=36x12');

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Begin' }));
    expect(screen.getByRole('heading', { name: '36 times 12' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Explore another way to make 36' }));
    await user.type(screen.getByLabelText('Another way to make 36'), '40-4');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('heading', { name: 'Solve 40 times 12' })).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Explore another way to make 40 in this expression' }),
    );
    await user.type(screen.getByLabelText('Another way to make 40'), '4*10');
    await user.keyboard('{Enter}');

    expect(screen.getByRole('status')).toHaveAccessibleName('(4 × 10) × 12 − 4 × 12');
    expect(screen.queryByRole('button', { name: /Continue/ })).not.toBeInTheDocument();

    for (let frame = 0; frame < 6 && screen.queryByRole('status'); frame += 1) {
      await user.keyboard('{Enter}');
    }
    expect(screen.getByRole('heading', { name: 'Solve 4 times 12' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Your answer'), '48');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: 'Solve 480 minus 48' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Your answer'), '432');
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

describe('first-run lesson', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, '', '/');
  });

  it('launches on the first visit and persists a skip without nagging again', async () => {
    const user = userEvent.setup();
    const view = render(<App />);

    expect(screen.getByRole('heading', { name: '24 times 19' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(TUTORIAL_STORAGE_KEY)!)).toMatchObject({
      version: 1,
      completed: true,
      outcome: 'dismissed',
    });

    view.unmount();
    render(<App />);
    expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '24 times 19' })).not.toBeInTheDocument();
  });

  it('does not relaunch a completed current tutorial version', () => {
    window.localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      serializeTutorialProgress('completed'),
    );
    render(<App />);
    expect(screen.getByRole('button', { name: 'Begin' })).toBeInTheDocument();
  });

  it('replays from help and returns to the untouched daily checkpoint', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      TUTORIAL_STORAGE_KEY,
      serializeTutorialProgress('completed'),
    );
    const daily = createInitialGameState();
    const started = { ...daily, phase: 'problem' as const };
    window.localStorage.setItem(STORAGE_KEY, serializeGameState(started));

    render(<App />);
    const dailyProblem = started.problems[0];
    expect(
      screen.getByRole('heading', { name: `${dailyProblem.left} times ${dailyProblem.right}` }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'How to play' }));
    await user.click(screen.getByRole('button', { name: 'Replay interactive lesson' }));
    expect(screen.getByRole('heading', { name: '24 times 19' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(
      screen.getByRole('heading', { name: `${dailyProblem.left} times ${dailyProblem.right}` }),
    ).toBeInTheDocument();
  });
});
