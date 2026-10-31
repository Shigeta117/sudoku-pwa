import { describe, expect, it } from 'vitest';
import { BoardSnapshot } from '../types/sudoku';
import { MAX_HISTORY, pushHistory } from './history';

const snap = (n: number): BoardSnapshot => ({ values: [[n]], notes: [[[]]] });

describe('pushHistory', () => {
  it('drops the redo branch after the current index', () => {
    const result = pushHistory([snap(0), snap(1), snap(2)], 0, snap(9));
    expect(result.history.map((s) => s.values[0][0])).toEqual([0, 9]);
    expect(result.index).toBe(1);
  });

  it('keeps at most MAX_HISTORY entries, dropping the oldest', () => {
    const full = Array.from({ length: MAX_HISTORY }, (_, i) => snap(i));
    const result = pushHistory(full, MAX_HISTORY - 1, snap(-1));
    expect(result.history).toHaveLength(MAX_HISTORY);
    expect(result.history[0].values[0][0]).toBe(1);
    expect(result.history[result.index].values[0][0]).toBe(-1);
  });
});
