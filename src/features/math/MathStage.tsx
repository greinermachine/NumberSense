import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
} from 'react';
import type { GameAction, GameState } from '../../game/types';
import { MAX_ANSWER_EXPRESSION_LENGTH } from '../../math/answerExpression';
import {
  formatExpression,
  expressionAtPath,
  listNumberNodes,
  MAX_RECURSIVE_MANIPULATIONS,
  numberAtPath,
  speakExpression,
  type ExpressionTransformFrame,
} from '../../math/expression';
import { createExpressionAssistance } from '../../math/expressionHints';
import type {
  BinaryOperator,
  ExpressionPath,
  MathExpression,
} from '../../math/types';
import { expressionRewriteFrameDuration } from '../animationTiming';
import styles from './MathStage.module.css';

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

type Props = { state: MathState; dispatch: Dispatch<GameAction> };

const pathKey = (path: ExpressionPath) => path.join('.');

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

function transformationAnnotation(kind: ExpressionTransformFrame['kind']) {
  switch (kind) {
    case 'answer':
      return 'Same value.';
    case 'replace':
      return 'Same value, inside the expression.';
    case 'sign':
      return 'Watch what subtraction does to the signs.';
    case 'distribute':
      return 'The factor reaches both parts.';
    case 'reorder':
      return 'Choose what to multiply first.';
    case 'regroup':
    case 'reassociate':
      return 'Try these together.';
    default:
      return undefined;
  }
}

export function MathStage({ state, dispatch }: Props) {
  const problem = state.problems[state.stageIndex];
  const [directAnswer, setDirectAnswer] = useState('');
  const [decomposition, setDecomposition] = useState('');
  const decompositionInput = useRef<HTMLInputElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const originalHintVisible = state.hintsUsed[state.stageIndex];
  const decompositionSide = state.phase === 'decomposing' ? state.selectedSide : undefined;
  const decompositionPath = state.phase === 'expressionDecomposing'
    ? pathKey(state.selectedPath)
    : undefined;
  const guidedStep = state.phase === 'guided' ? state.stepIndex : -1;
  const activeFullExpression = state.phase === 'guided'
    ? state.workingExpression
    : state.phase === 'expression' || state.phase === 'expressionDecomposing'
      ? state.expression
      : undefined;
  const activeFocusPath: ExpressionPath = state.phase === 'guided'
    ? state.plan.steps[state.stepIndex].path
    : state.phase === 'expressionDecomposing' && state.continuation.type === 'guided'
      ? state.continuation.plan.steps[state.continuation.stepIndex].path
      : [];
  const activeExpression = activeFullExpression
    ? expressionAtPath(activeFullExpression, activeFocusPath) ?? undefined
    : undefined;
  const activeExpressionLabel = activeExpression
    ? formatExpression(activeExpression)
    : undefined;
  const recursiveDepth = state.manipulationCounts[state.stageIndex];
  const assistance = useMemo(
    () => activeExpression
      ? createExpressionAssistance(
          activeExpression,
          state.hintCounts[state.stageIndex],
          state.attemptCounts[state.stageIndex],
          recursiveDepth >= MAX_RECURSIVE_MANIPULATIONS,
        )
      : undefined,
    [activeExpression, recursiveDepth, state.attemptCounts, state.hintCounts, state.stageIndex],
  );

  useEffect(() => {
    if (state.phase === 'decomposing' || state.phase === 'expressionDecomposing') {
      decompositionInput.current?.focus();
    }
  }, [decompositionPath, decompositionSide, state.phase]);

  useEffect(() => {
    if (state.phase !== 'decomposing' && state.phase !== 'expressionDecomposing') {
      return;
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      dispatch({
        type: state.phase === 'decomposing'
          ? 'CLOSE_DECOMPOSITION'
          : 'CLOSE_EXPRESSION_DECOMPOSITION',
      });
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [dispatch, state.phase]);

  const advanceTransformation = useCallback(() => {
    if (state.phase === 'expressionTransforming') {
      dispatch({ type: 'ADVANCE_EXPRESSION_TRANSFORM' });
    }
  }, [dispatch, state.phase]);

  useEffect(() => {
    if (state.phase !== 'expressionTransforming') return;
    const timeout = window.setTimeout(
      advanceTransformation,
      expressionRewriteFrameDuration(state.frames.length, reducedMotion),
    );
    return () => window.clearTimeout(timeout);
  }, [advanceTransformation, reducedMotion, state]);

  useEffect(() => {
    if (state.phase !== 'expressionTransforming') return;
    const skipCurrentFrame = (event: KeyboardEvent) => {
      if (event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      advanceTransformation();
    };
    window.addEventListener('keydown', skipCurrentFrame);
    return () => window.removeEventListener('keydown', skipCurrentFrame);
  }, [advanceTransformation, state.phase]);

  const submitDirect = (event: FormEvent) => {
    event.preventDefault();
    dispatch({ type: 'SUBMIT_DIRECT', answer: directAnswer });
  };

  const submitDecomposition = (event: FormEvent) => {
    event.preventDefault();
    dispatch({
      type: state.phase === 'expressionDecomposing'
        ? 'SUBMIT_EXPRESSION_DECOMPOSITION'
        : 'SUBMIT_DECOMPOSITION',
      input: decomposition,
    });
  };

  const openDecomposition = (side: 'left' | 'right') => {
    setDecomposition('');
    dispatch({ type: 'OPEN_DECOMPOSITION', side });
  };

  const openExpressionDecomposition = (path: ExpressionPath) => {
    setDecomposition('');
    dispatch({ type: 'OPEN_EXPRESSION_DECOMPOSITION', path });
  };

  const selectedSide = state.phase === 'decomposing'
    ? state.selectedSide
    : undefined;
  const selectedPath = state.phase === 'expressionDecomposing'
    ? state.selectedPath.slice(activeFocusPath.length)
    : undefined;
  const decompositionTarget = state.phase === 'decomposing'
    ? state.selectedSide === 'left' ? problem.left : problem.right
    : state.phase === 'expressionDecomposing'
      ? numberAtPath(state.expression, state.selectedPath)
      : null;
  const inputError =
    state.phase === 'decomposing' || state.phase === 'expressionDecomposing'
      ? state.inputError
      : undefined;
  const transitionFrame = state.phase === 'expressionTransforming'
    ? state.frames[state.frameIndex]
    : undefined;
  const transitionAnnotation = transitionFrame
    ? transformationAnnotation(transitionFrame.kind)
    : undefined;
  const transitionAriaLabel = transitionFrame
    ? transitionFrame.kind === 'answer'
      ? `Accepted. Same value: ${transitionFrame.display}`
      : transitionFrame.display
    : undefined;
  const heading = activeExpression
    ? `Solve ${speakExpression(activeExpression)}`
    : transitionFrame
      ? `Equivalent expression: ${transitionFrame.display}`
      : `${problem.left} times ${problem.right}`;

  return (
    <section className={styles.stage} aria-labelledby="problem-heading">
      <p className={styles.kicker}>
        {activeExpression || transitionFrame ? 'Keep turning it over' : 'Turn it over'}
      </p>
      <h1 id="problem-heading" className={styles.srOnly}>{heading}</h1>

      {(state.phase === 'problem' ||
        state.phase === 'decomposing' ||
        state.phase === 'reflection') && (
        <div className={styles.expression}>
          <Operand
            value={problem.left}
            side="left"
            selected={selectedSide === 'left'}
            disabled={false}
            onSelect={() => openDecomposition('left')}
          />
          <span className={styles.times} aria-hidden="true">×</span>
          <Operand
            value={problem.right}
            side="right"
            selected={selectedSide === 'right'}
            disabled={false}
            onSelect={() => openDecomposition('right')}
          />
        </div>
      )}

      {activeExpression && (
        <div
          className={`${styles.expression} ${styles.recursiveExpression}`}
          data-help={Boolean(assistance)}
          data-node-count={listNumberNodes(activeExpression).length}
        >
          <ExpressionNodeView
            expression={activeExpression}
            path={[]}
            selectedPath={selectedPath}
            onSelect={openExpressionDecomposition}
            prominent={Boolean(assistance)}
          />
        </div>
      )}

      {transitionFrame && state.phase === 'expressionTransforming' && (
        <div
          className={styles.transformArea}
          data-motion={reducedMotion ? 'reduced' : 'full'}
          onClick={advanceTransformation}
        >
          <p className={styles.transformAnnotation}>
            {transitionAnnotation ?? '\u00a0'}
          </p>
          <div
            key={`${state.frameIndex}-${transitionFrame.kind}-${transitionFrame.display}`}
            className={styles.transformExpression}
            data-kind={transitionFrame.kind}
            role="status"
            aria-live="polite"
            aria-label={transitionAriaLabel}
          >
            {transitionFrame.display.split(' ').map((token, index) => (
              <span
                key={`${transitionFrame.kind}-${index}-${token}`}
                data-sign={transitionFrame.kind === 'sign' && token === '+'}
              >
                {token}
              </span>
            ))}
          </div>
          <p className={styles.srOnly}>
            This rewrite advances automatically. Press Enter or Space to skip the current step.
          </p>
        </div>
      )}

      {(state.phase === 'decomposing' || state.phase === 'expressionDecomposing') &&
        decompositionTarget !== null && (
          <form className={styles.decomposition} onSubmit={submitDecomposition}>
            <span className={styles.stem} aria-hidden="true" />
            <label htmlFor="decomposition-input">
              Another way to make {decompositionTarget}
            </label>
            <div className={styles.decompositionRow}>
              <span className={styles.equals} aria-hidden="true">=</span>
              <input
                ref={decompositionInput}
                id="decomposition-input"
                value={decomposition}
                onChange={(event) => setDecomposition(event.target.value)}
                placeholder="50 − 2"
                maxLength={32}
                autoComplete="off"
                spellCheck={false}
                aria-describedby={inputError ? 'decomposition-error' : 'decomposition-note'}
              />
              <button type="submit" aria-label="Use this decomposition">→</button>
            </div>
            <p id="decomposition-note" className={styles.microcopy}>Use +, −, or ×</p>
            {inputError && (
              <p id="decomposition-error" className={styles.feedback} role="alert">
                {inputError}
              </p>
            )}
          </form>
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
              inputMode="text"
              autoComplete="off"
              maxLength={MAX_ANSWER_EXPRESSION_LENGTH}
              spellCheck={false}
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

      {(state.phase === 'expression' || state.phase === 'guided') && (
        <ExpressionAnswerForm
          key={`${activeExpressionLabel}-${guidedStep}`}
          feedback={state.feedback}
          dispatch={dispatch}
          action={state.phase === 'guided' ? 'SUBMIT_GUIDED' : 'SUBMIT_EXPRESSION_ANSWER'}
        />
      )}

      {state.phase !== 'reflection' && state.phase !== 'expressionTransforming' && (
        <div className={styles.hintArea}>
          <button
            className={styles.hintButton}
            type="button"
            aria-expanded={activeExpression ? Boolean(assistance) : originalHintVisible}
            onClick={() => dispatch({ type: 'USE_HINT' })}
          >
            {activeExpression && state.hintCounts[state.stageIndex] > 0
              ? 'Another hint'
              : 'Hint'}
          </button>
          {activeExpression && assistance && (
            <div className={styles.expressionHint}>
              <p className={styles.hintText}>{assistance.message}</p>
              {(state.phase === 'expression' || state.phase === 'guided') &&
                assistance.suggestion && (
                <button
                  className={styles.hintAction}
                  type="button"
                  onClick={() => dispatch({ type: 'APPLY_EXPRESSION_SUGGESTION' })}
                >
                  Use this way
                </button>
              )}
              {(state.phase === 'expression' || state.phase === 'guided') &&
                assistance.rescue && (
                <button
                  className={styles.hintAction}
                  type="button"
                  onClick={() => dispatch({ type: 'ACCEPT_EXPRESSION_RESCUE' })}
                >
                  {assistance.rescue.before} = {assistance.rescue.value}
                </button>
              )}
            </div>
          )}
          {!activeExpression && originalHintVisible && (
            <p className={styles.hintText}>{problem.hint.text}</p>
          )}
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

function ExpressionAnswerForm({
  feedback,
  dispatch,
  action,
}: {
  feedback?: string;
  dispatch: Dispatch<GameAction>;
  action: 'SUBMIT_GUIDED' | 'SUBMIT_EXPRESSION_ANSWER';
}) {
  const [answer, setAnswer] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    dispatch({ type: action, answer });
  };

  return (
    <form className={styles.direct} onSubmit={submit} data-error={Boolean(feedback)}>
      <label htmlFor="expression-answer">Your answer</label>
      <div className={styles.answerLine}>
        <input
          id="expression-answer"
          inputMode="text"
          autoComplete="off"
          autoFocus={action === 'SUBMIT_GUIDED'}
          maxLength={MAX_ANSWER_EXPRESSION_LENGTH}
          spellCheck={false}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
        />
        <button
          type="submit"
          aria-label={action === 'SUBMIT_GUIDED'
            ? 'Check this calculation'
            : 'Check expression answer'}
        >
          →
        </button>
      </div>
      {feedback && <p className={styles.feedback} role="alert">{feedback}</p>}
    </form>
  );
}

function expressionPrecedence(expression: MathExpression) {
  if (expression.type === 'number') return 3;
  return expression.operator === '*' ? 2 : 1;
}

function wrapChild(
  child: MathExpression,
  parentOperator: BinaryOperator,
  side: 'left' | 'right',
) {
  if (child.type === 'number') return false;
  const parentPrecedence = parentOperator === '*' ? 2 : 1;
  if (expressionPrecedence(child) < parentPrecedence) return true;
  return side === 'right' && parentOperator === '-' &&
    expressionPrecedence(child) === parentPrecedence;
}

function ExpressionNodeView({
  expression,
  path,
  selectedPath,
  onSelect,
  prominent,
  parentOperator,
  side,
}: {
  expression: MathExpression;
  path: ExpressionPath;
  selectedPath?: ExpressionPath;
  onSelect: (path: ExpressionPath) => void;
  prominent: boolean;
  parentOperator?: BinaryOperator;
  side?: 'left' | 'right';
}): ReactNode {
  if (expression.type === 'number') {
    return (
      <button
        type="button"
        className={`${styles.operand} ${styles.expressionNumber}`}
        data-selected={selectedPath ? pathKey(selectedPath) === pathKey(path) : false}
        data-prominent={prominent}
        aria-label={`Explore another way to make ${expression.value} in this expression`}
        onClick={() => onSelect(path)}
      >
        <span>{expression.value}</span><span className={styles.plus}>+</span>
      </button>
    );
  }

  const wrapped = parentOperator && side
    ? wrapChild(expression, parentOperator, side)
    : false;
  return (
    <>
      {wrapped && <span className={styles.parenthesis} aria-hidden="true">(</span>}
      <ExpressionNodeView
        expression={expression.left}
        path={[...path, 'left']}
        selectedPath={selectedPath}
        onSelect={onSelect}
        prominent={prominent}
        parentOperator={expression.operator}
        side="left"
      />
      <span className={styles.binaryOperator} aria-hidden="true">
        {expression.operator === '*' ? '×' : expression.operator === '-' ? '−' : '+'}
      </span>
      <ExpressionNodeView
        expression={expression.right}
        path={[...path, 'right']}
        selectedPath={selectedPath}
        onSelect={onSelect}
        prominent={prominent}
        parentOperator={expression.operator}
        side="right"
      />
      {wrapped && <span className={styles.parenthesis} aria-hidden="true">)</span>}
    </>
  );
}
