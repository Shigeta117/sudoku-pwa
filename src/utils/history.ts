import { BoardSnapshot } from '../types/sudoku';

/** Upper bound so the per-second autosave stays small on long, note-heavy games. */
export const MAX_HISTORY = 300;

/** Append a snapshot after `index`, dropping the redo branch and the oldest entries past the cap. */
export function pushHistory(
  history: BoardSnapshot[],
  index: number,
  snapshot: BoardSnapshot
): { history: BoardSnapshot[]; index: number } {
  const next = [...history.slice(0, index + 1), snapshot];
  const trimmed = next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
  return { history: trimmed, index: trimmed.length - 1 };
}
