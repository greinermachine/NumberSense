export const FULL_REWRITE_TARGET_MS = 5_500;
export const REDUCED_REWRITE_TARGET_MS = 4_500;
export const THOUGHT_STEP_MS = 1_200;
export const THOUGHT_HANDOFF_MS = 1_400;
export const REDUCED_THOUGHT_STEP_MS = 900;

export function expressionRewriteFrameDuration(
  frameCount: number,
  reducedMotion: boolean,
) {
  if (frameCount <= 0) return 0;
  const target = reducedMotion
    ? REDUCED_REWRITE_TARGET_MS
    : FULL_REWRITE_TARGET_MS;
  const minimum = reducedMotion ? 800 : 1_100;
  const maximum = reducedMotion ? 1_200 : 1_500;
  return Math.min(maximum, Math.max(minimum, target / frameCount));
}
