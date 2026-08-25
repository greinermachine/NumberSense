import { useReducer } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROBLEM_BANK } from '../../data/problems';
import { createInitialGameState, gameReducer } from '../../game/gameReducer';
import type { GameState } from '../../game/types';
import { expressionRewriteFrameDuration } from '../animationTiming';
import { MathStage } from './MathStage';

type MathState = Extract<
  GameState,
  {
    phase:
      | 'problem'
      | 'decomposing'
      | 'guided'
      | 'expression'
      | 'expressionDecomposing'
      | 'expressionTransforming'
      | 'reflection';
  }
>;

function isMathState(state: GameState): state is MathState {
  return state.phase === 'problem' ||
    state.phase === 'decomposing' ||
    state.phase === 'guided' ||
    state.phase === 'expression' ||
    state.phase === 'expressionDecomposing' ||
    state.phase === 'expressionTransforming' ||
    state.phase === 'reflection';
}

function transformationFixture(): Extract<GameState, { phase: 'expressionTransforming' }> {
  const fixture = PROBLEM_BANK.find((problem) => problem.id === '48x19');
  if (!fixture) throw new Error('Expected 48 × 19 fixture');
  const initial = createInitialGameState(new Date('2026-08-22T12:00:00.000Z'));
  let state: GameState = {
    ...initial,
    problems: [
      fixture,
      ...initial.problems.filter((problem) => problem.id !== fixture.id).slice(0, 2),
    ],
  };
  state = gameReducer(state, { type: 'START' });
  state = gameReducer(state, { type: 'OPEN_DECOMPOSITION', side: 'left' });
  state = gameReducer(state, { type: 'SUBMIT_DECOMPOSITION', input: '50-2' });
  state = gameReducer(state, { type: 'OPEN_EXPRESSION_DECOMPOSITION', path: ['right'] });
  state = gameReducer(state, { type: 'SUBMIT_EXPRESSION_DECOMPOSITION', input: '20-1' });
  if (state.phase !== 'expressionTransforming') {
    throw new Error('Expected a deterministic recursive rewrite');
  }
  return state;
}

function observedAnswerFixture(): Extract<GameState, { phase: 'guided' }> {
  let state: GameState = transformationFixture();
  while (state.phase === 'expressionTransforming') {
    state = gameReducer(state, { type: 'ADVANCE_EXPRESSION_TRANSFORM' });
  }
  if (state.phase !== 'guided') throw new Error('Expected 50 × 20 − 50 × 1');
  return state;
}

function TransformationHarness({ initial }: { initial: GameState }) {
  const [state, dispatch] = useReducer(gameReducer, initial);
  if (!isMathState(state)) return <div data-testid="left-math" data-phase={state.phase} />;
  return <MathStage state={state} dispatch={dispatch} />;
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

describe('automatic expression transformations', () => {
  it('accepts and visibly resolves the observed expression answer without Continue', () => {
    vi.useFakeTimers();
    const initial = observedAnswerFixture();
    render(<TransformationHarness initial={initial} />);

    const input = screen.getByLabelText('Your answer');
    expect(input).toHaveAttribute('inputmode', 'text');
    expect(input).toHaveAttribute('maxlength', '64');
    fireEvent.change(input, { target: { value: '1000 - 50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Check this calculation' }));

    expect(screen.getByText('Same value.')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAccessibleName(
      'Accepted. Same value: 1000 − 50',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Continue/ })).not.toBeInTheDocument();

    const frameMs = expressionRewriteFrameDuration(2, false);
    act(() => vi.advanceTimersByTime(frameMs));
    expect(screen.getByRole('status')).toHaveAccessibleName('950');

    act(() => vi.advanceTimersByTime(frameMs));
    expect(screen.getByRole('heading', { name: 'Solve 2 times 19' })).toBeInTheDocument();
  });

  it('gives the requested recursive rewrite three readable seconds with no Continue button', () => {
    vi.useFakeTimers();
    const state = transformationFixture();
    const frameMs = expressionRewriteFrameDuration(state.frames.length, false);
    render(<TransformationHarness initial={state} />);

    expect(screen.getByRole('status')).toHaveAccessibleName(
      '50 × (20 − 1) − 2 × 19',
    );
    expect(screen.queryByRole('button', { name: /Continue/ })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(frameMs));
    expect(screen.getByRole('status')).toHaveAccessibleName(
      '50 × 20 − 50 × 1 − 2 × 19',
    );

    act(() => vi.advanceTimersByTime(frameMs));
    expect(screen.getByRole('heading', {
      name: 'Solve 50 times 20 minus 50 times 1',
    })).toBeInTheDocument();
    expect(frameMs * state.frames.length).toBe(3_000);
    expect(expressionRewriteFrameDuration(5, false) * 5).toBe(5_500);
  });

  it('uses Enter, Space, and click to skip frames rather than to continue manually', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <MathStage state={transformationFixture()} dispatch={vi.fn()} />,
    );
    const dispatch = vi.fn();
    rerender(<MathStage state={transformationFixture()} dispatch={dispatch} />);

    fireEvent.keyDown(window, { key: 'Enter' });
    fireEvent.keyDown(window, { key: ' ' });
    fireEvent.click(screen.getByRole('status'));

    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'ADVANCE_EXPRESSION_TRANSFORM' });
    expect(screen.queryByRole('button', { name: /Continue/ })).not.toBeInTheDocument();
  });

  it('shortens pacing and marks the stepped crossfade path for reduced motion', () => {
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
    const state = transformationFixture();
    const dispatch = vi.fn();
    render(<MathStage state={state} dispatch={dispatch} />);

    expect(screen.getByRole('status').parentElement).toHaveAttribute('data-motion', 'reduced');
    const frameMs = expressionRewriteFrameDuration(state.frames.length, true);
    act(() => vi.advanceTimersByTime(frameMs - 1));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADVANCE_EXPRESSION_TRANSFORM' });
    expect(frameMs * state.frames.length).toBe(2_400);
    expect(expressionRewriteFrameDuration(5, true) * 5).toBe(4_500);
  });
});
