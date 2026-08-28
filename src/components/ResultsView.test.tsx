import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createInitialGameState, gameReducer } from '../game/gameReducer';
import type { GameState } from '../game/types';
import { ResultsView } from './ResultsView';

function completedState(): Extract<GameState, { phase: 'results' }> {
  let state = gameReducer(createInitialGameState(new Date('2026-08-22T12:00:00.000Z')), {
    type: 'START',
  });

  for (let stage = 0; stage < 3; stage += 1) {
    const problem = state.problems[state.stageIndex];
    state = gameReducer(state, {
      type: 'SUBMIT_DIRECT',
      answer: problem.left * problem.right,
    });
    state = gameReducer(state, { type: 'JUST_KNEW' });
    state = gameReducer(state, { type: 'ADVANCE_AFTER_REVEAL' });
  }

  if (state.phase !== 'results') throw new Error('Expected a completed game');
  return state;
}

describe('ResultsView', () => {
  it('copies a spoiler-free summary when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperties(navigator, {
      share: { configurable: true, value: undefined },
      clipboard: { configurable: true, value: { writeText } },
    });

    const state = completedState();
    render(<ResultsView state={state} onReplay={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));

    expect(writeText).toHaveBeenCalledOnce();
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain(`NUMBER SENSE #${state.dailyNumber}`);
    expect(copied).toContain('3 ways seen');
    for (const problem of state.problems) {
      expect(copied).not.toContain(String(problem.left));
      expect(copied).not.toContain(String(problem.right));
    }
    expect(screen.getByRole('status')).toHaveTextContent('Copied to clipboard.');
  });
});
