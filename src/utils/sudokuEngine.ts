import { generate, solve, type Difficulty as CoreLevel } from 'sudoku-core';
import { CellData, Difficulty } from '../types/sudoku';

/**
 * Difficulty is rated by the hardest human technique a puzzle requires
 * (sudoku-core levels L1–L10), not by the number of clues.
 */
export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; jaLabel: string; level: CoreLevel; techniques: string }
> = {
  easy: {
    label: 'Easy',
    jaLabel: '初級',
    level: 'L2',
    techniques: 'シングルだけで解ける',
  },
  medium: {
    label: 'Medium',
    jaLabel: '中級',
    level: 'L4',
    techniques: 'ブロックと行・列の関係（ポインティング）まで',
  },
  hard: {
    label: 'Hard',
    jaLabel: '上級',
    level: 'L6',
    techniques: 'ペア・トリプル・X-Wing まで',
  },
  expert: {
    label: 'Expert',
    jaLabel: '達人',
    level: 'L8',
    techniques: 'Y-Wing などウイング系まで',
  },
  master: {
    label: 'Master',
    jaLabel: '鬼',
    level: 'L10',
    techniques: 'チェーン系（XY-Chain・AIC）が必要',
  },
};

export type GeneratedPuzzle = { puzzle: number[][]; solution: number[][] };

/** sudoku-core boards are 81 cells (null = empty); the app uses 9x9 grids (0 = empty). */
export function toFlatBoard(grid: number[][]): Array<number | null> {
  return grid.flat().map((v) => (v === 0 ? null : v));
}

export function toGrid(flat: Array<number | null>): number[][] {
  return Array.from({ length: 9 }, (_, r) =>
    flat.slice(r * 9, r * 9 + 9).map((v) => v ?? 0)
  );
}

/**
 * Generate a unique-solution puzzle rated exactly at the difficulty's level.
 * Harder levels can take several seconds on phones, so the default 16 s budget is raised
 * (this runs in a Web Worker, off the UI thread).
 */
export function generatePuzzle(difficulty: Difficulty): GeneratedPuzzle {
  const flat = generate(DIFFICULTY_CONFIG[difficulty].level, { timeoutMs: 60_000 });
  const solved = solve(flat);
  if (!solved.solved || !solved.board) {
    throw new Error('Generated puzzle could not be solved');
  }
  return { puzzle: toGrid(flat), solution: toGrid(solved.board) };
}

/** Convert raw puzzle & solution 9x9 grids into structured CellData[][] */
export function buildInitialBoard(
  puzzle: number[][],
  solution: number[][]
): CellData[][] {
  return puzzle.map((row, rIdx) =>
    row.map((val, cIdx) => ({
      row: rIdx,
      col: cIdx,
      value: val,
      solution: solution[rIdx][cIdx],
      given: val !== 0,
      notes: [],
      isError: false,
    }))
  );
}

/** Recompute conflict / error state for all non-empty cells */
export function evaluateBoardErrors(board: CellData[][]): CellData[][] {
  const next = board.map((row) =>
    row.map((cell) => ({ ...cell, notes: [...cell.notes], isError: false }))
  );

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = next[r][c].value;
      if (val === 0) continue;

      // Check against solution OR duplicate in row/col/box
      let hasConflict = val !== next[r][c].solution;
      if (!hasConflict) {
        for (let i = 0; i < 9; i++) {
          if (i !== c && next[r][i].value === val) hasConflict = true;
          if (i !== r && next[i][c].value === val) hasConflict = true;
        }
        const br = Math.floor(r / 3) * 3;
        const bc = Math.floor(c / 3) * 3;
        for (let rr = br; rr < br + 3; rr++) {
          for (let cc = bc; cc < bc + 3; cc++) {
            if ((rr !== r || cc !== c) && next[rr][cc].value === val) {
              hasConflict = true;
            }
          }
        }
      }

      if (hasConflict && !next[r][c].given) {
        next[r][c].isError = true;
      }
    }
  }

  return next;
}

/** Check if the entire board is solved without errors */
export function isBoardSolved(board: CellData[][]): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (board[r][c].value !== board[r][c].solution) {
        return false;
      }
    }
  }
  return true;
}

/** Count how many times each digit (1-9) is correctly placed on the board */
export function getDigitCounts(board: CellData[][]): Record<number, number> {
  const counts: Record<number, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
  };
  // The board is empty until the first puzzle is generated
  if (board.length !== 9) return counts;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const cell = board[r][c];
      if (cell.value !== 0 && cell.value === cell.solution) {
        counts[cell.value] = (counts[cell.value] || 0) + 1;
      }
    }
  }
  return counts;
}
