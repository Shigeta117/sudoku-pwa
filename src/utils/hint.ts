import { STRATEGY, hint } from 'sudoku-core';
import { CellData } from '../types/sudoku';

const TECHNIQUE_JA: Record<string, string> = {
  [STRATEGY.OPEN_SINGLES]: 'オープンシングル（残り1マス）',
  [STRATEGY.HIDDEN_SINGLE]: '隠れたシングル（そこにしか入らない）',
  [STRATEGY.NAKED_SINGLE]: '裸のシングル（候補が1つだけ）',
  [STRATEGY.POINTING_ELIMINATION]: 'ポインティング',
  [STRATEGY.NAKED_PAIR]: '裸のペア',
  [STRATEGY.NAKED_TRIPLE]: '裸のトリプル',
  [STRATEGY.NAKED_QUAD]: '裸のクワッド',
  [STRATEGY.HIDDEN_PAIR]: '隠れたペア',
  [STRATEGY.HIDDEN_TRIPLE]: '隠れたトリプル',
  [STRATEGY.HIDDEN_QUAD]: '隠れたクワッド',
  [STRATEGY.HIDDEN_GROUPS]: '隠れたグループ',
  [STRATEGY.X_WING]: 'X-Wing',
  [STRATEGY.FINNED_X_WING]: 'フィン付き X-Wing',
  [STRATEGY.SWORDFISH]: 'ソードフィッシュ',
  [STRATEGY.FINNED_SWORDFISH]: 'フィン付きソードフィッシュ',
  [STRATEGY.JELLYFISH]: 'ジェリーフィッシュ',
  [STRATEGY.FINNED_JELLYFISH]: 'フィン付きジェリーフィッシュ',
  [STRATEGY.SKYSCRAPER]: 'スカイスクレイパー',
  [STRATEGY.TWO_STRING_KITE]: 'ツーストリングカイト',
  [STRATEGY.CRANE]: 'クレーン',
  [STRATEGY.EMPTY_RECTANGLE]: 'エンプティレクタングル',
  [STRATEGY.SIMPLE_COLOURING]: 'シンプルカラーリング',
  [STRATEGY.Y_WING]: 'Y-Wing',
  [STRATEGY.XYZ_WING]: 'XYZ-Wing',
  [STRATEGY.WXYZ_WING]: 'WXYZ-Wing',
  [STRATEGY.W_WING]: 'W-Wing',
  [STRATEGY.X_CHAIN]: 'X-Chain',
  [STRATEGY.XY_CHAIN]: 'XY-Chain',
  [STRATEGY.AIC]: 'AIC（交互推論チェーン）',
  [STRATEGY.MEDUSA_3D]: '3D メデューサ',
  [STRATEGY.UNIQUE_RECTANGLE]: 'ユニークレクタングル',
  [STRATEGY.BUG_PLUS_ONE]: 'BUG+1',
  [STRATEGY.NISHIO]: '仮定法（ニシオ）',
};

export function techniqueName(strategy: string): string {
  return TECHNIQUE_JA[strategy] ?? strategy.replace(/ Strategy$/, '');
}

export type HintResult =
  | { kind: 'mistake'; cells: Array<[number, number]> }
  | { kind: 'step'; cell: [number, number]; digit: number; techniques: string[] }
  | { kind: 'none' };

/**
 * Next logical placement for the current board. Wrong digits are reported first,
 * because a human-logic step from a contradictory board would be meaningless.
 */
export function findHint(board: CellData[][]): HintResult {
  const mistakes: Array<[number, number]> = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell.value !== 0 && cell.value !== cell.solution) {
        mistakes.push([cell.row, cell.col]);
      }
    }
  }
  if (mistakes.length > 0) return { kind: 'mistake', cells: mistakes };

  const flat = board.flat().map((c) => (c.value === 0 ? null : c.value));
  if (flat.every((v) => v !== null)) return { kind: 'none' };

  const result = hint(flat);
  const steps = result.steps ?? [];
  for (let i = steps.length - 1; i >= 0; i--) {
    const placed = steps[i].updates.find((u) => u.filledValue !== undefined);
    if (placed && placed.filledValue !== undefined) {
      const techniques = [...new Set(steps.slice(0, i + 1).map((s) => techniqueName(s.strategy)))];
      return {
        kind: 'step',
        cell: [Math.floor(placed.index / 9), placed.index % 9],
        digit: placed.filledValue,
        techniques,
      };
    }
  }
  return { kind: 'none' };
}
