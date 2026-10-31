import { Difficulty } from '../types/sudoku';
import { GeneratedPuzzle, generatePuzzle } from './sudokuEngine';

const PREFETCH_KEY = 'zen_sudoku_prefetched_v1';

/**
 * Generates a puzzle inside a Web Worker so the mobile UI thread never freezes
 * (harder levels can take a few seconds on phones).
 * Falls back to generating on the main thread if a Worker cannot be created.
 */
function generateInWorker(difficulty: Difficulty): Promise<GeneratedPuzzle> {
  return new Promise((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./puzzle.worker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      try {
        resolve(generatePuzzle(difficulty));
      } catch (err) {
        reject(err);
      }
      return;
    }

    worker.onmessage = (
      e: MessageEvent<({ ok: true } & GeneratedPuzzle) | { ok: false; error: string }>
    ) => {
      worker.terminate();
      if (e.data.ok) {
        resolve({ puzzle: e.data.puzzle, solution: e.data.solution });
      } else {
        reject(new Error(e.data.error));
      }
    };
    // e.g. module workers unsupported (iOS < 15) or the worker script failed to load
    worker.onerror = () => {
      worker.terminate();
      try {
        resolve(generatePuzzle(difficulty));
      } catch (err) {
        reject(err);
      }
    };
    worker.postMessage({ difficulty });
  });
}

const isGrid = (v: unknown, min: number): v is number[][] =>
  Array.isArray(v) &&
  v.length === 9 &&
  v.every(
    (row) =>
      Array.isArray(row) &&
      row.length === 9 &&
      row.every((n) => Number.isInteger(n) && n >= min && n <= 9)
  );

function readPrefetched(): Partial<Record<Difficulty, GeneratedPuzzle>> {
  try {
    const parsed = JSON.parse(localStorage.getItem(PREFETCH_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePrefetched(store: Partial<Record<Difficulty, GeneratedPuzzle>>): void {
  try {
    localStorage.setItem(PREFETCH_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota / private mode: we just generate on demand next time
  }
}

/** Take (and remove) a puzzle generated in the background earlier, if any. */
function takePrefetched(difficulty: Difficulty): GeneratedPuzzle | null {
  const store = readPrefetched();
  const entry = store[difficulty];
  if (!entry) return null;
  const rest = { ...store };
  delete rest[difficulty];
  writePrefetched(rest);
  return isGrid(entry.puzzle, 0) && isGrid(entry.solution, 1) ? entry : null;
}

const inFlight = new Map<Difficulty, Promise<void>>();

/** Generate the next puzzle of this difficulty in the background so "new game" starts instantly. */
export function prefetchPuzzle(difficulty: Difficulty): void {
  if (inFlight.has(difficulty) || readPrefetched()[difficulty]) return;
  const job = generateInWorker(difficulty)
    .then((puzzle) => writePrefetched({ ...readPrefetched(), [difficulty]: puzzle }))
    .catch(() => {
      // Background only: a failure just means the next game is generated on demand
    })
    .finally(() => inFlight.delete(difficulty));
  inFlight.set(difficulty, job);
}

export async function generatePuzzleAsync(difficulty: Difficulty): Promise<GeneratedPuzzle> {
  // Reuse a running prefetch instead of starting a second worker for the same level
  const running = inFlight.get(difficulty);
  if (running) await running;
  return takePrefetched(difficulty) ?? generateInWorker(difficulty);
}
