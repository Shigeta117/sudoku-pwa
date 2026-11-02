import { CSSProperties, useEffect, useRef } from 'react';
import { FxText } from './FxText';
import { FlameTone, playFlames } from './flames';

export const MAJOR_CUTIN_MS = 1600;
export const MINOR_CUTIN_MS = 1000;

interface LogoCutInProps {
  text: string;
  sub?: string;
  tone: FlameTone;
  src: string;
  /** Big moments take over the screen (dim, flames, rays); minor ones only pop the logo */
  major: boolean;
  reducedMotion: boolean;
}

/** A pre-rendered 3D logo slammed onto the screen, with a light sweep clipped to its shape. */
export function LogoCutIn({ text, sub, tone, src, major, reducedMotion }: LogoCutInProps) {
  const flamesRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!major || reducedMotion || !flamesRef.current) return;
    return playFlames(flamesRef.current, tone, MAJOR_CUTIN_MS) ?? undefined;
    // one burst per mounted cut-in
  }, []);

  // Absolute: a url() inside a custom property resolves against the stylesheet using it (assets/)
  const logoStyle = { '--logo': `url("${new URL(src, document.baseURI).href}")` } as CSSProperties;

  return (
    <div className={`fx-logo-cutin ${major ? 'fx-logo-major' : 'fx-logo-minor'} fx-tone-${tone}`}>
      {major ? (
        <>
          <div className="fx-takeover-dim" />
          <canvas ref={flamesRef} className="fx-flames" />
          <div className="fx-rays" />
        </>
      ) : null}
      <div className="fx-logo" style={logoStyle}>
        <img src={src} alt={text} draggable={false} />
        <div className="fx-logo-shine" />
      </div>
      {sub ? <FxText text={sub} className="fx-logo-sub fx-text-sm" /> : null}
    </div>
  );
}
