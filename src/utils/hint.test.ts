import { describe, expect, it } from 'vitest';
import { findHint } from './hint';
import { buildInitialBoard, generatePuzzle } from './sudokuEngine';

describe('findHint', () => {
  const { puzzle, solution } = generatePuzzle('medium');

  it('points to an empty cell with its correct digit and a Japanese technique name', () => {
    const board = buildInitialBoard(puzzle, solution);
    const result = findHint(board);
    expect(result.kind).toBe('step');
    if (result.kind !== 'step') return;
    const [r, c] = result.cell;
    expect(board[r][c].value).toBe(0);
    expect(result.digit).toBe(solution[r][c]);
    expect(result.techniques.length).toBeGreaterThan(0);
    expect(result.techniques.join()).not.toMatch(/Strategy/);
  });

  it('reports wrong digits before giving a logical step', () => {
    const board = buildInitialBoard(puzzle, solution);
    const empty = board.flat().find((cell) => cell.value === 0)!;
    empty.value = (empty.solution % 9) + 1;
    const result = findHint(board);
    expect(result).toEqual({ kind: 'mistake', cells: [[empty.row, empty.col]] });
  });

  it('returns none for a solved board', () => {
    expect(findHint(buildInitialBoard(solution, solution)).kind).toBe('none');
  });
});
