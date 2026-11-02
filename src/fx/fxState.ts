import type { FxEvent } from './fxBus';

/** Score state of the effects mode: balls won, consecutive correct moves, 確変 (fever) */
export interface FxState {
  balls: number;
  combo: number;
  fever: boolean;
  reachShown: boolean;
  hotShown: boolean;
  /** Cells ('r-c') and units already paid out, so erase-and-retype earns nothing twice */
  scoredCells: string[];
  shownUnits: string[];
}

export type CutInTone = 'gold' | 'red' | 'rainbow' | 'gray';

/** What the layer should show for one event */
export type FxShow =
  | { kind: 'burst'; row: number; col: number; size: number }
  | { kind: 'combo'; row: number; col: number; combo: number }
  /** priority: interrupts whatever is playing; others are skipped while one plays */
  | { kind: 'cutin'; text: string; sub?: string; tone: CutInTone; flash: boolean; shake: boolean; priority: boolean }
  | { kind: 'jackpot' };

export const FEVER_COMBO = 10;
export const REACH_REMAINING = 9;
export const HOT_REMAINING = 3;
const BALLS_PER_PLACE = 10;
const FEVER_MULTIPLIER = 3;
const UNIT_BONUS = 50;
const JACKPOT_BONUS = 1000;

export const INITIAL_FX_STATE: FxState = {
  balls: 0,
  combo: 0,
  fever: false,
  reachShown: false,
  hotShown: false,
  scoredCells: [],
  shownUnits: [],
};

const UNIT_NAMES: Record<string, string> = { row: 'ヨコ一列', col: 'タテ一列', box: 'ブロック' };
const MULTI_NAMES = ['', '', 'ダブル', 'トリプル', 'クアッド'];

function unitsCutIn(units: string[]): FxShow {
  if (units.length === 1) {
    const kind = units[0].split('-')[0];
    return {
      kind: 'cutin',
      text: kind === 'box' ? 'ブロック完成' : `${UNIT_NAMES[kind] ?? ''}揃い`,
      tone: 'gold',
      flash: false,
      shake: false,
      priority: false,
    };
  }
  return {
    kind: 'cutin',
    text: `${MULTI_NAMES[units.length] ?? `${units.length}連`}揃い`,
    sub: `+${UNIT_BONUS * units.length * units.length} 玉`,
    tone: 'red',
    flash: true,
    shake: true,
    priority: true,
  };
}

/** Advance the score and list what to show. Pure, so the rules are testable without a DOM. */
export function reduceFx(state: FxState, event: FxEvent): { state: FxState; shows: FxShow[] } {
  switch (event.type) {
    case 'start':
      return { state: INITIAL_FX_STATE, shows: [] };

    case 'place': {
      const cell = `${event.row}-${event.col}`;
      if (state.scoredCells.includes(cell)) {
        return { state, shows: [{ kind: 'burst', row: event.row, col: event.col, size: 6 }] };
      }
      const combo = state.combo + 1;
      const enteringFever = !state.fever && combo >= FEVER_COMBO;
      const fever = state.fever || enteringFever;
      const balls = state.balls + BALLS_PER_PLACE * (fever ? FEVER_MULTIPLIER : 1);
      const shows: FxShow[] = [
        { kind: 'burst', row: event.row, col: event.col, size: Math.min(12 + combo * 2, 48) },
      ];
      if (combo >= 3) shows.push({ kind: 'combo', row: event.row, col: event.col, combo });
      if (enteringFever) {
        shows.push({ kind: 'cutin', text: '確変突入', sub: '持ち玉 3 倍', tone: 'rainbow', flash: true, shake: true, priority: true });
      }
      return { state: { ...state, combo, fever, balls, scoredCells: [...state.scoredCells, cell] }, shows };
    }

    case 'miss': {
      const shows: FxShow[] = [
        state.fever
          ? { kind: 'cutin', text: '転落', sub: '確変終了', tone: 'gray', flash: false, shake: true, priority: true }
          : { kind: 'cutin', text: '残念…', tone: 'gray', flash: false, shake: false, priority: false },
      ];
      return { state: { ...state, combo: 0, fever: false }, shows };
    }

    case 'units': {
      const units = event.units.filter((u) => !state.shownUnits.includes(u));
      if (units.length === 0) return { state, shows: [] };
      const bonus = UNIT_BONUS * units.length * units.length;
      return {
        state: { ...state, balls: state.balls + bonus, shownUnits: [...state.shownUnits, ...units] },
        shows: [unitsCutIn(units)],
      };
    }

    case 'remaining': {
      if (event.count <= HOT_REMAINING && event.count > 0 && !state.hotShown) {
        return {
          state: { ...state, hotShown: true, reachShown: true },
          shows: [{ kind: 'cutin', text: '激アツ', sub: `残り ${event.count} マス`, tone: 'red', flash: true, shake: true, priority: true }],
        };
      }
      if (event.count <= REACH_REMAINING && event.count > HOT_REMAINING && !state.reachShown) {
        return {
          state: { ...state, reachShown: true },
          shows: [{ kind: 'cutin', text: 'リーチ', sub: `残り ${event.count} マス`, tone: 'gold', flash: false, shake: true, priority: true }],
        };
      }
      return { state, shows: [] };
    }

    case 'win':
      return { state: { ...state, balls: state.balls + JACKPOT_BONUS }, shows: [{ kind: 'jackpot' }] };
  }
}
