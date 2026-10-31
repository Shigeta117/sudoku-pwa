import { Difficulty } from '../types/sudoku';
import { generateUniquePuzzle } from './sudokuEngine';

/**
 * Generates a guaranteed unique-solution Sudoku puzzle inside an inline Web Worker
 * so the mobile UI thread never freezes during generation.
 * Automatically falls back to synchronous generation if Worker creation is restricted.
 */
export function generatePuzzleAsync(
  difficulty: Difficulty
): Promise<{ puzzle: number[][]; solution: number[][] }> {
  return new Promise((resolve) => {
    try {
      const workerCode = `
        const DIFFICULTY_CONFIG = {
          easy: { clues: 42, maxAttempts: 45 },
          medium: { clues: 34, maxAttempts: 55 },
          hard: { clues: 29, maxAttempts: 65 },
          expert: { clues: 25, maxAttempts: 80 }
        };

        function createEmptyGrid() {
          return Array.from({ length: 9 }, () => Array(9).fill(0));
        }

        function cloneGrid(grid) {
          return grid.map((row) => [...row]);
        }

        function shuffle(arr) {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return arr;
        }

        function isValidPlacement(grid, row, col, num) {
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

        function findBestEmptyCell(grid) {
          let bestRow = -1;
          let bestCol = -1;
          let bestCandidates = [];
          let minCount = 10;

          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              if (grid[r][c] !== 0) continue;
              const candidates = [];
              for (let num = 1; num <= 9; num++) {
                if (isValidPlacement(grid, r, c, num)) candidates.push(num);
              }
              if (candidates.length === 0) return { row: r, col: c, candidates: [] };
              if (candidates.length < minCount) {
                minCount = candidates.length;
                bestRow = r;
                bestCol = c;
                bestCandidates = candidates;
                if (minCount === 1) return { row: bestRow, col: bestCol, candidates: bestCandidates };
              }
            }
          }
          if (bestRow === -1) return null;
          return { row: bestRow, col: bestCol, candidates: bestCandidates };
        }

        function countSolutions(grid, limit = 2) {
          const next = findBestEmptyCell(grid);
          if (!next) return 1;
          if (next.candidates.length === 0) return 0;
          let count = 0;
          const { row, col, candidates } = next;
          for (let i = 0; i < candidates.length; i++) {
            grid[row][col] = candidates[i];
            count += countSolutions(grid, limit - count);
            grid[row][col] = 0;
            if (count >= limit) return count;
          }
          return count;
        }

        function generateSolvedGrid() {
          const grid = createEmptyGrid();
          for (let box = 0; box < 9; box += 3) {
            const nums = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
            let idx = 0;
            for (let r = 0; r < 3; r++) {
              for (let c = 0; c < 3; c++) {
                grid[box + r][box + c] = nums[idx++];
              }
            }
          }
          function fillRemaining() {
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

        self.onmessage = function(e) {
          const difficulty = e.data.difficulty || 'easy';
          const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.easy;
          const solution = generateSolvedGrid();
          const puzzle = cloneGrid(solution);

          const pairs = [];
          const visited = Array.from({ length: 9 }, () => Array(9).fill(false));
          for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
              if (visited[r][c]) continue;
              const sr = 8 - r;
              const sc = 8 - c;
              visited[r][c] = true;
              visited[sr][sc] = true;
              if (r === sr && c === sc) pairs.push([[r, c]]);
              else pairs.push([[r, c], [sr, sc]]);
            }
          }
          shuffle(pairs);

          let cluesRemaining = 81;
          let attempts = 0;

          for (const pair of pairs) {
            if (cluesRemaining <= config.clues || attempts >= config.maxAttempts) break;
            if (cluesRemaining - pair.length < config.clues) continue;
            const saved = pair.map(([r, c]) => puzzle[r][c]);
            for (const [r, c] of pair) puzzle[r][c] = 0;
            attempts++;
            if (countSolutions(cloneGrid(puzzle), 2) !== 1) {
              pair.forEach(([r, c], idx) => { puzzle[r][c] = saved[idx]; });
            } else {
              cluesRemaining -= pair.length;
            }
          }

          if (cluesRemaining > config.clues) {
            const remainingCells = [];
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
              if (countSolutions(cloneGrid(puzzle), 2) !== 1) {
                puzzle[r][c] = backup;
              } else {
                cluesRemaining--;
              }
            }
          }

          self.postMessage({ puzzle, solution });
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      const cleanup = () => {
        worker.terminate();
        URL.revokeObjectURL(url);
      };

      worker.onmessage = (e) => {
        cleanup();
        resolve(e.data);
      };

      worker.onerror = () => {
        cleanup();
        resolve(generateUniquePuzzle(difficulty));
      };

      worker.postMessage({ difficulty });
    } catch {
      resolve(generateUniquePuzzle(difficulty));
    }
  });
}
