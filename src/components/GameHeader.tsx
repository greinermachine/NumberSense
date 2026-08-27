import type { GameState } from '../game/types';
import styles from './GameHeader.module.css';

type Props = {
  stageIndex: number;
  phase: GameState['phase'];
  onHelp: () => void;
  tutorial?: boolean;
};

export function GameHeader({ stageIndex, phase, onHelp, tutorial = false }: Props) {
  const showProgress = !tutorial && phase !== 'intro' && phase !== 'results';
  return (
    <header className={styles.header}>
      <div className={styles.wordmark}>Number Sense</div>
      {showProgress && (
        <div className={styles.progress} aria-label={`Problem ${stageIndex + 1} of 3`}>
          {[0, 1, 2].map((index) => (
            <span key={index} data-state={index < stageIndex ? 'done' : index === stageIndex ? 'current' : 'next'} />
          ))}
        </div>
      )}
      <button className={styles.help} type="button" aria-label="How to play" onClick={onHelp}>?</button>
    </header>
  );
}
