import { selectAlternateView } from '../data/alternateViews';
import { parseDecomposition } from '../math/decomposition';
import { createGuidedPlan } from '../math/guidedSolving';
import type { OperandSide, ParsedDecomposition } from '../math/types';
import { createInitialGameState } from './gameReducer';
import type { Discovery, GameState, ProblemResult, SolveMethod } from './types';

export const STORAGE_KEY = 'number-sense:daily:v1';
export const STORAGE_VERSION = 1;

type Snapshot = {
  version: 1;
  dateKey: string;
  phase: GameState['phase'];
  stageIndex: number;
  hintsUsed: boolean[];
  discoveries: Discovery[][];
  results: ProblemResult[];
  selectedSide?: OperandSide;
  afterDirect?: boolean;
  expression?: ParsedDecomposition;
  stepIndex?: number;
  answers?: number[];
  solvedBy?: SolveMethod;
};

const PHASES = new Set<GameState['phase']>([
  'intro',
  'problem',
  'decomposing',
  'guided',
  'reflection',
  'alternateReveal',
  'surfTransition',
  'surfing',
  'results',
]);

export function serializeGameState(state: GameState): string {
  const snapshot: Snapshot = {
    version: STORAGE_VERSION,
    dateKey: state.dateKey,
    phase: state.phase,
    stageIndex: state.stageIndex,
    hintsUsed: state.hintsUsed,
    discoveries: state.discoveries,
    results: state.results,
    ...('selectedSide' in state ? { selectedSide: state.selectedSide } : {}),
    ...('afterDirect' in state ? { afterDirect: state.afterDirect } : {}),
    ...('expression' in state ? { expression: state.expression } : {}),
    ...('stepIndex' in state ? { stepIndex: state.stepIndex } : {}),
    ...('answers' in state ? { answers: state.answers } : {}),
    ...('solvedBy' in state ? { solvedBy: state.solvedBy } : {}),
  };
  return JSON.stringify(snapshot);
}

function isOperandSide(value: unknown): value is OperandSide {
  return value === 'left' || value === 'right';
}

function readDiscovery(value: unknown): Discovery | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  if (!isOperandSide(item.side) || !item.expression || typeof item.expression !== 'object') {
    return null;
  }
  const expression = item.expression as Record<string, unknown>;
  const normalized = typeof expression.normalized === 'string' ? expression.normalized : '';
  const operand = typeof expression.result === 'number' ? expression.result : Number.NaN;
  const parsed = parseDecomposition(normalized, operand);
  return parsed.ok ? { side: item.side, expression: parsed.expression } : null;
}

function readDiscoveries(value: unknown): Discovery[][] | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  const groups: Discovery[][] = [];
  for (const group of value) {
    if (!Array.isArray(group) || group.length > 20) return null;
    const parsed = group.map(readDiscovery);
    if (parsed.some((item) => item === null)) return null;
    groups.push(parsed as Discovery[]);
  }
  return groups;
}

function readResults(
  value: unknown,
  problems: GameState['problems'],
): ProblemResult[] | null {
  if (!Array.isArray(value) || value.length > problems.length) return null;
  const results: ProblemResult[] = [];
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    if (
      record.problemId !== problems[index].id ||
      seen.has(record.problemId as string) ||
      typeof record.hintUsed !== 'boolean' ||
      (record.solvedBy !== 'direct' && record.solvedBy !== 'guided') ||
      !Array.isArray(record.discoveries) ||
      record.discoveries.length > 20
    ) {
      return null;
    }
    const discoveries = record.discoveries.map(readDiscovery);
    if (discoveries.some((discovery) => discovery === null)) return null;
    seen.add(record.problemId as string);
    results.push({
      problemId: record.problemId as string,
      hintUsed: record.hintUsed,
      solvedBy: record.solvedBy,
      discoveries: discoveries as Discovery[],
    });
  }
  return results;
}

export function restoreGameState(raw: string | null, date = new Date()): GameState | null {
  if (!raw || raw.length > 50_000) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const initial = createInitialGameState(date);
    if (
      value.version !== STORAGE_VERSION ||
      value.dateKey !== initial.dateKey ||
      typeof value.phase !== 'string' ||
      !PHASES.has(value.phase as GameState['phase']) ||
      !Number.isInteger(value.stageIndex) ||
      (value.stageIndex as number) < 0 ||
      (value.stageIndex as number) > 2 ||
      !Array.isArray(value.hintsUsed) ||
      value.hintsUsed.length !== 3 ||
      value.hintsUsed.some((item) => typeof item !== 'boolean')
    ) {
      return null;
    }
    const discoveries = readDiscoveries(value.discoveries);
    const results = readResults(value.results, initial.problems);
    if (!discoveries || !results) return null;

    const base = {
      ...initial,
      stageIndex: value.stageIndex as number,
      hintsUsed: value.hintsUsed as boolean[],
      discoveries,
      results,
    };
    const phase = value.phase as GameState['phase'];

    if (phase === 'results' && results.length !== initial.problems.length) return null;
    if (phase === 'intro' || phase === 'problem' || phase === 'reflection' || phase === 'results') {
      return { ...base, phase };
    }

    if (phase === 'decomposing') {
      if (!isOperandSide(value.selectedSide) || typeof value.afterDirect !== 'boolean') return null;
      return {
        ...base,
        phase,
        selectedSide: value.selectedSide,
        afterDirect: value.afterDirect,
      };
    }

    if (phase === 'guided') {
      if (!isOperandSide(value.selectedSide) || !value.expression || typeof value.expression !== 'object') return null;
      const problem = base.problems[base.stageIndex];
      const operand = value.selectedSide === 'left' ? problem.left : problem.right;
      const normalized = (value.expression as Record<string, unknown>).normalized;
      if (typeof normalized !== 'string') return null;
      const parsed = parseDecomposition(normalized, operand);
      if (!parsed.ok) return null;
      const plan = createGuidedPlan(problem.left, problem.right, value.selectedSide, parsed.expression);
      const stepIndex = typeof value.stepIndex === 'number' ? value.stepIndex : 0;
      const answers = Array.isArray(value.answers) && value.answers.every(Number.isFinite)
        ? (value.answers as number[])
        : [];
      if (stepIndex < 0 || stepIndex >= plan.steps.length || answers.length !== stepIndex) return null;
      return {
        ...base,
        phase,
        selectedSide: value.selectedSide,
        expression: parsed.expression,
        plan,
        stepIndex,
        answers,
      };
    }

    if (phase === 'alternateReveal' || phase === 'surfTransition' || phase === 'surfing') {
      const solvedBy = value.solvedBy === 'guided' ? 'guided' : 'direct';
      const alternate = selectAlternateView(
        base.problems[base.stageIndex],
        base.discoveries[base.stageIndex],
      );
      // Pointer lock cannot survive a refresh, so an active surf resumes at its safe launch state.
      return {
        ...base,
        phase: phase === 'surfing' ? 'surfTransition' : phase,
        alternate,
        solvedBy,
      };
    }

    return null;
  } catch {
    return null;
  }
}
