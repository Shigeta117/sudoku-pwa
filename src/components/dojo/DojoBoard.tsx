import { DojoExample, cellDigitKey } from '../../utils/dojoData';

/** What the board reveals: the bare position, the pattern only, or the full answer. */
export type DojoReveal = 'none' | 'pattern' | 'answer';

interface DojoBoardProps {
  example: DojoExample;
  reveal: DojoReveal;
  selectedCell: number | null;
  /** Candidates the player marked for elimination (cellDigitKey) */
  picked: ReadonlySet<string>;
  onCellTap: (index: number) => void;
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function DojoBoard({ example, reveal, selectedCell, picked, onCellTap }: DojoBoardProps) {
  const showPattern = reveal !== 'none';
  const showAnswer = reveal === 'answer';
  const pattern = new Set(example.patternCells);
  const region = new Set(example.regionCells);
  // Single-digit patterns (fish, skyscraper, kite) carry no pattern digits; their digit is the eliminated one.
  // For wings this only lights the wing cells that hold it; the green background still marks every pattern cell.
  const patternDigits = new Set(
    example.patternDigits.length > 0
      ? example.patternDigits
      : example.eliminations.map((e) => e.digit)
  );
  const eliminated = new Set(example.eliminations.map((e) => cellDigitKey(e.index, e.digit)));
  const placed = new Map(example.placements.map((p) => [p.index, p.digit]));

  return (
    <div
      className="w-full aspect-square grid grid-cols-9 grid-rows-9 bg-white dark:bg-slate-900 rounded-xl border-2 border-slate-800 dark:border-slate-600 overflow-hidden"
      role="group"
      aria-label="例題の盤面"
    >
      {example.board.map((value, index) => {
        const row = Math.floor(index / 9);
        const col = index % 9;
        const borderRight =
          col === 2 || col === 5
            ? 'border-r-2 border-r-slate-800 dark:border-r-slate-500'
            : col < 8
            ? 'border-r border-r-slate-200 dark:border-r-slate-800'
            : '';
        const borderBottom =
          row === 2 || row === 5
            ? 'border-b-2 border-b-slate-800 dark:border-b-slate-500'
            : row < 8
            ? 'border-b border-b-slate-200 dark:border-b-slate-800'
            : '';

        let bg = 'bg-white dark:bg-slate-900';
        if (selectedCell === index) bg = 'bg-indigo-500/25 dark:bg-indigo-500/35';
        else if (showPattern && pattern.has(index)) bg = 'bg-emerald-200/80 dark:bg-emerald-800/50';
        else if (showPattern && region.has(index)) bg = 'bg-amber-100/80 dark:bg-amber-900/30';

        const answerDigit = showAnswer ? placed.get(index) : undefined;
        const candidateText = (example.candidates[index] ?? [])
          .map((d) => (picked.has(cellDigitKey(index, d)) ? `${d}（消す）` : String(d)))
          .join(' ');
        const label = value
          ? `${row + 1}行${col + 1}列 ${value}`
          : `${row + 1}行${col + 1}列 空き 候補 ${candidateText}${
              selectedCell === index ? ' 選択中' : ''
            }`;

        return (
          <button
            key={index}
            type="button"
            aria-label={label}
            onClick={() => onCellTap(index)}
            className={`relative flex items-center justify-center p-0 focus:outline-none ${borderRight} ${borderBottom} ${bg}`}
          >
            {value !== 0 ? (
              <span className="text-[clamp(1rem,4.2vw,1.5rem)] leading-none font-bold text-slate-900 dark:text-slate-100">
                {value}
              </span>
            ) : answerDigit !== undefined ? (
              <span className="text-[clamp(1rem,4.2vw,1.5rem)] leading-none font-bold text-amber-600 dark:text-amber-400">
                {answerDigit}
              </span>
            ) : (
              <div className="w-full h-full grid grid-cols-3 grid-rows-3 p-[1px] pointer-events-none">
                {DIGITS.map((d) => {
                  const present = example.candidates[index]?.includes(d);
                  const key = cellDigitKey(index, d);
                  const isEliminated = showAnswer && eliminated.has(key);
                  const isPicked = !showAnswer && picked.has(key);
                  const isPatternDigit = showPattern && pattern.has(index) && patternDigits.has(d);
                  let cls = 'text-slate-500 dark:text-slate-400';
                  if (isEliminated || isPicked) {
                    cls = 'text-rose-600 dark:text-rose-400 font-bold line-through bg-rose-200/70 dark:bg-rose-900/60 rounded-sm';
                  } else if (isPatternDigit) {
                    cls = 'text-emerald-700 dark:text-emerald-300 font-bold';
                  }
                  return (
                    <span
                      key={d}
                      className={`flex items-center justify-center text-[clamp(0.5rem,2.1vw,0.72rem)] leading-none ${cls}`}
                    >
                      {present ? d : ''}
                    </span>
                  );
                })}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
