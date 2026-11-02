import { describe, expect, it } from 'vitest';
import { FEVER_COMBO, FxState, INITIAL_FX_STATE, reduceFx } from './fxState';
import { MIN_FLASH_INTERVAL_MS, createFlashGate } from './flashGate';
import type { FxEvent } from './fxBus';

function run(events: FxEvent[], start: FxState = INITIAL_FX_STATE) {
  let state = start;
  const shows = [];
  for (const e of events) {
    const out = reduceFx(state, e);
    state = out.state;
    shows.push(...out.shows);
  }
  return { state, shows };
}

// a different cell each time (the same cell pays only once)
const place = (n: number): FxEvent[] =>
  Array.from({ length: n }, (_, i) => ({ type: 'place', row: Math.floor(i / 9), col: i % 9 }));

describe('reduceFx', () => {
  it('counts the combo and enters fever exactly once at the threshold', () => {
    const { state, shows } = run(place(FEVER_COMBO + 3));
    expect(state.combo).toBe(FEVER_COMBO + 3);
    expect(state.fever).toBe(true);
    const fever = shows.filter((s) => s.kind === 'cutin' && s.text === '確変突入');
    expect(fever).toHaveLength(1);
  });

  it('pays 3x balls during fever', () => {
    const before = run(place(FEVER_COMBO - 1)).state;
    const after = reduceFx(before, { type: 'place', row: 8, col: 8 }).state; // this move enters fever
    expect(after.balls - before.balls).toBe(30);
    expect(before.balls).toBe(10 * (FEVER_COMBO - 1));
  });

  it('a miss resets the combo and ends fever with 転落', () => {
    const { state, shows } = run([...place(FEVER_COMBO), { type: 'miss', row: 0, col: 0 }]);
    expect(state.combo).toBe(0);
    expect(state.fever).toBe(false);
    expect(shows[shows.length - 1]).toMatchObject({ kind: 'cutin', text: '転落' });
  });

  it('names single and multiple completed units, with a bigger bonus for more', () => {
    const one = reduceFx(INITIAL_FX_STATE, { type: 'units', units: ['col-2'] });
    expect(one.shows[0]).toMatchObject({ text: 'タテ一列揃い' });
    const two = reduceFx(INITIAL_FX_STATE, { type: 'units', units: ['row-1', 'box-0-0'] });
    expect(two.shows[0]).toMatchObject({ text: 'ダブル揃い' });
    expect(two.state.balls).toBeGreaterThan(one.state.balls * 2);
  });

  it('shows リーチ and 激アツ once each per game, and again after a new start', () => {
    const remaining = (count: number): FxEvent => ({ type: 'remaining', count });
    const { shows } = run([remaining(12), remaining(9), remaining(8), remaining(3), remaining(2)]);
    expect(shows.map((s) => (s.kind === 'cutin' ? s.text : s.kind))).toEqual(['リーチ', '激アツ']);
    const again = run([{ type: 'start' }, remaining(9)], run([remaining(9)]).state);
    expect(again.shows).toHaveLength(1);
  });

  it('does not show リーチ after 激アツ already fired (jumped from 10 to 3)', () => {
    const { shows } = run([{ type: 'remaining', count: 3 }, { type: 'remaining', count: 5 }]);
    expect(shows).toHaveLength(1);
  });
});

describe('erase and retype', () => {
  it('pays a cell and a unit only once', () => {
    const same: FxEvent[] = Array.from({ length: FEVER_COMBO + 2 }, () => ({ type: 'place', row: 4, col: 4 }));
    const { state } = run([...same, { type: 'units', units: ['row-4'] }, { type: 'units', units: ['row-4'] }]);
    expect(state.combo).toBe(1);
    expect(state.fever).toBe(false);
    expect(state.balls).toBe(10 + 50);
  });
});

describe('cut-in priority', () => {
  it('big moments interrupt, single-unit cut-ins and 残念 do not', () => {
    const fever = run(place(FEVER_COMBO)).shows.find((s) => s.kind === 'cutin');
    expect(fever).toMatchObject({ text: '確変突入', priority: true });
    expect(reduceFx(INITIAL_FX_STATE, { type: 'remaining', count: 9 }).shows[0]).toMatchObject({ priority: true });
    expect(reduceFx(INITIAL_FX_STATE, { type: 'units', units: ['row-0'] }).shows[0]).toMatchObject({ priority: false });
    expect(reduceFx(INITIAL_FX_STATE, { type: 'miss', row: 0, col: 0 }).shows[0]).toMatchObject({ priority: false });
  });
});

describe('flash gate', () => {
  it('allows at most 2 flashes in any one second, however often they are asked for', () => {
    let t = 0;
    const allow = createFlashGate(() => t);
    const times: number[] = [];
    for (t = 0; t < 5000; t += 10) if (allow()) times.push(t);
    for (const start of times) {
      expect(times.filter((x) => x >= start && x < start + 1000).length).toBeLessThanOrEqual(2);
    }
    expect(MIN_FLASH_INTERVAL_MS).toBeGreaterThanOrEqual(500);
  });
});
