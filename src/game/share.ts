import type { ProblemResult } from './types';

export function totalWaysSeen(results: readonly ProblemResult[]): number {
  return results.reduce((total, result) => total + 1 + result.discoveries.length, 0);
}

export function totalHints(results: readonly ProblemResult[]): number {
  return results.filter((result) => result.hintUsed).length;
}

export function buildShareText(
  dailyNumber: number,
  results: readonly ProblemResult[],
): string {
  const rows = results.map((result) => '◆'.repeat(1 + result.discoveries.length));
  const ways = totalWaysSeen(results);
  const hints = totalHints(results);
  return [
    `NUMBER SENSE #${dailyNumber}`,
    '',
    ...rows,
    '',
    `${ways} ${ways === 1 ? 'way' : 'ways'} seen`,
    `${hints} ${hints === 1 ? 'hint' : 'hints'}`,
  ].join('\n');
}
