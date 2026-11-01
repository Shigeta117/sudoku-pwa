export interface CellDigit {
  index: number;
  digit: number;
}

export interface DojoExample {
  /** 81 values, 0 = empty */
  board: number[];
  /** Candidates per cell at this position (empty for filled cells) */
  candidates: number[][];
  type: 'value' | 'elimination';
  placements: CellDigit[];
  eliminations: CellDigit[];
  patternCells: number[];
  patternDigits: number[];
  regionCells: number[];
}

const loaders = import.meta.glob<{ default: unknown }>('../data/dojo/*.json');

const isCellIndex = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 81;
const isDigit = (n: unknown): n is number =>
  typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 9;
const indexList = (v: unknown): number[] => (Array.isArray(v) ? v.filter(isCellIndex) : []);

function parseExample(raw: unknown): DojoExample | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.board !== 'string' || !/^[0-9]{81}$/.test(r.board)) return null;
  if (!Array.isArray(r.candidates) || r.candidates.length !== 81) return null;
  if (r.type !== 'value' && r.type !== 'elimination') return null;
  if (!Array.isArray(r.updates)) return null;

  const candidates = r.candidates.map((c) =>
    typeof c === 'string' ? [...c].map(Number).filter(isDigit) : []
  );
  const placements: CellDigit[] = [];
  const eliminations: CellDigit[] = [];
  for (const u of r.updates) {
    if (!u || typeof u !== 'object') continue;
    const { index, filledValue, eliminatedCandidate } = u as Record<string, unknown>;
    if (!isCellIndex(index)) continue;
    if (isDigit(filledValue)) placements.push({ index, digit: filledValue });
    if (isDigit(eliminatedCandidate)) eliminations.push({ index, digit: eliminatedCandidate });
  }
  if (placements.length + eliminations.length === 0) return null;

  return {
    board: [...r.board].map(Number),
    candidates,
    type: r.type,
    placements,
    eliminations,
    patternCells: indexList(r.patternCells),
    patternDigits: Array.isArray(r.patternDigits) ? r.patternDigits.filter(isDigit) : [],
    regionCells: indexList(r.regionCells),
  };
}

export function parseDojoFile(raw: unknown): DojoExample[] {
  if (!raw || typeof raw !== 'object') return [];
  const examples = (raw as { examples?: unknown }).examples;
  if (!Array.isArray(examples)) return [];
  return examples.map(parseExample).filter((e): e is DojoExample => e !== null);
}

/** Lessons that have example data bundled with the app. */
export function hasDojoExamples(id: string): boolean {
  return `../data/dojo/${id}.json` in loaders;
}

export async function loadDojoExamples(id: string): Promise<DojoExample[]> {
  const load = loaders[`../data/dojo/${id}.json`];
  if (!load) return [];
  const mod = await load();
  return parseDojoFile(mod.default);
}

export const cellDigitKey = (index: number, digit: number): string => `${index}:${digit}`;

export interface EliminationJudgement {
  correct: boolean;
  /** Answer marks the player did not pick */
  missing: number;
  /** Picks that are not part of the answer */
  extra: number;
}

export function judgeEliminations(
  example: DojoExample,
  picked: ReadonlySet<string>
): EliminationJudgement {
  const answer = new Set(example.eliminations.map((e) => cellDigitKey(e.index, e.digit)));
  let missing = 0;
  for (const key of answer) if (!picked.has(key)) missing++;
  let extra = 0;
  for (const key of picked) if (!answer.has(key)) extra++;
  return { correct: missing === 0 && extra === 0, missing, extra };
}

export function judgePlacement(example: DojoExample, index: number, digit: number): boolean {
  return example.placements.some((p) => p.index === index && p.digit === digit);
}

/** Human-readable position, counted from the top-left like the board labels. */
export function cellLabel(index: number): string {
  return `${Math.floor(index / 9) + 1}行${(index % 9) + 1}列`;
}
