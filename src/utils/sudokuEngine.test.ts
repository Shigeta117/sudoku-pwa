import { describe, expect, it } from 'vitest';
import { analyze, isUniqueSolution } from 'sudoku-core';
import { DIFFICULTIES } from '../types/sudoku';
import { DIFFICULTY_CONFIG, generatePuzzle, toFlatBoard } from './sudokuEngine';

describe('generatePuzzle', () => {
  it.each(DIFFICULTIES)(
    '%s: unique solution, rated at the configured level, solution matches the givens',
    (difficulty) => {
      const { puzzle, solution } = generatePuzzle(difficulty);
      const flat = toFlatBoard(puzzle);

      expect(isUniqueSolution(flat)).toBe(true);
      expect(analyze(flat).difficulty).toBe(DIFFICULTY_CONFIG[difficulty].level);
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (puzzle[r][c] !== 0) expect(solution[r][c]).toBe(puzzle[r][c]);
        }
        expect([...solution[r]].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      }
    },
    60_000
  );
});
