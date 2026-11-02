/**
 * Sound effects synthesized with Web Audio (no audio files to download or cache).
 * The context is created on the first sound, which always follows a tap, so mobile
 * autoplay rules are satisfied.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    }
    // iOS leaves it 'interrupted' after an app switch or a call, not only 'suspended'
    if (ctx.state !== 'running') void ctx.resume();
    return master ? { ctx, out: master } : null;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, length: number, type: OscillatorType = 'square', gain = 0.5, slideTo?: number) {
  const a = audio();
  if (!a) return;
  const t = a.ctx.currentTime + start;
  const osc = a.ctx.createOscillator();
  const env = a.ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + length);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  env.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(env).connect(a.out);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const note = (semitones: number) => 660 * 2 ** (semitones / 12);

/** A chime that climbs the scale as the combo grows */
export function playPlace(combo: number) {
  const step = SCALE[Math.min(combo, SCALE.length - 1)];
  tone(note(step), 0, 0.09, 'square', 0.35);
  tone(note(step + 7), 0.05, 0.12, 'triangle', 0.3);
}

export function playCoins(count = 4) {
  for (let i = 0; i < count; i++) tone(1800 + Math.random() * 900, i * 0.045, 0.06, 'triangle', 0.25);
}

export function playMiss() {
  tone(220, 0, 0.25, 'sawtooth', 0.3, 110);
}

export function playCutIn() {
  tone(440, 0, 0.18, 'sawtooth', 0.3, 1320);
  tone(880, 0.12, 0.2, 'square', 0.25);
}

/** Rising alarm-like sweep for リーチ / 激アツ (sound only; the screen does not blink) */
export function playReach() {
  for (let i = 0; i < 3; i++) tone(500, i * 0.22, 0.2, 'sawtooth', 0.28, 1000);
}

export function playFever() {
  [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(note(s - 12), i * 0.06, 0.16, 'square', 0.3));
}

export function playReelStop() {
  tone(180, 0, 0.08, 'square', 0.4, 90);
}

export function playJackpot() {
  const melody = [0, 4, 7, 12, 7, 12, 16, 19, 24];
  melody.forEach((s, i) => {
    tone(note(s - 12), i * 0.11, 0.2, 'square', 0.3);
    tone(note(s - 24), i * 0.11, 0.2, 'triangle', 0.25);
  });
  for (let i = 0; i < 24; i++) tone(1600 + Math.random() * 1400, 1 + i * 0.05, 0.06, 'triangle', 0.18);
}
