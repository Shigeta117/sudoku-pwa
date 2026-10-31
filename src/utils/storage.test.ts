import { describe, expect, it } from 'vitest';
import { parseSavedGame } from './storage';
import { buildInitialBoard } from './sudokuEngine';

const grid = (v: number) => Array.from({ length: 9 }, () => Array(9).fill(v));
const board = buildInitialBoard(grid(0), grid(1));
const snapshot = { values: grid(0), notes: grid(0).map((row) => row.map(() => [])) };

const valid = {
  version: 1,
  difficulty: 'hard',
  board,
  history: [snapshot, snapshot],
  historyIndex: 1,
  elapsedSeconds: 42,
  mistakes: 2,
  isCompleted: false,
  lastUpdatedAt: 1,
};

describe('parseSavedGame', () => {
  it('accepts a well-formed save', () => {
    const parsed = parseSavedGame(valid);
    expect(parsed?.difficulty).toBe('hard');
    expect(parsed?.historyIndex).toBe(1);
    expect(parsed?.hintsUsed).toBe(0);
  });

  it('rejects null, wrong version and unknown difficulty', () => {
    expect(parseSavedGame(null)).toBeNull();
    expect(parseSavedGame({ ...valid, version: 2 })).toBeNull();
    expect(parseSavedGame({ ...valid, difficulty: 'insane' })).toBeNull();
  });

  it('rejects boards that would crash the renderer', () => {
    expect(parseSavedGame({ ...valid, board: [1, 2, 3] })).toBeNull();
    expect(parseSavedGame({ ...valid, board: board.slice(0, 8) })).toBeNull();
    const brokenCell = board.map((row) => [...row]);
    brokenCell[4][4] = { ...brokenCell[4][4], notes: 'x' as unknown as number[] };
    expect(parseSavedGame({ ...valid, board: brokenCell })).toBeNull();
    const badValue = board.map((row) => [...row]);
    badValue[0][0] = { ...badValue[0][0], value: 12 };
    expect(parseSavedGame({ ...valid, board: badValue })).toBeNull();
  });

  it('clamps an out-of-range history index so undo cannot read undefined', () => {
    expect(parseSavedGame({ ...valid, historyIndex: 5 })?.historyIndex).toBe(1);
    expect(parseSavedGame({ ...valid, historyIndex: -3 })?.historyIndex).toBe(0);
  });

  it('drops a malformed history instead of the whole game', () => {
    const parsed = parseSavedGame({ ...valid, history: [{ values: 1 }] });
    expect(parsed?.history).toEqual([]);
    expect(parsed?.historyIndex).toBe(0);
  });
});
