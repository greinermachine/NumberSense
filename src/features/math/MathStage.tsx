import { useEffect, useRef, useState, type Dispatch, type FormEvent } from 'react';
import type { GameAction, GameState } from '../../game/types';
import styles from './MathStage.module.css';

type MathState = Extract<
  GameState,
  { phase: 'problem' | 'decomposing' | 'guided' | 'reflection' }
>;

type Props = { state: MathState; dispatch: Dispatch<GameAction> };

export function MathStage({ state, dispatch }: Props) {
  const problem = state.problems[state.stageIndex];
  const [directAnswer, setDirectAnswer] = useState('');
  const [decomposition, setDecomposition] = useState('');
  const [guidedAnswer, setGuidedAnswer] = useState('');
  const guidedInput = useRef<HTMLInputElement>(null);
  const decompositionInput = useRef<HTMLInputElement>(null);
  const hintVisible = state.hintsUsed[state.stageIndex];
  const decompositionSide = state.phase === 'decomposing' ? state.selectedSide : undefined;
  const guidedStep = state.phase === 'guided' ? state.stepIndex : -1;

  useEffect(() => {
    if (state.phase === 'decomposing') {
      decompositionInput.current?.focus();
    }
  }, [decompositionSide, state.phase]);

  useEffect(() => {
    if (state.phase === 'guided') {
      guidedInput.current?.focus();
    }
  }, [guidedStep, state.phase]);

  useEffect(() => {
    if (state.phase !== 'decomposing') return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dispatch({ type: 'CLOSE_DECOMPOSITION' });
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [dispatch, state.phase]);

  const submitDirect = (event: FormEvent) => {
    event.preventDefault();
    const answer = Number(directAnswer.trim());
    if (Number.isInteger(answer)) dispatch({ type: 'SUBMIT_DIRECT', answer });
  };

  const submitDecomposition = (event: FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'SUBMIT_DECOMPOSITION', input: decomposition });
  };

  const submitGuided = (event: FormEvent) => {
    event.preventDefault();
    const answer = Number(guidedAnswer.trim());
    if (Number.isInteger(answer)) {
      const isCorrect =
        state.phase === 'guided' &&
        answer === state.plan.steps[state.stepIndex].expected;
      dispatch({ type: 'SUBMIT_GUIDED', answer });
      if (isCorrect) setGuidedAnswer('');
    }
  };

  const openDecomposition = (side: 'left' | 'right') => {
    setDecomposition('');
    dispatch({ type: 'OPEN_DECOMPOSITION', side });
  };

  const selectedSide = state.phase === 'decomposing' || state.phase === 'guided'
    ? state.selectedSide
    : undefined;

  return (
    <section className={styles.stage} aria-labelledby="problem-heading">
      <p className={styles.kicker}>Turn it over</p>
      <h1 id="problem-heading" className={styles.srOnly}>
        {problem.left} times {problem.right}
      </h1>

      <div className={styles.expression}>
        <Operand
          value={problem.left}
          side="left"
          selected={selectedSide === 'left'}
          disabled={state.phase === 'guided'}
          onSelect={() => openDecomposition('left')}
        />
        <span className={styles.times} aria-hidden="true">×</span>
        <Operand
          value={problem.right}
          side="right"
          selected={selectedSide === 'right'}
          disabled={state.phase === 'guided'}
          onSelect={() => openDecomposition('right')}
        />
      </div>

      {state.phase === 'decomposing' && (
        <form className={styles.decomposition} onSubmit={submitDecomposition}>
          <span className={styles.stem} aria-hidden="true" />
          <label htmlFor="decomposition-input">
            Another way to make {state.selectedSide === 'left' ? problem.left : problem.right}
          </label>
          <div className={styles.decompositionRow}>
            <span className={styles.equals} aria-hidden="true">=</span>
            <input
              ref={decompositionInput}
              id="decomposition-input"
              value={decomposition}
              onChange={(event) => setDecomposition(event.target.value)}
              placeholder="20 − 1"
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={state.inputError ? 'decomposition-error' : 'decomposition-note'}
            />
            <button type="submit" aria-label="Use this decomposition">→</button>
          </div>
          <p id="decomposition-note" className={styles.microcopy}>Use +, −, or ×</p>
          {state.inputError && <p id="decomposition-error" className={styles.feedback} role="alert">{state.inputError}</p>}
        </form>
      )}

      {state.phase === 'guided' && (
        <div className={styles.guided}>
          <p className={styles.transformed}>{state.plan.expressionLabel}</p>
          <div className={styles.steps}>
            {state.plan.steps.slice(0, state.stepIndex).map((step, index) => (
              <div className={styles.completedStep} key={step.id}>
                <span>{step.before}</span><strong>{state.answers[index]}</strong>
              </div>
            ))}
            <form className={styles.activeStep} onSubmit={submitGuided} data-error={Boolean(state.feedback)}>
              <label htmlFor="guided-answer" className={styles.srOnly}>
                Complete {state.plan.steps[state.stepIndex].before}
              </label>
              <span>{state.plan.steps[state.stepIndex].before}</span>
              <input
                ref={guidedInput}
                id="guided-answer"
                inputMode="numeric"
                autoComplete="off"
                value={guidedAnswer}
                onChange={(event) => setGuidedAnswer(event.target.value)}
                aria-describedby={state.feedback ? 'guided-feedback' : undefined}
              />
              <button type="submit" aria-label="Check this calculation">→</button>
            </form>
          </div>
          {state.feedback && <p id="guided-feedback" className={styles.feedback} role="alert">{state.feedback}</p>}
        </div>
      )}

      {state.phase === 'reflection' && (
        <div className={styles.reflection}>
          <p className={styles.settled}>{problem.left * problem.right}</p>
          <h2>How did you see it?</h2>
          <div className={styles.reflectionActions}>
            <button type="button" onClick={() => openDecomposition('left')}>
              Turn over {problem.left}
            </button>
            <button type="button" onClick={() => openDecomposition('right')}>
              Turn over {problem.right}
            </button>
          </div>
          <button className={styles.justKnew} type="button" onClick={() => dispatch({ type: 'JUST_KNEW' })}>
            I just knew it
          </button>
        </div>
      )}

      {(state.phase === 'problem' || (state.phase === 'decomposing' && !state.afterDirect)) && (
        <form className={styles.direct} onSubmit={submitDirect} data-error={state.phase === 'problem' && Boolean(state.feedback)}>
          <label htmlFor="direct-answer">Your answer</label>
          <div className={styles.answerLine}>
            <input
              id="direct-answer"
              inputMode="numeric"
              autoComplete="off"
              value={directAnswer}
              onChange={(event) => setDirectAnswer(event.target.value)}
            />
            <button type="submit" aria-label="Check answer">→</button>
          </div>
          {state.phase === 'problem' && state.feedback && (
            <p className={styles.feedback} role="alert">{state.feedback}</p>
          )}
        </form>
      )}

      {state.phase !== 'reflection' && (
        <div className={styles.hintArea}>
          <button
            className={styles.hintButton}
            type="button"
            aria-expanded={hintVisible}
            onClick={() => dispatch({ type: 'USE_HINT' })}
          >
            Hint
          </button>
          {hintVisible && <p className={styles.hintText}>{problem.hint.text}</p>}
        </div>
      )}
    </section>
  );
}

type OperandProps = {
  value: number;
  side: 'left' | 'right';
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
};

function Operand({ value, side, selected, disabled, onSelect }: OperandProps) {
  return (
    <button
      type="button"
      className={styles.operand}
      data-selected={selected}
      data-side={side}
      aria-label={`Explore another way to make ${value}`}
      disabled={disabled}
      onClick={onSelect}
    >
      <span>{value}</span><span className={styles.plus}>+</span>
    </button>
  );
}
