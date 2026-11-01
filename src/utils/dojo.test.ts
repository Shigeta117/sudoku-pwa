import { describe, expect, it } from 'vitest';
import { STRATEGY, getUniqueSolution } from 'sudoku-core';
import {
  DojoExample,
  cellDigitKey,
  judgeEliminations,
  judgePlacement,
  parseDojoFile,
} from './dojoData';
import { DOJO_LESSONS, lessonForStrategy } from './dojoLessons';

const modules = import.meta.glob<{ id: string; strategy: string; examples: unknown[] }>(
  '../data/dojo/*.json',
  { eager: true, import: 'default' }
);
const files = Object.keys(modules).map((path) => path.replace('../data/dojo/', ''));
const load = (file: string) => modules[`../data/dojo/${file}`];

const elimination: DojoExample = {
  board: Array(81).fill(0),
  candidates: Array(81).fill([1, 2, 3]),
  type: 'elimination',
  placements: [],
  eliminations: [
    { index: 3, digit: 2 },
    { index: 4, digit: 2 },
  ],
  patternCells: [],
  patternDigits: [],
  regionCells: [],
};

describe('dojo answer checking', () => {
  it('accepts exactly the eliminated candidates', () => {
    const picked = new Set([cellDigitKey(3, 2), cellDigitKey(4, 2)]);
    expect(judgeEliminations(elimination, picked)).toEqual({ correct: true, missing: 0, extra: 0 });
  });

  it('counts missing and extra picks separately', () => {
    const picked = new Set([cellDigitKey(3, 2), cellDigitKey(5, 1)]);
    expect(judgeEliminations(elimination, picked)).toEqual({ correct: false, missing: 1, extra: 1 });
  });

  it('checks both the cell and the digit of a placement', () => {
    const value: DojoExample = { ...elimination, type: 'value', placements: [{ index: 10, digit: 7 }] };
    expect(judgePlacement(value, 10, 7)).toBe(true);
    expect(judgePlacement(value, 10, 6)).toBe(false);
    expect(judgePlacement(value, 11, 7)).toBe(false);
  });

  it('drops malformed files and examples instead of throwing', () => {
    expect(parseDojoFile(null)).toEqual([]);
    expect(parseDojoFile({ examples: 3 })).toEqual([]);
    expect(parseDojoFile({ examples: [null, { board: 'x' }] })).toEqual([]);
  });
});

describe('dojo lessons', () => {
  it('have unique ids and map back from their strategy', () => {
    expect(new Set(DOJO_LESSONS.map((l) => l.id)).size).toBe(DOJO_LESSONS.length);
    for (const lesson of DOJO_LESSONS) {
      expect(lessonForStrategy(lesson.strategy)?.id).toBe(lesson.id);
    }
    expect(lessonForStrategy(STRATEGY.NAKED_QUAD)).toBeNull();
  });

  it('have a lesson for every bundled example file', () => {
    const ids = new Set(DOJO_LESSONS.map((l) => l.id));
    for (const file of files) expect(ids.has(file.replace(/\.json$/, ''))).toBe(true);
  });
});

describe.each(files)('bundled examples: %s', (file) => {
  const raw = load(file);
  const lesson = DOJO_LESSONS.find((l) => l.id === raw.id);
  const examples = parseDojoFile(raw);

  it('belong to the lesson of the same technique', () => {
    expect(lesson?.strategy).toBe(raw.strategy);
    expect(examples.length).toBe(raw.examples.length);
  });

  it.each(examples.map((e, i) => [i, e] as const))('example %i is sound', (_i, example) => {
    const solution = getUniqueSolution(example.board.map((v) => v || null));
    expect(solution).not.toBeNull();
    if (!solution) return;
    for (let i = 0; i < 81; i++) {
      // Every candidate list must still contain the true digit
      if (example.board[i] === 0) expect(example.candidates[i]).toContain(solution[i]);
    }
    for (const p of example.placements) {
      expect(example.board[p.index]).toBe(0);
      expect(p.digit).toBe(solution[p.index]);
    }
    for (const e of example.eliminations) {
      expect(example.candidates[e.index]).toContain(e.digit);
      expect(e.digit).not.toBe(solution[e.index]);
    }
  });
});
