import { PROBLEM_BANK } from './problems';
import type { ProblemDefinition, ProblemTier } from './types';

// V2 adds the curated 25 × 12 route and removes an unhelpful 25 = 100 − 75
// teaching suggestion. The explicit namespace keeps that content change honest.
export const DAILY_ALGORITHM_VERSION = 2;
const DAILY_EPOCH = '2026-01-01';
const TIERS: readonly ProblemTier[] = ['warm', 'explore', 'puzzle'];

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

export function toDailyKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getDailyNumber(dateKey: string): number {
  const epochMs = Date.parse(`${DAILY_EPOCH}T00:00:00.000Z`);
  const currentMs = Date.parse(`${dateKey}T00:00:00.000Z`);
  return Math.max(1, Math.floor((currentMs - epochMs) / 86_400_000) + 1);
}

export function selectDailyProblems(
  date: Date,
  bank: readonly ProblemDefinition[] = PROBLEM_BANK,
): readonly ProblemDefinition[] {
  const dateKey = toDailyKey(date);
  return TIERS.map((tier) => {
    const tierProblems = bank.filter((problem) => problem.tier === tier);
    if (tierProblems.length === 0) {
      throw new Error(`Problem bank has no ${tier} problems.`);
    }
    const seed = fnv1a(`number-sense:v${DAILY_ALGORITHM_VERSION}:${dateKey}:${tier}`);
    return tierProblems[seed % tierProblems.length];
  });
}
