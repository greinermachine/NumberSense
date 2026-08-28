import styles from '../app/App.module.css';

export function HelpDialog({
  onClose,
  onReplayTutorial,
}: {
  onClose: () => void;
  onReplayTutorial: () => void;
}) {
  return (
    <div className={styles.helpLayer} role="presentation" onMouseDown={onClose}>
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
          onClick={onClose}
          aria-label="Close how to play"
          autoFocus
        >
          ×
        </button>
        <p className={styles.helpKicker}>How to play</p>
        <h2 id="help-title">Use the shape that helps.</h2>
        <p>
          A number can have many equivalent forms. Number Sense lets you reshape the
          problem until you find a version you like.
        </p>
        <div className={styles.helpExample} aria-label="Example: forty-eight equals fifty minus two equals forty plus eight equals six times eight">
          <span>48</span><span>=</span><span>50 − 2</span><span>=</span><span>40 + 8</span><span>=</span><span>6 × 8</span>
        </div>
        <p className={styles.helpThesis}>Same value. Different shape.</p>
        <button className={styles.helpReplay} type="button" onClick={onReplayTutorial}>
          Replay interactive lesson <span aria-hidden="true">→</span>
        </button>
        <div className={styles.helpAbout}>
          <p className={styles.helpKicker}>About</p>
          <p>Three daily problems, three ways to see numbers, no account.</p>
        </div>
        <p className={styles.helpKeys}><kbd>Enter</kbd> submits · <kbd>Esc</kbd> closes an editor or this guide</p>
      </section>
    </div>
  );
}
