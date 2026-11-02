import { useCallback, useEffect, useRef, useState } from 'react';
import './fx.css';
import { FxEvent, subscribeFx } from './fxBus';
import { FxShow, FxState, INITIAL_FX_STATE, reduceFx } from './fxState';
import { createFlashGate } from './flashGate';
import { createParticles } from './particles';
import { playCoins, playCutIn, playFever, playMiss, playPlace, playReach } from './fxAudio';
import { Jackpot } from './Jackpot';

type CutIn = Extract<FxShow, { kind: 'cutin' }> & { id: number };
type ComboPop = { id: number; x: number; y: number; combo: number };

const CUTIN_MS = 1250;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function cellCenter(row: number, col: number): { x: number; y: number } | null {
  const el = document.querySelector(`[data-fx-cell="${row}-${col}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function useBoardRect() {
  const [rect, setRect] = useState<DOMRect | null>(null);
  useEffect(() => {
    const update = () => setRect(document.querySelector('[role="grid"]')?.getBoundingClientRect() ?? null);
    update();
    const grid = document.querySelector('[role="grid"]');
    const observer = grid ? new ResizeObserver(update) : null;
    if (grid) observer?.observe(grid);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);
  return rect;
}

/** Full-screen effects for ドパガキモード. Listens to fxBus; never takes pointer input except the jackpot. */
export default function FxLayer({ sound }: { sound: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<ReturnType<typeof createParticles> | null>(null);
  const stateRef = useRef<FxState>(INITIAL_FX_STATE);
  const allowFlash = useRef(createFlashGate()).current;
  const idRef = useRef(0);
  // Read at play time, so toggling the setting does not re-run the cut-in effect
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const [hud, setHud] = useState<FxState>(INITIAL_FX_STATE);
  const [cutIns, setCutIns] = useState<CutIn[]>([]);
  const [pops, setPops] = useState<ComboPop[]>([]);
  const [flashId, setFlashId] = useState(0);
  const [jackpot, setJackpot] = useState(false);
  const boardRect = useBoardRect();

  useEffect(() => {
    if (!canvasRef.current) return;
    particlesRef.current = createParticles(canvasRef.current);
    return () => particlesRef.current?.destroy();
  }, []);

  const flash = useCallback(() => {
    if (!reducedMotion() && allowFlash()) setFlashId((n) => n + 1);
  }, [allowFlash]);

  const shake = useCallback((strength: number) => {
    if (reducedMotion()) return;
    document.getElementById('root')?.animate(
      [0, -1, 1, -1, 1, 0].map((s) => ({ transform: `translate(${s * strength}px, ${-s * strength * 0.6}px)` })),
      { duration: 380, easing: 'ease-out' }
    );
  }, []);

  const show = useCallback(
    (s: FxShow) => {
      const id = ++idRef.current;
      if (s.kind === 'burst') {
        const at = cellCenter(s.row, s.col);
        if (at) particlesRef.current?.burst(at.x, at.y, reducedMotion() ? 6 : s.size);
      } else if (s.kind === 'combo') {
        const at = cellCenter(s.row, s.col);
        if (!at) return;
        setPops((list) => [...list, { id, x: at.x, y: at.y, combo: s.combo }]);
        window.setTimeout(() => setPops((list) => list.filter((p) => p.id !== id)), 800);
      } else if (s.kind === 'cutin') {
        // Big moments cut in at once; minor ones are skipped while something is playing
        setCutIns((list) => (s.priority ? [{ ...s, id }] : list.length > 0 ? list : [{ ...s, id }]));
      } else if (s.kind === 'jackpot') {
        setJackpot(true);
      }
    },
    []
  );

  // Play the head of the cut-in queue: sound, flash and shake fire when it appears
  const current = cutIns[0];
  useEffect(() => {
    if (!current) return;
    if (current.flash) flash();
    if (current.shake) shake(current.tone === 'gray' ? 4 : 9);
    if (soundRef.current) {
      if (current.text === '確変突入') playFever();
      else if (current.text === 'リーチ' || current.text === '激アツ') playReach();
      else if (current.tone === 'gray') playMiss();
      else playCutIn();
    }
    const t = window.setTimeout(() => setCutIns((list) => list.slice(1)), CUTIN_MS);
    return () => window.clearTimeout(t);
  }, [current, flash, shake]);

  useEffect(
    () =>
      subscribeFx((event: FxEvent) => {
        const { state, shows } = reduceFx(stateRef.current, event);
        stateRef.current = state;
        setHud(state);
        particlesRef.current?.setRainbow(state.fever);
        if (event.type === 'start') {
          setCutIns([]);
          setJackpot(false);
        }
        if (soundRef.current && event.type === 'place') {
          playPlace(state.combo);
          if (state.combo % 5 === 0) playCoins(6);
        }
        shows.forEach(show);
      }),
    [show]
  );

  return (
    <div className={`fx-root ${hud.fever ? 'fx-fever' : ''} ${jackpot ? 'fx-top' : ''}`} aria-hidden={!jackpot}>
      <div className="fx-leds">
        <div className="fx-led fx-led-top" />
        <div className="fx-led fx-led-bottom" />
        <div className="fx-led fx-led-left" />
        <div className="fx-led fx-led-right" />
      </div>
      {boardRect ? (
        <div
          className="fx-frame"
          style={{ left: boardRect.left - 6, top: boardRect.top - 6, width: boardRect.width + 12, height: boardRect.height + 12 }}
        />
      ) : null}
      <canvas ref={canvasRef} className="fx-canvas" />

      <div className="fx-hud">
        <span className="fx-hud-label">持ち玉</span>
        {/* key restarts only the number's bump, not the HUD's fever colour cycle */}
        <span key={hud.balls} className="fx-hud-balls fx-hud-bump">
          {String(hud.balls).padStart(6, '0')}
        </span>
        {hud.combo >= 2 ? <span className="fx-hud-combo">{hud.combo} 連チャン</span> : null}
      </div>

      {pops.map((p) => (
        <div key={p.id} className="fx-combo" style={{ left: p.x, top: p.y }}>
          {p.combo} 連
        </div>
      ))}

      {current ? (
        <div key={current.id} className={`fx-cutin fx-tone-${current.tone}`}>
          <div className="fx-cutin-text">{current.text}</div>
          {current.sub ? <div className="fx-cutin-sub">{current.sub}</div> : null}
        </div>
      ) : null}

      {flashId > 0 ? <div key={flashId} className="fx-flash" /> : null}

      {jackpot ? (
        <Jackpot
          balls={hud.balls}
          sound={sound}
          onFountain={() => particlesRef.current?.fountain(reducedMotion() ? 20 : 90)}
          onClose={() => setJackpot(false)}
        />
      ) : null}
    </div>
  );
}
