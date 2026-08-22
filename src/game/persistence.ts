import { selectAlternateView } from '../data/alternateViews';
import { parseDecomposition } from '../math/decomposition';
import { evaluateExpression, numberAtPath } from '../math/expression';
import { createGuidedPlan } from '../math/guidedSolving';
import type {
  BinaryOperator,
  ExpressionPath,
  MathExpression,
  OperandSide,
  ParsedDecomposition,
} from '../math/types';
import { createInitialGameState } from './gameReducer';
import type { Discovery, GameState, ProblemResult, SolveMethod } from './types';

export const STORAGE_KEY = 'number-sense:daily:v1';
export const STORAGE_VERSION = 2;

type Snapshot = {
  version: 2;
  dateKey: string;
  phase: GameState['phase'];
  stageIndex: number;
  hintsUsed: boolean[];
  hintCounts: number[];
  attemptCounts: number[];
  manipulationCounts: number[];
  discoveries: Discovery[][];
  results: ProblemResult[];
  selectedSide?: OperandSide;
  afterDirect?: boolean;
  guidedDecomposition?: ParsedDecomposition;
  stepIndex?: number;
  answers?: number[];
  solvedBy?: SolveMethod;
  activeExpression?: MathExpression;
  selectedPath?: ExpressionPath;
};

const PHASES = new Set<GameState['phase']>([
  'intro',
  'problem',
  'decomposing',
  'guided',
  'expression',
  'expressionDecomposing',
  'expressionTransforming',
  'reflection',
  'alternateReveal',
  'surfTransition',
  'surfing',
  'results',
]);

function persistedPhase(state: GameState): GameState['phase'] {
  return state.phase === 'expressionTransforming' ? 'expression' : state.phase;
}

function activeExpression(state: GameState): MathExpression | undefined {
  if (state.phase === 'expression' || state.phase === 'expressionDecomposing') {
    return state.expression;
  }
  return state.phase === 'expressionTransforming' ? state.finalExpression : undefined;
}

export function serializeGameState(state: GameState): string {
  const expression = activeExpression(state);
  const snapshot: Snapshot = {
    version: STORAGE_VERSION,
    dateKey: state.dateKey,
    phase: persistedPhase(state),
    stageIndex: state.stageIndex,
    hintsUsed: state.hintsUsed,
    hintCounts: state.hintCounts,
    attemptCounts: state.attemptCounts,
    manipulationCounts: state.manipulationCounts,
    discoveries: state.discoveries,
    results: state.results,
    ...('selectedSide' in state ? { selectedSide: state.selectedSide } : {}),
    ...('afterDirect' in state ? { afterDirect: state.afterDirect } : {}),
    ...(state.phase === 'guided'
      ? { guidedDecomposition: state.expression }
      : {}),
    ...('stepIndex' in state ? { stepIndex: state.stepIndex } : {}),
    ...('answers' in state ? { answers: state.answers } : {}),
    ...('solvedBy' in state ? { solvedBy: state.solvedBy } : {}),
    ...(expression ? { activeExpression: expression } : {}),
    ...(state.phase === 'expressionDecomposing'
      ? { selectedPath: state.selectedPath }
      : {}),
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

function safeCount(value: unknown, fallback: number): number | null {
  if (value === undefined) return fallback;
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 100
    ? (value as number)
    : null;
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
    const attemptCount = safeCount(record.attemptCount, 0);
    const manipulationCount = safeCount(record.manipulationCount, 0);
    if (
      discoveries.some((discovery) => discovery === null) ||
      attemptCount === null ||
      manipulationCount === null
    ) {
      return null;
    }
    seen.add(record.problemId as string);
    results.push({
      problemId: record.problemId as string,
      hintUsed: record.hintUsed,
      solvedBy: record.solvedBy,
      discoveries: discoveries as Discovery[],
      attemptCount,
      manipulationCount,
      assisted:
        typeof record.assisted === 'boolean' ? record.assisted : record.hintUsed,
    });
  }
  return results;
}

function readCountArray(value: unknown, fallback?: boolean[]): number[] | null {
  if (value === undefined && fallback) return fallback.map((item) => Number(item));
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    value.some((item) => !Number.isInteger(item) || item < 0 || item > 100)
  ) {
    return null;
  }
  return value as number[];
}

function readExpression(
  value: unknown,
  depth = 0,
  budget = { nodes: 0 },
): MathExpression | null {
  if (!value || typeof value !== 'object' || depth > 8 || budget.nodes >= 31) {
    return null;
  }
  budget.nodes += 1;
  const item = value as Record<string, unknown>;
  if (item.type === 'number') {
    return Number.isSafeInteger(item.value) && Math.abs(item.value as number) <= 1_000_000_000
      ? { type: 'number', value: item.value as number }
      : null;
  }
  if (
    item.type !== 'binary' ||
    (item.operator !== '+' && item.operator !== '-' && item.operator !== '*')
  ) {
    return null;
  }
  const left = readExpression(item.left, depth + 1, budget);
  const right = readExpression(item.right, depth + 1, budget);
  if (!left || !right) return null;
  const expression: MathExpression = {
    type: 'binary',
    operator: item.operator as BinaryOperator,
    left,
    right,
  };
  return Number.isSafeInteger(evaluateExpression(expression)) ? expression : null;
}

function readPath(value: unknown): ExpressionPath | null {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 8 &&
    value.every((item) => item === 'left' || item === 'right')
    ? (value as ExpressionPath)
    : null;
}

export function restoreGameState(raw: string | null, date = new Date()): GameState | null {
  if (!raw || raw.length > 50_000) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const initial = createInitialGameState(date);
    const version = value.version;
    if (
      (version !== 1 && version !== STORAGE_VERSION) ||
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
    const hintsUsed = value.hintsUsed as boolean[];
    const hintCounts = readCountArray(value.hintCounts, hintsUsed);
    const attemptCounts = readCountArray(value.attemptCounts, [false, false, false]);
    const manipulationCounts = readCountArray(
      value.manipulationCounts,
      [false, false, false],
    );
    if (!discoveries || !results || !hintCounts || !attemptCounts || !manipulationCounts) {
      return null;
    }

    const base = {
      ...initial,
      stageIndex: value.stageIndex as number,
      hintsUsed,
      hintCounts,
      attemptCounts,
      manipulationCounts,
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
      if (!isOperandSide(value.selectedSide)) return null;
      const storedDecomposition = version === 1
        ? value.expression
        : value.guidedDecomposition;
      if (!storedDecomposition || typeof storedDecomposition !== 'object') return null;
      const problem = base.problems[base.stageIndex];
      const operand = value.selectedSide === 'left' ? problem.left : problem.right;
      const normalized = (storedDecomposition as Record<string, unknown>).normalized;
      if (typeof normalized !== 'string') return null;
      const parsed = parseDecomposition(normalized, operand);
      if (!parsed.ok) return null;
      const plan = createGuidedPlan(problem.left, problem.right, value.selectedSide, parsed.expression);
      const stepIndex = typeof value.stepIndex === 'number' ? value.stepIndex : 0;
      const answers = Array.isArray(value.answers) && value.answers.every(Number.isFinite)
        ? (value.answers as number[])
        : [];
      if (
        stepIndex === plan.steps.length &&
        answers.length >= plan.steps.length &&
        plan.completion.type === 'expression'
      ) {
        return { ...base, phase: 'expression', expression: plan.completion.expression };
      }
      if (stepIndex < 0 || stepIndex >= plan.steps.length || answers.length !== stepIndex) {
        return null;
      }
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

    if (
      phase === 'expression' ||
      phase === 'expressionDecomposing' ||
      phase === 'expressionTransforming'
    ) {
      const expression = readExpression(value.activeExpression);
      const problem = base.problems[base.stageIndex];
      if (!expression || evaluateExpression(expression) !== problem.left * problem.right) {
        return null;
      }
      if (phase === 'expressionDecomposing') {
        const selectedPath = readPath(value.selectedPath);
        if (!selectedPath || numberAtPath(expression, selectedPath) === null) return null;
        return {
          ...base,
          phase,
          expression,
          selectedPath,
        };
      }
      return { ...base, phase: 'expression', expression };
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
