import { useState } from 'react';
import { formatAlternateView } from '../../data/alternateViews';
import type { GameState } from '../../game/types';
import styles from './SurfTransition.module.css';

type TransitionState = Extract<GameState, { phase: 'surfTransition' }>;

export function SurfTransition({ state, onBegin }: { state: TransitionState; onBegin: () => void }) {
  const [fallback] = useState(() =>
    typeof window !== 'undefined' &&
    (window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  );
  const [beginning, setBeginning] = useState(false);
  const problem = state.problems[state.stageIndex];
  const operand = state.alternate.side === 'left' ? problem.left : problem.right;

  const begin = () => {
    if (beginning) return;
    setBeginning(true);
    if (fallback || !document.body.requestPointerLock) {
      onBegin();
      return;
    }
    try {
      const request = document.body.requestPointerLock();
      if (request && 'then' in request) {
        void request.then(onBegin, onBegin);
      } else {
        onBegin();
      }
    } catch {
      onBegin();
    }
  };

  return (
    <section className={styles.transition} aria-labelledby="transition-title">
      <div className={styles.thoughtLine}>
        <p className={styles.expression}>{operand} = {formatAlternateView(state.alternate)}</p>
        <div className={styles.line} aria-hidden="true"><span /></div>
      </div>
      <h1 id="transition-title">Take the thought with you.</h1>
      <p className={styles.controls}>
        {fallback ? 'A calm glide will carry you onward.' : 'Mouse to look · A / D to lean · Escape releases the mouse'}
      </p>
      <button type="button" className={styles.surfButton} onClick={begin} disabled={beginning} autoFocus>
        {beginning ? 'Opening' : 'Surf'} <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}
