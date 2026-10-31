import { describe, expect, it } from 'vitest';
import { getDigitCounts } from './sudokuEngine';

describe('getDigitCounts', () => {
  // App renders once with board = [] before the first puzzle arrives (fresh visit, no save)
  it('returns zeros for the empty initial board instead of throwing', () => {
    expect(getDigitCounts([])).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 });
  });
});
