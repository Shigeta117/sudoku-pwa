import { useEffect, useState } from 'react';
import { playJackpot, playReelStop } from './fxAudio';

const STRIP = ['7', '3', '5', '1', '9', '7'];
const STOP_AT_MS = [700, 1150, 1600];
const AUTO_CLOSE_MS = 5200;

interface JackpotProps {
  balls: number;
  sound: boolean;
  onFountain: () => void;
  onClose: () => void;
}

/** 7-7-7 reels, then 大当たり with coin fountains. Tap anywhere to close. */
export function Jackpot({ balls, sound, onFountain, onClose }: JackpotProps) {
  const [stopped, setStopped] = useState(0);

  useEffect(() => {
    const timers = STOP_AT_MS.map((ms, i) =>
      window.setTimeout(() => {
        setStopped(i + 1);
        if (sound) playReelStop();
        if (i === STOP_AT_MS.length - 1) {
          if (sound) playJackpot();
          onFountain();
        }
      }, ms)
    );
    const more = [2300, 3000].map((ms) => window.setTimeout(onFountain, ms));
    const close = window.setTimeout(onClose, AUTO_CLOSE_MS);
    return () => [...timers, ...more, close].forEach((t) => window.clearTimeout(t));
    // Runs once per jackpot: a new render of the layer must not restart the reels
  }, []);

  const done = stopped === STOP_AT_MS.length;

  return (
    <div className="fx-jackpot" role="presentation" onClick={onClose}>
      <div className="fx-reels" aria-hidden="true">
        {STOP_AT_MS.map((_, i) => (
          <div key={i} className={`fx-reel ${stopped > i ? 'fx-reel-stop' : 'fx-reel-spin'}`}>
            <div className="fx-reel-strip">
              {(stopped > i ? ['7'] : STRIP).map((d, k) => (
                <span key={k}>{d}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      {done ? (
        <>
          <div className="fx-jackpot-title">大当たり</div>
          <div className="fx-jackpot-balls">持ち玉 {balls.toLocaleString()} 玉</div>
        </>
      ) : null}
      <div className="fx-jackpot-hint">タップで閉じる</div>
    </div>
  );
}
