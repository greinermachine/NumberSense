import { describe, expect, it } from 'vitest';
import {
  restoreTutorialProgress,
  serializeTutorialProgress,
  shouldLaunchTutorial,
  TUTORIAL_VERSION,
} from './tutorialPersistence';

describe('tutorial persistence', () => {
  it.each(['completed', 'dismissed'] as const)('stores a versioned %s outcome', (outcome) => {
    const raw = serializeTutorialProgress(outcome);
    expect(restoreTutorialProgress(raw)).toEqual({
      version: TUTORIAL_VERSION,
      completed: true,
      outcome,
    });
    expect(shouldLaunchTutorial(raw)).toBe(false);
  });

  it('launches for first use, corrupt input, and a different tutorial version', () => {
    expect(shouldLaunchTutorial(null)).toBe(true);
    expect(shouldLaunchTutorial('{bad json')).toBe(true);
    expect(shouldLaunchTutorial(JSON.stringify({
      version: TUTORIAL_VERSION + 1,
      completed: true,
      outcome: 'completed',
    }))).toBe(true);
  });
});
