import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState, gameReducer } from '../../game/gameReducer';
import type { GameState } from '../../game/types';
import { createThoughtSequence } from '../../math/thoughtSequence';
import { PresenceReveal } from './PresenceReveal';

function revealState(): Extract<GameState, { phase: 'alternateReveal' }> {
  let state = gameReducer(createInitialGameState(new Date('2026-08-22T12:00:00.000Z')), {
    type: 'START',
  });
  const problem = state.problems[state.stageIndex];
  const view = problem.alternateViews[0];
  state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: view.side });
  state = gameReducer(state, {
    type: 'SUBMIT_DECOMPOSITION',
    input: `${view.left}${view.operator}${view.right}`,
  });
  if (state.phase !== 'guided') throw new Error('Expected guided fixture');
  for (const step of state.plan.steps) {
    state = gameReducer(state, { type: 'SUBMIT_GUIDED', answer: step.expected });
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
  it('supports click, Enter, and Space progression before entering surf transition', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Continue to thought 2/ }));
    expect(region).toHaveAttribute('data-kind', 'focus');
    fireEvent.keyDown(region, { key: 'Enter' });
    expect(region).toHaveAttribute('data-kind', 'decompose');
    fireEvent.keyDown(region, { key: ' ' });
    expect(region).toHaveAttribute('data-kind', 'transform');

    for (let index = 3; index < steps.length - 1; index += 1) {
      fireEvent.keyDown(region, { key: 'Enter' });
    }
    expect(screen.getByRole('button', { name: 'Follow the mathematical line' })).toBeInTheDocument();
    fireEvent.keyDown(region, { key: 'Enter' });
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it('gives the player thought a short automatic acknowledgement', () => {
    vi.useFakeTimers();
    render(<PresenceReveal state={revealState()} onContinue={vi.fn()} />);
    const region = screen.getByRole('region', { name: 'Another perspective unfolds' });
    expect(region).toHaveAttribute('data-kind', 'player');
    act(() => vi.advanceTimersByTime(699));
    expect(region).toHaveAttribute('data-kind', 'player');
    act(() => vi.advanceTimersByTime(1));
    expect(region).toHaveAttribute('data-kind', 'focus');
  });

  it('preserves every reasoning step in reduced-motion mode', () => {
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
    fireEvent.click(screen.getByRole('button', { name: /Continue to thought 2/ }));
    expect(region).toHaveAttribute('data-kind', 'focus');
    expect(screen.getByRole('status')).toHaveTextContent('I looked over here');
  });
});
