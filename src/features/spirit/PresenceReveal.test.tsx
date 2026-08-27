import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState, gameReducer } from '../../game/gameReducer';
import type { GameState } from '../../game/types';
import { evaluateExpression } from '../../math/expression';
import { createThoughtSequence } from '../../math/thoughtSequence';
import { REDUCED_THOUGHT_STEP_MS } from '../animationTiming';
import { PresenceReveal } from './PresenceReveal';

function revealState(): Extract<GameState, { phase: 'alternateReveal' }> {
  let state = gameReducer(createInitialGameState(new Date('2026-08-22T12:00:00.000Z')), {
    type: 'START',
  });
  const problem = state.problems[state.stageIndex];
  const view = problem.teachingViews[0];
  state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: view.side });
  state = gameReducer(state, {
    type: 'SUBMIT_DECOMPOSITION',
    input: `${view.left}${view.operator}${view.right}`,
  });
  if (state.phase !== 'guided') throw new Error('Expected guided fixture');
  for (const step of state.plan.steps) {
    state = gameReducer(state, { type: 'SUBMIT_GUIDED', answer: step.expected });
  }
  if (state.phase === 'expression') {
    state = gameReducer(state, {
      type: 'SUBMIT_EXPRESSION_ANSWER',
      answer: evaluateExpression(state.expression),
    });
  }
  if (state.phase !== 'alternateReveal') throw new Error('Expected reveal fixture');
  return state;
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  });
});

describe('PresenceReveal', () => {
  it('advances every deterministic thought automatically before the surf-entry screen', async () => {
    vi.useFakeTimers();
    const state = revealState();
    const onContinue = vi.fn();
    const steps = createThoughtSequence(
      state.problems[state.stageIndex],
      state.alternate,
      state.discoveries[state.stageIndex].at(-1),
    );
    render(<PresenceReveal state={state} onContinue={onContinue} />);

    const region = screen.getByRole('region', { name: 'Another perspective unfolds' });
    expect(region).toHaveAttribute('data-kind', 'player');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    for (let index = 0; index < steps.length; index += 1) {
      await act(async () => vi.advanceTimersToNextTimerAsync());
      if (index < steps.length - 1) {
        expect(region).toHaveAttribute('data-kind', steps[index + 1].kind);
        expect(onContinue).not.toHaveBeenCalled();
      }
    }
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('lets click, Enter, and Space skip an in-progress step without a Continue control', () => {
    vi.useFakeTimers();
    const onContinue = vi.fn();
    render(<PresenceReveal state={revealState()} onContinue={onContinue} />);
    const region = screen.getByRole('region', { name: 'Another perspective unfolds' });

    expect(region).toHaveAttribute('data-kind', 'player');
    fireEvent.click(region);
    expect(region).toHaveAttribute('data-kind', 'focus');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(region).toHaveAttribute('data-kind', 'decompose');
    fireEvent.keyDown(window, { key: ' ' });
    expect(region).toHaveAttribute('data-kind', 'transform');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('uses quick automatic steps while preserving reduced-motion reasoning states', () => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: '(prefers-reduced-motion: reduce)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    render(<PresenceReveal state={revealState()} onContinue={vi.fn()} />);
    const region = screen.getByRole('region', { name: 'Another perspective unfolds' });
    expect(region).toHaveAttribute('data-motion', 'reduced');
    act(() => vi.advanceTimersByTime(REDUCED_THOUGHT_STEP_MS - 1));
    expect(region).toHaveAttribute('data-kind', 'player');
    act(() => vi.advanceTimersByTime(1));
    expect(region).toHaveAttribute('data-kind', 'focus');
    expect(screen.getByRole('status')).toHaveTextContent('I looked over here');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
