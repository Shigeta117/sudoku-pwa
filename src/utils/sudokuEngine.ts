import { CellData, Difficulty } from '../types/sudoku';

/**
 * Target number of clues (given digits) per difficulty.
 * Every generated puzzle is strictly verified to have a UNIQUE solution (countSolutions === 1).
 */
export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; jaLabel: string; clues: number; maxAttempts: number }
> = {
  easy: { label: 'Easy', jaLabel: '初級', clues: 42, maxAttempts: 45 },
  medium: { label: 'Medium', jaLabel: '中級', clues: 34, maxAttempts: 55 },
  hard: { label: 'Hard', jaLabel: '上級', clues: 29, maxAttempts: 65 },
  expert: { label: 'Expert', jaLabel: '達人', clues: 25, maxAttempts: 80 },
};

/** Create an empty 9x9 number grid filled with 0 */
export function createEmptyGrid(): number[][] {
  return Array.from({ length: 9 }, () => Array(9).fill(0));
}

/** Deep clone a 9x9 number grid */
export function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

/** Shuffle array in-place using Fisher-Yates */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Check if placing `num` at (row, col) is valid according to Sudoku rules */
export function isValidPlacement(
  grid: number[][],
  row: number,
  col: number,
  num: number
): boolean {
  for (let i = 0; i < 9; i++) {
    if (i !== col && grid[row][i] === num) return false;
    if (i !== row && grid[i][col] === num) return false;
  }
  const startRow = Math.floor(row / 3) * 3;
  const startCol = Math.floor(col / 3) * 3;
  for (let r = startRow; r < startRow + 3; r++) {
    for (let c = startCol; c < startCol + 3; c++) {
      if ((r !== row || c !== col) && grid[r][c] === num) return false;
    }
  }
  return true;
}

/**
 * Find the empty cell with the Minimum Remaining Values (MRV heuristic)
 * to dramatically speed up solving and uniqueness verification on mobile devices.
 */
function findBestEmptyCell(grid: number[][]): {
  row: number;
  col: number;
  candidates: number[];
} | null {
  let bestRow = -1;
  let bestCol = -1;
  let bestCandidates: number[] = [];
  let minCount = 10;

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== 0) continue;
      const candidates: number[] = [];
      for (let num = 1; num <= 9; num++) {
        if (isValidPlacement(grid, r, c, num)) {
          candidates.push(num);
        }
      }
      if (candidates.length === 0) {
        return { row: r, col: c, candidates: [] };
      }
      if (candidates.length < minCount) {
        minCount = candidates.length;
        bestRow = r;
        bestCol = c;
        bestCandidates = candidates;
        if (minCount === 1) {
          return { row: bestRow, col: bestCol, candidates: bestCandidates };
        }
      }
    }
  }

  if (bestRow === -1) return null;
  return { row: bestRow, col: bestCol, candidates: bestCandidates };
}

/**
 * Count the number of valid solutions for a given 9x9 grid, stopping early once `limit` is reached.
 * Setting `limit = 2` allows fast verification that a puzzle has a strictly unique solution (count === 1).
 */
export function countSolutions(grid: number[][], limit = 2): number {
  const next = findBestEmptyCell(grid);
  if (!next) {
    return 1; // No empty cells left -> found 1 complete valid solution
  }
  if (next.candidates.length === 0) {
    return 0; // Dead end
  }

  let count = 0;
  const { row, col, candidates } = next;
  for (let i = 0; i < candidates.length; i++) {
    grid[row][col] = candidates[i];
    count += countSolutions(grid, limit - count);
    grid[row][col] = 0;
    if (count >= limit) {
      return count;
    }
  }
  return count;
}

/** Generate a complete, valid 9x9 solved Sudoku grid using randomized backtracking */
export function generateSolvedGrid(): number[][] {
  const grid = createEmptyGrid();

  // Fill diagonal 3x3 boxes first (they are independent of each other)
  for (let box = 0; box < 9; box += 3) {
    const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    let idx = 0;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        grid[box + r][box + c] = nums[idx++];
      }
    }
  }

  function fillRemaining(): boolean {
    const next = findBestEmptyCell(grid);
    if (!next) return true;
    const { row, col, candidates } = next;
    const shuffled = shuffle([...candidates]);
    for (const num of shuffled) {
      grid[row][col] = num;
      if (fillRemaining()) return true;
      grid[row][col] = 0;
    }
    return false;
  }

  fillRemaining();
  return grid;
}

/**
 * Dig holes symmetrically (rotational 180° symmetry) while strictly preserving a unique solution.
 * If symmetric digging reaches the limit before hitting target clues, single-cell digging refines it.
 */
export function generateUniquePuzzle(difficulty: Difficulty): {
  puzzle: number[][];
  solution: number[][];
} {
  const config = DIFFICULTY_CONFIG[difficulty];
  const solution = generateSolvedGrid();
  const puzzle = cloneGrid(solution);

  // Build rotational symmetry pairs: (r, c) and (8 - r, 8 - c)
  const pairs: Array<Array<[number, number]>> = [];
  const visited = Array.from({ length: 9 }, () => Array(9).fill(false));

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (visited[r][c]) continue;
      const sr = 8 - r;
      const sc = 8 - c;
      visited[r][c] = true;
      visited[sr][sc] = true;
      if (r === sr && c === sc) {
        pairs.push([[r, c]]);
      } else {
        pairs.push([
          [r, c],
          [sr, sc],
        ]);
      }
    }
  }

  shuffle(pairs);

  let cluesRemaining = 81;
  let attempts = 0;

  // Pass 1: Symmetric removal
  for (const pair of pairs) {
    if (cluesRemaining <= config.clues || attempts >= config.maxAttempts) break;
    if (cluesRemaining - pair.length < config.clues) continue;

    const saved = pair.map(([r, c]) => puzzle[r][c]);
    for (const [r, c] of pair) {
      puzzle[r][c] = 0;
    }
    attempts++;

    const testCopy = cloneGrid(puzzle);
    const numSolutions = countSolutions(testCopy, 2);
    if (numSolutions !== 1) {
      // Restore if uniqueness is broken
      pair.forEach(([r, c], idx) => {
        puzzle[r][c] = saved[idx];
      });
    } else {
      cluesRemaining -= pair.length;
    }
  }

  // Pass 2: Individual cell refinement if needed to reach target clue count
  if (cluesRemaining > config.clues) {
    const remainingCells: Array<[number, number]> = [];
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] !== 0) remainingCells.push([r, c]);
      }
    }
    shuffle(remainingCells);

    for (const [r, c] of remainingCells) {
      if (cluesRemaining <= config.clues || attempts >= config.maxAttempts) break;
      const backup = puzzle[r][c];
      puzzle[r][c] = 0;
      attempts++;

      const testCopy = cloneGrid(puzzle);
      if (countSolutions(testCopy, 2) !== 1) {
        puzzle[r][c] = backup;
      } else {
        cluesRemaining--;
      }
    }
  }

  return { puzzle, solution };
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
