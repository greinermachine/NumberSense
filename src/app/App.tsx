import { lazy, Suspense, useEffect, useReducer, useState } from 'react';
import { GameHeader } from '../components/GameHeader';
import { IntroScreen } from '../components/IntroScreen';
import { ResultsView } from '../components/ResultsView';
import { PROBLEM_BANK } from '../data/problems';
import { MathStage } from '../features/math/MathStage';
import { PresenceReveal } from '../features/spirit/PresenceReveal';
import { SurfTransition } from '../features/surf/SurfTransition';
import { createInitialGameState, gameReducer } from '../game/gameReducer';
import { restoreGameState, serializeGameState, STORAGE_KEY } from '../game/persistence';
import styles from './App.module.css';

const SurfExperience = lazy(() => import('../features/surf/SurfExperience'));

function requestedDevelopmentProblem() {
  if (!import.meta.env.DEV || typeof window === 'undefined') return undefined;
  const id = new URLSearchParams(window.location.search).get('mathProblem');
  return id ? PROBLEM_BANK.find((problem) => problem.id === id) : undefined;
}

function loadInitialState() {
  if (typeof window === 'undefined') return createInitialGameState();
  const requestedProblem = requestedDevelopmentProblem();
  if (requestedProblem) {
    const initial = createInitialGameState();
    return {
      ...initial,
      problems: [
        requestedProblem,
        ...initial.problems.filter((problem) => problem.id !== requestedProblem.id).slice(0, 2),
      ],
    };
  }
  try {
    return restoreGameState(window.localStorage.getItem(STORAGE_KEY)) ?? createInitialGameState();
  } catch {
    return createInitialGameState();
  }
}

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadInitialState);
  const [helpOpen, setHelpOpen] = useState(false);
  const developmentProblem = requestedDevelopmentProblem();

  useEffect(() => {
    if (developmentProblem) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, serializeGameState(state));
    } catch {
      // Storage can be blocked in private contexts; the game remains fully playable.
    }
  }, [developmentProblem, state]);

  useEffect(() => {
    if (state.phase !== 'intro') void import('../features/surf/SurfExperience');
  }, [state.phase]);

  useEffect(() => {
    if (!helpOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHelpOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [helpOpen]);

  if (state.phase === 'surfing') {
    return (
      <Suspense fallback={<div className={styles.surfLoading}>The line is forming…</div>}>
        <SurfExperience
          courseIndex={state.courseIndex}
          onComplete={() => dispatch({ type: 'FINISH_SURF' })}
        />
      </Suspense>
    );
  }

  return (
    <main className={styles.shell} data-phase={state.phase}>
      <GameHeader
        stageIndex={state.stageIndex}
        phase={state.phase}
        onHelp={() => setHelpOpen(true)}
      />

      <div className={styles.content}>
        {state.phase === 'intro' && (
          <IntroScreen onBegin={() => dispatch({ type: 'START' })} />
        )}

        {(state.phase === 'problem' ||
          state.phase === 'decomposing' ||
          state.phase === 'guided' ||
          state.phase === 'expression' ||
          state.phase === 'expressionDecomposing' ||
          state.phase === 'expressionTransforming' ||
          state.phase === 'reflection') && (
          <MathStage state={state} dispatch={dispatch} />
        )}

        {state.phase === 'alternateReveal' && (
          <PresenceReveal
            state={state}
            onContinue={() => dispatch({ type: 'CONTINUE_TO_SURF' })}
          />
        )}

        {state.phase === 'surfTransition' && (
          <SurfTransition
            state={state}
            onBegin={() => dispatch({ type: 'BEGIN_SURF' })}
          />
        )}

        {state.phase === 'results' && (
          <ResultsView state={state} onReplay={() => dispatch({ type: 'START_OVER' })} />
        )}
      </div>

      <footer className={styles.footer}>
        <span>Daily · no account</span>
        <span>There’s always another way.</span>
      </footer>

      {helpOpen && (
        <div className={styles.helpLayer} role="presentation" onMouseDown={() => setHelpOpen(false)}>
          <section
            className={styles.helpPanel}
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className={styles.helpClose}
              type="button"
              onClick={() => setHelpOpen(false)}
              aria-label="Close how to play"
              autoFocus
            >
              ×
            </button>
            <p className={styles.helpKicker}>How to play</p>
            <h2 id="help-title">Turn the number over.</h2>
            <p>Solve directly, or select any active number and type another way to make it. You can do that again whenever the arithmetic gets awkward.</p>
            <div className={styles.helpExample} aria-label="Example: nineteen equals twenty minus one">
              <span>19</span><span>=</span><span>20 − 1</span>
            </div>
            <p>Follow your idea through, see another perspective, then ride the line it leaves behind.</p>
            <p className={styles.helpKeys}><kbd>Enter</kbd> submits · <kbd>Esc</kbd> closes · surf with mouse + <kbd>A</kbd>/<kbd>D</kbd></p>
          </section>
        </div>
      )}
    </main>
  );
}
