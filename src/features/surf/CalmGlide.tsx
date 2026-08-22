import { useEffect, useState } from 'react';
import type { SurfCourseDefinition } from './types';
import styles from './SurfExperience.module.css';

export function CalmGlide({
  course,
  onComplete,
}: {
  course: SurfCourseDefinition;
  onComplete: () => void;
}) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDone(true), 4800);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!done) return;
    const timeout = window.setTimeout(onComplete, 650);
    return () => window.clearTimeout(timeout);
  }, [done, onComplete]);

  return (
    <main
      className={styles.calm}
      style={
        {
          '--calm-sky': course.sky,
          '--surf-accent': course.accent,
        } as React.CSSProperties
      }
    >
      <p className={styles.calmStage}>{course.stageLabel}</p>
      <div className={styles.calmOrb} aria-hidden="true" />
      <div className={styles.calmLine} aria-hidden="true"><span /></div>
      <p>{done ? 'Line found.' : course.name}</p>
      <button type="button" onClick={onComplete}>{done ? 'Continue' : 'Glide onward'}</button>
    </main>
  );
}
