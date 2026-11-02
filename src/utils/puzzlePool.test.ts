import { beforeEach, describe, expect, it } from 'vitest';
import { STRATEGY, isUniqueSolution } from 'sudoku-core';
import {
  PoolEntry,
  levelToDifficulty,
  parseChallenge,
  parseEntry,
  pickUnplayed,
} from './puzzlePool';
import { parseSavedGame } from './storage';
import { DOJO_LESSONS } from './dojoLessons';

const PUZZLE = '...487....1.3.......6...4.......32.7.4.8.6.9.7.51.......3...5.......4.6....518...';
const SOLUTION = '239487651417365928586291473168953247342876195795142386873629514951734862624518739';

const files = import.meta.glob<{ default: Record<string, unknown> }>('../data/pool/*.json', {
  eager: true,
});
const pool = (name: string) => files[`../data/pool/${name}.json`]?.default;

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

describe('parseEntry', () => {
  it('accepts a consistent puzzle and solution', () => {
    expect(parseEntry({ p: PUZZLE, s: SOLUTION, level: 'L8' })).toEqual({
      p: PUZZLE,
      s: SOLUTION,
      level: 'L8',
    });
  });

  it('rejects malformed or inconsistent entries', () => {
    expect(parseEntry(null)).toBeNull();
    expect(parseEntry({ p: PUZZLE, s: SOLUTION, level: 'L11' })).toBeNull();
    expect(parseEntry({ p: PUZZLE.slice(1), s: SOLUTION, level: 'L8' })).toBeNull();
    // a given that disagrees with the solution
    expect(parseEntry({ p: '1' + PUZZLE.slice(1), s: SOLUTION, level: 'L8' })).toBeNull();
  });
});

describe('levelToDifficulty', () => {
  it('maps every sudoku-core level onto the game difficulties', () => {
    expect(levelToDifficulty('L1')).toBe('easy');
    expect(levelToDifficulty('L3')).toBe('easy');
    expect(levelToDifficulty('L4')).toBe('medium');
    expect(levelToDifficulty('L7')).toBe('hard');
    expect(levelToDifficulty('L9')).toBe('expert');
    expect(levelToDifficulty('L10')).toBe('master');
  });
});

describe('pickUnplayed', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
  });

  const entries: PoolEntry[] = ['a', 'b', 'c'].map((ch) => ({
    p: ch.repeat(81),
    s: SOLUTION,
    level: 'L4',
  }));

  it('does not repeat a puzzle until the whole pool was played', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) seen.add(pickUnplayed('test', entries, () => 0)!.p);
    expect(seen.size).toBe(3);
    // fourth pick starts a new cycle instead of failing
    expect(pickUnplayed('test', entries, () => 0)).not.toBeNull();
  });

  it('keeps separate histories per pool', () => {
    pickUnplayed('one', entries, () => 0);
    expect(pickUnplayed('two', entries, () => 0)!.p).toBe(entries[0].p);
  });

  it('returns null for an empty pool', () => {
    expect(pickUnplayed('test', [])).toBeNull();
  });
});

describe('challenge persistence', () => {
  it('validates the challenge of a saved game', () => {
    expect(parseChallenge({ kind: 'seventeen', key: 'hard', label: 'x' })).toEqual({
      kind: 'seventeen',
      key: 'hard',
      label: 'x',
    });
    expect(parseChallenge({ kind: 'other', key: 'k', label: 'x' })).toBeUndefined();
    expect(parseChallenge('practice')).toBeUndefined();
  });

  it('round-trips through parseSavedGame', () => {
    const board = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => ({
        row: r,
        col: c,
        value: 0,
        solution: Number(SOLUTION[r * 9 + c]),
        given: false,
        notes: [],
      }))
    );
    const challenge = { kind: 'practice', key: STRATEGY.Y_WING, label: '練習 Y-Wing' };
    const saved = parseSavedGame({
      version: 1,
      difficulty: 'expert',
      board,
      history: [],
      historyIndex: 0,
      elapsedSeconds: 0,
      mistakes: 0,
      isCompleted: false,
      lastUpdatedAt: 0,
      challenge,
    });
    expect(saved?.challenge).toEqual(challenge);
    expect(parseSavedGame({ ...saved, challenge: undefined })?.challenge).toBeUndefined();
  });
});

describe('bundled pools', () => {
  // build-pool.mjs checks uniqueness of every entry; here only a sample (17-clue checks take ~0.2 s each)
  const UNIQUE_SAMPLE = 5;
  const checkEntries = (list: unknown) => {
    expect(Array.isArray(list)).toBe(true);
    (list as unknown[]).forEach((raw, index) => {
      const entry = parseEntry(raw);
      expect(entry, JSON.stringify(raw)).not.toBeNull();
      const solution = [...entry!.s].map(Number);
      for (let k = 0; k < 9; k++) {
        const row = new Set(solution.slice(k * 9, k * 9 + 9));
        const col = new Set(solution.filter((_, i) => i % 9 === k));
        const box = new Set(
          solution.filter(
            (_, i) => Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3) === k
          )
        );
        expect([row.size, col.size, box.size]).toEqual([9, 9, 9]);
      }
      if (index < UNIQUE_SAMPLE) {
        expect(isUniqueSolution([...entry!.p].map((c) => (c === '.' ? null : Number(c))))).toBe(true);
      }
    });
  };

  it('極: valid unique puzzles at L10 needing many chains', () => {
    const data = pool('extreme') as { minChains: number; puzzles: { level: string; chains: number }[] };
    expect(data.puzzles.length).toBeGreaterThanOrEqual(50);
    checkEntries(data.puzzles);
    for (const p of data.puzzles) {
      expect(p.level).toBe('L10');
      expect(p.chains).toBeGreaterThanOrEqual(data.minChains);
    }
  });

  it('17 個: valid unique puzzles with exactly 17 givens, both bands present', () => {
    const data = pool('seventeen') as { puzzles: { p: string; level: string }[] };
    checkEntries(data.puzzles);
    for (const p of data.puzzles) expect(p.p.replace(/\./g, '').length).toBe(17);
    const hard = data.puzzles.filter((p) => Number(p.level.slice(1)) >= 6);
    expect(hard.length).toBeGreaterThan(0);
    expect(data.puzzles.length - hard.length).toBeGreaterThan(0);
  });

  it('練習: keyed by real lesson strategies, all entries valid', () => {
    const data = pool('practice') as { byStrategy: Record<string, unknown[]> };
    const strategies = new Set(DOJO_LESSONS.map((l) => l.strategy));
    for (const [strategy, list] of Object.entries(data.byStrategy)) {
      // a practice set no lesson points to would never be reachable
      expect(strategies.has(strategy), strategy).toBe(true);
      checkEntries(list);
    }
  });
});

describe('pickUnplayed across cycles', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage(), configurable: true });
  });

  it('does not serve the just-played puzzle first in the next cycle', () => {
    const entries: PoolEntry[] = ['a', 'b'].map((ch) => ({ p: ch.repeat(81), s: SOLUTION, level: 'L4' }));
    const first = pickUnplayed('cycle', entries, () => 0)!.p;
    const second = pickUnplayed('cycle', entries, () => 0)!.p;
    expect(second).not.toBe(first);
    // both played: the new cycle must not start with `second` again
    // (0.99 picks the last candidate, which is `second` when the whole pool is offered)
    expect(pickUnplayed('cycle', entries, () => 0.99)!.p).not.toBe(second);
  });
});

describe('broken challenge in a save', () => {
  it('discards the save instead of restoring it as a normal (stats-counted) game', () => {
    const board = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, c) => ({
        row: r,
        col: c,
        value: 0,
        solution: Number(SOLUTION[r * 9 + c]),
        given: false,
        notes: [],
      }))
    );
    const base = { version: 1, difficulty: 'expert', board, history: [], historyIndex: 0 };
    expect(parseSavedGame({ ...base, challenge: { kind: 'future', key: 'x', label: 'x' } })).toBeNull();
    expect(parseSavedGame(base)).not.toBeNull();
  });
});
