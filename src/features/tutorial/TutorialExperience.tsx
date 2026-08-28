import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import appStyles from '../../app/App.module.css';
import { GameHeader } from '../../components/GameHeader';
import type { GameAction, GameState } from '../../game/types';
import { formatExpression, listNumberNodes, numberAtPath } from '../../math/expression';
import type { MathLessonCue } from '../math/MathStage';
import { MathStage } from '../math/MathStage';
import { PresenceReveal } from '../spirit/PresenceReveal';
import {
  createTutorialGameState,
  tutorialReducer,
} from './tutorialState';
import styles from './TutorialExperience.module.css';

function promptKey(state: GameState) {
  if (state.phase === 'decomposing') {
    return `${state.phase}:${state.selectedSide}:${state.afterDirect}`;
  }
  if (state.phase === 'expressionDecomposing') {
    return `${state.phase}:${state.selectedPath.join('.')}`;
  }
  return state.phase;
}

function promptDelays(state: GameState) {
  if (state.phase === 'problem') return [1_200];
  if (state.phase === 'decomposing') return [1_800, 4_500, 7_500];
  if (state.phase === 'expression') return [1_600];
  if (state.phase === 'expressionDecomposing') return [1_800, 4_500];
  return [];
}

function usePromptLevel(state: GameState) {
  const key = promptKey(state);
  const [scaffold, setScaffold] = useState({ key: '', level: 0 });
  useEffect(() => {
    const timers = promptDelays(state).map((delay, index) =>
      window.setTimeout(() => setScaffold({ key, level: index + 1 }), delay),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [key, state]);
  return scaffold.key === key ? scaffold.level : 0;
}

function lessonCue(state: GameState, level: number): MathLessonCue | undefined {
  if (state.phase === 'problem' && level > 0) {
    return {
      message: "Don't like a number? Turn it over.",
      targetSide: 'right',
    };
  }

  if (state.phase === 'decomposing') {
    const problem = state.problems[state.stageIndex];
    const target = state.selectedSide === 'left' ? problem.left : problem.right;
    if (target === 19) {
      if (level >= 3) return { message: 'Try 20 − 1. You still get to type it.' };
      if (level >= 2) return { message: 'What is one more than 19?' };
      if (level >= 1) return { message: '19 is close to something friendly.' };
    }
  }

  if (state.phase === 'expressionTransforming' && state.frameIndex === 0) {
    return { message: 'Same value. Different shape.', tone: 'thesis' };
  }

  if (state.phase === 'expression' && level > 0) {
    const values = listNumberNodes(state.expression).map((item) => item.value);
    return {
      message: 'Still awkward? Turn it over again.',
      ...(values.includes(24) ? { targetValue: 24 } : {}),
    };
  }

  if (state.phase === 'expressionDecomposing') {
    const target = numberAtPath(state.expression, state.selectedPath);
    if (target === 24) {
      if (level >= 2) return { message: 'Try 20 + 4. Same 24, friendlier pieces.' };
      if (level >= 1) return { message: 'Twenty-four can split by place value.' };
    }
  }

  if (state.phase === 'reflection') {
    return {
      message: 'Saw 456 right away? That works too.',
      tone: 'thesis',
    };
  }

  return undefined;
}

function TutorialReveal({
  state,
  onContinue,
}: {
  state: Extract<GameState, { phase: 'alternateReveal' }>;
  onContinue: () => void;
}) {
  const [showStatement, setShowStatement] = useState(true);
  const reveal = useCallback(() => setShowStatement(false), []);

  useEffect(() => {
    const timeout = window.setTimeout(reveal, 1_650);
    return () => window.clearTimeout(timeout);
  }, [reveal]);

  useEffect(() => {
    if (!showStatement) return;
    const skip = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      reveal();
    };
    window.addEventListener('keydown', skip);
    return () => window.removeEventListener('keydown', skip);
  }, [reveal, showStatement]);

  if (!showStatement) return <PresenceReveal state={state} onContinue={onContinue} />;
  return (
    <section className={styles.completion} onClick={reveal} aria-labelledby="lesson-complete-title">
      <p>That is Number Sense</p>
      <h1 id="lesson-complete-title">A number can have many forms.</h1>
      <span>Use the one that helps.</span>
    </section>
  );
}

export function TutorialExperience({
  onComplete,
  onDismiss,
  onHelp,
}: {
  onComplete: () => void;
  onDismiss: () => void;
  onHelp: () => void;
}) {
  const [state, dispatch] = useReducer(tutorialReducer, undefined, createTutorialGameState);
  const promptLevel = usePromptLevel(state);
  const cue = useMemo(() => lessonCue(state, promptLevel), [promptLevel, state]);
  const dispatchGameAction = useCallback((action: GameAction) => dispatch(action), []);

  useEffect(() => {
    if (state.phase !== 'reflection') return;
    const timeout = window.setTimeout(() => dispatch({ type: 'JUST_KNEW' }), 1_200);
    return () => window.clearTimeout(timeout);
  }, [state.phase]);

  const activeExpression = state.phase === 'expression'
    ? formatExpression(state.expression)
    : undefined;

  return (
    <main className={appStyles.shell} data-phase={state.phase} data-tutorial="true">
      <GameHeader
        stageIndex={0}
        phase={state.phase}
        onHelp={onHelp}
        tutorial
      />

      <div className={appStyles.content} data-expression={activeExpression}>
        {(state.phase === 'problem' ||
          state.phase === 'decomposing' ||
          state.phase === 'guided' ||
          state.phase === 'expression' ||
          state.phase === 'expressionDecomposing' ||
          state.phase === 'expressionTransforming' ||
          state.phase === 'reflection') && (
          <MathStage state={state} dispatch={dispatchGameAction} lessonCue={cue} />
        )}

        {state.phase === 'alternateReveal' && (
          <TutorialReveal
            state={state}
            onContinue={onComplete}
          />
        )}
      </div>

      <footer className={appStyles.footer}>
        <span className={styles.footerNote}>First lesson · no account</span>
        <span>Same value. Different shape.</span>
      </footer>

      <button className={styles.skip} type="button" onClick={onDismiss}>
        Skip for now
      </button>
    </main>
  );
}
