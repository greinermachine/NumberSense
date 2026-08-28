import styles from './IntroScreen.module.css';

export function IntroScreen({ onBegin }: { onBegin: () => void }) {
  return (
    <section className={styles.intro} aria-labelledby="intro-title">
      <div className={styles.presence} aria-hidden="true"><span /></div>
      <p className={styles.eyebrow}>Today’s three</p>
      <h1 id="intro-title">There’s always another way.</h1>
      <p className={styles.lede}>Three numbers to turn over. Three short paths through what you find.</p>
      <button className={styles.begin} type="button" onClick={onBegin} autoFocus>
        <span>Begin</span><span aria-hidden="true">→</span>
      </button>
      <div className={styles.marks} aria-label="Three problems today"><span /><span /><span /></div>
    </section>
  );
}
