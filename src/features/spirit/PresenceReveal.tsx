import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameState } from '../../game/types';
import { createThoughtSequence } from '../../math/thoughtSequence';
import {
  REDUCED_THOUGHT_STEP_MS,
  THOUGHT_HANDOFF_MS,
  THOUGHT_STEP_MS,
} from '../animationTiming';
import styles from './PresenceReveal.module.css';

type RevealState = Extract<GameState, { phase: 'alternateReveal' }>;
type AdvanceSource = 'auto' | 'keyboard' | 'pointer';

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

export function PresenceReveal({ state, onContinue }: { state: RevealState; onContinue: () => void }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [advanceSource, setAdvanceSource] = useState<AdvanceSource>('auto');
  const reducedMotion = usePrefersReducedMotion();
  const problem = state.problems[state.stageIndex];
  const playerThought = state.discoveries[state.stageIndex].at(-1);
  const steps = useMemo(
    () => createThoughtSequence(problem, state.alternate, playerThought),
    [playerThought, problem, state.alternate],
  );
  const step = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;

  const advance = useCallback((source: AdvanceSource) => {
    setAdvanceSource(source);
    if (isLastStep) {
      onContinue();
      return;
    }
    setStepIndex((current) => Math.min(current + 1, steps.length - 1));
  }, [isLastStep, onContinue, steps.length]);

  useEffect(() => {
    const delay = reducedMotion
      ? REDUCED_THOUGHT_STEP_MS
      : step.autoAdvanceMs ?? (isLastStep ? THOUGHT_HANDOFF_MS : THOUGHT_STEP_MS);
    const timeout = window.setTimeout(() => advance('auto'), delay);
    return () => window.clearTimeout(timeout);
  }, [advance, isLastStep, reducedMotion, step.autoAdvanceMs, step.id]);

  useEffect(() => {
    const skipCurrentStep = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      advance('keyboard');
    };
    window.addEventListener('keydown', skipCurrentStep);
    return () => window.removeEventListener('keydown', skipCurrentStep);
  }, [advance]);

  const announcement = [step.annotation, step.accessibleExpression]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={styles.reveal}
      aria-labelledby="alternate-title"
      data-kind={step.kind}
      data-input={advanceSource}
      data-motion={reducedMotion ? 'reduced' : 'full'}
      onClick={() => advance('pointer')}
    >
      <h1 id="alternate-title" className={styles.srOnly}>Another perspective unfolds</h1>
      <p className={styles.srOnly}>
        This mathematical sequence advances automatically. Press Enter or Space to skip a step.
      </p>

      <div
        className={styles.presence}
        data-side={step.emphasisSide ?? 'center'}
        aria-hidden="true"
      >
        <span />
      </div>

      <div className={styles.thought}>
        <p className={styles.annotation} aria-hidden="true">
          {step.annotation ?? '\u00a0'}
        </p>

        <div
          key={step.id}
          className={styles.expressionFrame}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className={styles.srOnly}>{announcement}</span>
          <div className={styles.expressionVisual} aria-hidden="true">
            {step.parts.map((item) => (
              <span
                key={item.id}
                className={styles.part}
                data-tone={item.tone}
              >
                {item.text}
              </span>
            ))}
            {step.extendsLine && (
              <span className={styles.handoffLine}><span /></span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.progress} aria-label={`Thought ${stepIndex + 1} of ${steps.length}`}>
        {steps.map((item, index) => (
          <span key={item.id} data-current={index === stepIndex} />
        ))}
      </div>
    </section>
  );
}
