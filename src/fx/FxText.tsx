/**
 * Pachinko-style lettering: a dark extruded back, a bright rim, a gradient face and a
 * light sweep, stacked in one grid cell. Colours come from the tone's CSS variables.
 */
export function FxText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span className={`fx-text ${className}`}>
      <span className="fx-text-back" aria-hidden="true">
        {text}
      </span>
      <span className="fx-text-rim" aria-hidden="true">
        {text}
      </span>
      <span className="fx-text-face">{text}</span>
      <span className="fx-text-shine" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
