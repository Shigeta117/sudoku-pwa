export type Difficulty = 'easy' | 'medium' | 'hard' | 'expert' | 'master' | 'extreme';

export const DIFFICULTIES: readonly Difficulty[] = [
  'easy',
  'medium',
  'hard',
  'expert',
  'master',
  'extreme',
];

export type InputMethod = 'cell-first' | 'number-first';

export type ThemePreference = 'system' | 'light' | 'dark';

export interface CellData {
  row: number;
  col: number;
  value: number; // 0 if empty, 1-9 otherwise
  solution: number; // 1-9
  given: boolean; // true if initial clue
  notes: number[]; // sorted array of candidate numbers 1-9
  isError?: boolean;
}

export type BoardSnapshot = {
  values: number[][];
  notes: number[][][]; // 9x9 array of note arrays
};

export interface DifficultyStats {
  gamesPlayed: number;
  gamesWon: number;
  bestTimeSeconds: number | null;
  totalTimeSeconds: number;
}

export type StatsRecord = Record<Difficulty, DifficultyStats>;

export interface UserSettings {
  theme: ThemePreference;
  autoRemoveNotes: boolean;
  highlightSameNumbers: boolean;
  highlightPeerAreas: boolean;
  highlightConflicts: boolean;
  vibrationEnabled: boolean;
  defaultInputMethod: InputMethod;
  /** ドパガキモード: pachinko-style effects layer */
  fxMode: boolean;
  fxSound: boolean;
}

/** A game that is not a plain difficulty: it skips the stats and shows its own label. */
export interface GameChallenge {
  kind: 'seventeen' | 'practice';
  /** seventeen: 'normal' | 'hard'; practice: the sudoku-core strategy */
  key: string;
  label: string;
}

export interface SavedGameState {
  version: number;
  difficulty: Difficulty;
  board: CellData[][];
  history: BoardSnapshot[];
  historyIndex: number;
  elapsedSeconds: number;
  mistakes: number;
  hintsUsed?: number;
  isCompleted: boolean;
  lastUpdatedAt: number;
  challenge?: GameChallenge;
}
