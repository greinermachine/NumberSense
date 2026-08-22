import { useEffect, useState } from 'react';
import { buildShareText, totalHints, totalWaysSeen } from '../game/share';
import type { GameState } from '../game/types';
import styles from './ResultsView.module.css';

type ResultsState = Extract<GameState, { phase: 'results' }>;

export function ResultsView({ state, onReplay }: { state: ResultsState; onReplay: () => void }) {
  const [notice, setNotice] = useState('');
  const shareText = buildShareText(state.dailyNumber, state.results);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(''), 2400);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const share = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: `Number Sense #${state.dailyNumber}`, text: shareText });
        setNotice('Shared.');
        return;
      }
      await navigator.clipboard.writeText(shareText);
      setNotice('Copied to clipboard.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setNotice('Sharing is unavailable here.');
    }
  };

  const ways = totalWaysSeen(state.results);
  const hints = totalHints(state.results);
  return (
    <section className={styles.results} aria-labelledby="results-title">
      <p className={styles.kicker}>Today’s three</p>
      <h1 id="results-title">Number Sense <span>#{state.dailyNumber}</span></h1>
      <div className={styles.score}>3 <span>/ 3</span></div>
      <div className={styles.rows} aria-label="Ways seen for each problem">
        {state.results.map((result) => (
          <div key={result.problemId}>{'◆'.repeat(1 + result.discoveries.length)}</div>
        ))}
      </div>
      <dl className={styles.stats}>
        <div><dt>ways seen</dt><dd>{ways}</dd></div>
        <div><dt>hints</dt><dd>{hints}</dd></div>
      </dl>
      <button className={styles.share} type="button" onClick={share}>Share <span aria-hidden="true">↗</span></button>
      <button className={styles.replay} type="button" onClick={onReplay}>Play today again</button>
      <p className={styles.notice} role="status" aria-live="polite">{notice}</p>
    </section>
  );
}
