export const TUTORIAL_STORAGE_KEY = 'number-sense:tutorial';
export const TUTORIAL_VERSION = 1;

export type TutorialOutcome = 'completed' | 'dismissed';

export type TutorialProgress = {
  version: typeof TUTORIAL_VERSION;
  completed: true;
  outcome: TutorialOutcome;
};

export function serializeTutorialProgress(outcome: TutorialOutcome): string {
  return JSON.stringify({
    version: TUTORIAL_VERSION,
    completed: true,
    outcome,
  } satisfies TutorialProgress);
}

export function restoreTutorialProgress(raw: string | null): TutorialProgress | null {
  if (!raw || raw.length > 1_000) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (
      value.version !== TUTORIAL_VERSION ||
      value.completed !== true ||
      (value.outcome !== 'completed' && value.outcome !== 'dismissed')
    ) {
      return null;
    }
    return value as TutorialProgress;
  } catch {
    return null;
  }
}

export function shouldLaunchTutorial(raw: string | null): boolean {
  return restoreTutorialProgress(raw) === null;
}
