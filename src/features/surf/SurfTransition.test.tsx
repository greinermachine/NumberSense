import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGameState, gameReducer } from '../../game/gameReducer';
import type { GameState } from '../../game/types';
import { SurfTransition } from './SurfTransition';

function transitionState(): Extract<GameState, { phase: 'surfTransition' }> {
  let state = gameReducer(
    createInitialGameState(new Date('2026-08-22T12:00:00.000Z')),
    { type: 'START' },
  );
  const problem = state.problems[state.stageIndex];
  state = gameReducer(state, {
    type: 'SUBMIT_DIRECT',
    answer: problem.left * problem.right,
  });
  state = gameReducer(state, { type: 'JUST_KNEW' });
  state = gameReducer(state, { type: 'CONTINUE_TO_SURF' });
  if (state.phase !== 'surfTransition') throw new Error('Expected surf transition fixture');
  return state;
}

function useFinePointer() {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches: false,
      media: '',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

const originalMatchMedia = window.matchMedia;

afterEach(() => {
  cleanup();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: originalMatchMedia,
  });
  Object.defineProperty(document.body, 'requestPointerLock', {
    configurable: true,
    value: undefined,
  });
});

describe('SurfTransition', () => {
  it('waits for pointer lock before entering the first-person scene', async () => {
    useFinePointer();
    let resolveLock!: () => void;
    const lockRequest = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    const requestPointerLock = vi.fn().mockReturnValue(lockRequest);
    Object.defineProperty(document.body, 'requestPointerLock', {
      configurable: true,
      value: requestPointerLock,
    });
    const onBegin = vi.fn();
    render(<SurfTransition state={transitionState()} onBegin={onBegin} />);

    await userEvent.click(screen.getByRole('button', { name: /Surf/ }));
    expect(requestPointerLock).toHaveBeenCalledOnce();
    expect(onBegin).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Opening/ })).toBeDisabled();

    await act(async () => {
      resolveLock();
      await lockRequest;
    });
    expect(onBegin).toHaveBeenCalledOnce();
  });

  it('enters a paused-capable scene when pointer lock is denied', async () => {
    useFinePointer();
    Object.defineProperty(document.body, 'requestPointerLock', {
      configurable: true,
      value: vi.fn().mockRejectedValue(new Error('Pointer lock denied')),
    });
    const onBegin = vi.fn();
    render(<SurfTransition state={transitionState()} onBegin={onBegin} />);

    await userEvent.click(screen.getByRole('button', { name: /Surf/ }));
    expect(onBegin).toHaveBeenCalledOnce();
  });

  it('uses the no-fail tutorial handoff without requesting pointer lock', async () => {
    useFinePointer();
    const requestPointerLock = vi.fn();
    Object.defineProperty(document.body, 'requestPointerLock', {
      configurable: true,
      value: requestPointerLock,
    });
    const onBegin = vi.fn();
    render(
      <SurfTransition state={transitionState()} onBegin={onBegin} forceCalm />,
    );

    expect(screen.getByText('A calm glide will carry you onward.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Surf/ }));
    expect(requestPointerLock).not.toHaveBeenCalled();
    expect(onBegin).toHaveBeenCalledOnce();
  });
});
