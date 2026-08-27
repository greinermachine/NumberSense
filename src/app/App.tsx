import { lazy, Suspense, useEffect, useReducer, useState } from 'react';
import { GameHeader } from '../components/GameHeader';
import { HelpDialog } from '../components/HelpDialog';
import { IntroScreen } from '../components/IntroScreen';
import { ResultsView } from '../components/ResultsView';
import { PROBLEM_BANK } from '../data/problems';
import { MathStage } from '../features/math/MathStage';
import { PresenceReveal } from '../features/spirit/PresenceReveal';
import { SurfTransition } from '../features/surf/SurfTransition';
import { TutorialExperience } from '../features/tutorial/TutorialExperience';
import { createInitialGameState, gameReducer } from '../game/gameReducer';
import { restoreGameState, serializeGameState, STORAGE_KEY } from '../game/persistence';
import {
  serializeTutorialProgress,
  shouldLaunchTutorial,
  TUTORIAL_STORAGE_KEY,
  type TutorialOutcome,
} from '../game/tutorialPersistence';
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

function loadTutorialSession() {
  if (typeof window === 'undefined' || requestedDevelopmentProblem()) return null;
  try {
    return shouldLaunchTutorial(window.localStorage.getItem(TUTORIAL_STORAGE_KEY)) ? 0 : null;
  } catch {
    // If storage is blocked, show the lesson once for this in-memory session.
    return 0;
  }
}

export function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, loadInitialState);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tutorialSession, setTutorialSession] = useState<number | null>(loadTutorialSession);
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

  const finishTutorial = (outcome: TutorialOutcome) => {
    try {
      window.localStorage.setItem(
        TUTORIAL_STORAGE_KEY,
        serializeTutorialProgress(outcome),
      );
    } catch {
      // Completion still applies for this page even when persistence is blocked.
    }
    setTutorialSession(null);
  };

  const replayTutorial = () => {
    setHelpOpen(false);
    setTutorialSession((current) => current === null ? 0 : current + 1);
  };

  if (tutorialSession !== null) {
    return (
      <>
        <TutorialExperience
          key={tutorialSession}
          onComplete={() => finishTutorial('completed')}
          onDismiss={() => finishTutorial('dismissed')}
          onHelp={() => setHelpOpen(true)}
        />
        {helpOpen && (
          <HelpDialog
            onClose={() => setHelpOpen(false)}
            onReplayTutorial={replayTutorial}
          />
        )}
      </>
    );
  }

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
        <HelpDialog
          onClose={() => setHelpOpen(false)}
          onReplayTutorial={replayTutorial}
        />
      )}
    </main>
  );
}
