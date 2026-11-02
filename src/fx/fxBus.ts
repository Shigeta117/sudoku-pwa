/**
 * Game events for the effects mode. The game always emits; nothing listens unless the
 * effects layer is mounted, so the normal mode pays nothing.
 */
export type FxEvent =
  | { type: 'start' }
  | { type: 'place'; row: number; col: number }
  | { type: 'miss'; row: number; col: number }
  /** Units completed by the last move: 'row-3', 'col-0', 'box-1-2' */
  | { type: 'units'; units: string[] }
  /** Cells still not holding their solution */
  | { type: 'remaining'; count: number }
  | { type: 'win' };

type Listener = (event: FxEvent) => void;

const listeners = new Set<Listener>();

export function emitFx(event: FxEvent): void {
  listeners.forEach((listener) => listener(event));
}

export function subscribeFx(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
