import type { Difficulty as CoreLevel } from 'sudoku-core';
import { Difficulty, GameChallenge } from '../types/sudoku';
import type { GeneratedPuzzle } from './sudokuEngine';

/**
 * Bundled puzzles picked offline by scripts/build-pool.mjs:
 * 極 (too slow to generate on a phone), the 17-clue challenge and per-technique practice.
 */
export interface PoolEntry {
  /** 81 chars, '.' = empty */
  p: string;
  /** 81 digits */
  s: string;
  level: CoreLevel;
}

export const SEVENTEEN_BANDS = [
  { key: 'normal', label: '17 個チャレンジ', note: 'ヒントが最少の 17 個。難しさは初級〜中級くらい' },
  { key: 'hard', label: '17 個チャレンジ（難）', note: '17 個のうち、上級以上の技が要るもの' },
] as const;

const PLAYED_KEY = 'zen_sudoku_pool_played_v1';

const loaders = import.meta.glob<{ default: unknown }>('../data/pool/*.json');

const LEVEL_RE = /^L([1-9]|10)$/;

export function parseEntry(raw: unknown): PoolEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const { p, s, level } = raw as Record<string, unknown>;
  if (typeof p !== 'string' || !/^[.1-9]{81}$/.test(p)) return null;
  if (typeof s !== 'string' || !/^[1-9]{81}$/.test(s)) return null;
  if (typeof level !== 'string' || !LEVEL_RE.test(level)) return null;
  for (let i = 0; i < 81; i++) {
    if (p[i] !== '.' && p[i] !== s[i]) return null;
  }
  return { p, s, level: level as CoreLevel };
}

const entryList = (v: unknown): PoolEntry[] =>
  Array.isArray(v) ? v.map(parseEntry).filter((e): e is PoolEntry => e !== null) : [];

async function loadFile(name: string): Promise<unknown> {
  const load = loaders[`../data/pool/${name}.json`];
  if (!load) return null;
  return (await load()).default;
}

export async function loadExtreme(): Promise<PoolEntry[]> {
  const raw = (await loadFile('extreme')) as { puzzles?: unknown } | null;
  return entryList(raw?.puzzles);
}

export async function loadSeventeen(band: string): Promise<PoolEntry[]> {
  const raw = (await loadFile('seventeen')) as { puzzles?: unknown } | null;
  const all = entryList(raw?.puzzles);
  return all.filter((e) => (band === 'hard') === (levelNumber(e.level) >= 6));
}

export async function loadPractice(strategy: string): Promise<PoolEntry[]> {
  const raw = (await loadFile('practice')) as { byStrategy?: Record<string, unknown> } | null;
  const byStrategy = raw?.byStrategy;
  return byStrategy && typeof byStrategy === 'object' ? entryList(byStrategy[strategy]) : [];
}

const levelNumber = (level: CoreLevel): number => Number(level.slice(1));

/** The game difficulty a sudoku-core level falls under (the game uses L2, L4, L6, L8, L10). */
export function levelToDifficulty(level: CoreLevel): Difficulty {
  const n = levelNumber(level);
  if (n <= 3) return 'easy';
  if (n <= 5) return 'medium';
  if (n <= 7) return 'hard';
  if (n <= 9) return 'expert';
  return 'master';
}

function readPlayed(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(localStorage.getItem(PLAYED_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writePlayed(store: Record<string, string[]>): void {
  try {
    localStorage.setItem(PLAYED_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota / private mode: repeats just become possible
  }
}

/** Pick an entry not played yet from this pool; once all were played the cycle starts over. */
export function pickUnplayed(
  poolKey: string,
  entries: PoolEntry[],
  random: () => number = Math.random
): PoolEntry | null {
  if (entries.length === 0) return null;
  const store = readPlayed();
  const played = new Set(Array.isArray(store[poolKey]) ? store[poolKey] : []);
  const fresh = entries.filter((e) => !played.has(e.p));
  // New cycle: avoid serving the puzzle that was just played, when there is any other
  const history = Array.isArray(store[poolKey]) ? store[poolKey] : [];
  const last = history[history.length - 1];
  const restart = entries.length > 1 ? entries.filter((e) => e.p !== last) : entries;
  const choices = fresh.length > 0 ? fresh : restart;
  const entry = choices[Math.floor(random() * choices.length)];
  const nextPlayed = fresh.length > 0 ? [...played, entry.p] : [entry.p];
  writePlayed({ ...store, [poolKey]: nextPlayed });
  return entry;
}

function toPuzzle(entry: PoolEntry): GeneratedPuzzle {
  const grid = (text: string) =>
    Array.from({ length: 9 }, (_, r) =>
      [...text.slice(r * 9, r * 9 + 9)].map((c) => (c === '.' ? 0 : Number(c)))
    );
  return { puzzle: grid(entry.p), solution: grid(entry.s) };
}

export async function pickExtremePuzzle(): Promise<GeneratedPuzzle> {
  const entry = pickUnplayed('extreme', await loadExtreme());
  if (!entry) throw new Error('No extreme puzzles bundled');
  return toPuzzle(entry);
}

export async function pickChallengePuzzle(
  challenge: GameChallenge
): Promise<GeneratedPuzzle & { difficulty: Difficulty }> {
  const entries =
    challenge.kind === 'seventeen'
      ? await loadSeventeen(challenge.key)
      : await loadPractice(challenge.key);
  const entry = pickUnplayed(`${challenge.kind}:${challenge.key}`, entries);
  if (!entry) throw new Error(`No puzzles bundled for ${challenge.kind}:${challenge.key}`);
  return { ...toPuzzle(entry), difficulty: levelToDifficulty(entry.level) };
}

export function parseChallenge(raw: unknown): GameChallenge | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const { kind, key, label } = raw as Record<string, unknown>;
  if (kind !== 'seventeen' && kind !== 'practice') return undefined;
  if (typeof key !== 'string' || typeof label !== 'string') return undefined;
  return { kind, key, label };
}
