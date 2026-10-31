import {
  BoardSnapshot,
  CellData,
  DIFFICULTIES,
  Difficulty,
  SavedGameState,
  StatsRecord,
  UserSettings,
} from '../types/sudoku';

const GAME_STATE_KEY = 'zen_sudoku_saved_game_v1';
// v2: difficulty is rated by technique (sudoku-core) since 2026-10, so v1 best times are not comparable
const STATS_KEY = 'zen_sudoku_stats_v2';
const SETTINGS_KEY = 'zen_sudoku_settings_v1';

export const DEFAULT_SETTINGS: UserSettings = {
  theme: 'system',
  autoRemoveNotes: true,
  highlightSameNumbers: true,
  highlightPeerAreas: true,
  highlightConflicts: true,
  vibrationEnabled: true,
  defaultInputMethod: 'cell-first',
};

export const DEFAULT_STATS: StatsRecord = {
  easy: { gamesPlayed: 0, gamesWon: 0, bestTimeSeconds: null, totalTimeSeconds: 0 },
  medium: { gamesPlayed: 0, gamesWon: 0, bestTimeSeconds: null, totalTimeSeconds: 0 },
  hard: { gamesPlayed: 0, gamesWon: 0, bestTimeSeconds: null, totalTimeSeconds: 0 },
  expert: { gamesPlayed: 0, gamesWon: 0, bestTimeSeconds: null, totalTimeSeconds: 0 },
  master: { gamesPlayed: 0, gamesWon: 0, bestTimeSeconds: null, totalTimeSeconds: 0 },
};

const isDigit = (v: unknown, min: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= 9;

const isNotes = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((n) => isDigit(n, 1));

function isNineByNine<T>(v: unknown, isItem: (x: unknown) => x is T): v is T[][] {
  return (
    Array.isArray(v) &&
    v.length === 9 &&
    v.every((row) => Array.isArray(row) && row.length === 9 && row.every(isItem))
  );
}

function isCell(v: unknown): v is CellData {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    isDigit(c.value, 0) &&
    isDigit(c.solution, 1) &&
    typeof c.given === 'boolean' &&
    isNotes(c.notes)
  );
}

function isSnapshot(v: unknown): v is BoardSnapshot {
  if (!v || typeof v !== 'object') return false;
  const s = v as Record<string, unknown>;
  return (
    isNineByNine(s.values, (x): x is number => isDigit(x, 0)) &&
    isNineByNine(s.notes, isNotes)
  );
}

/**
 * Validate a saved game read from localStorage. Anything malformed is
 * discarded (a new game starts) instead of crashing the app on every reload.
 */
export function parseSavedGame(raw: unknown): SavedGameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (s.version !== 1) return null;
  if (!DIFFICULTIES.includes(s.difficulty as Difficulty)) return null;
  if (!isNineByNine(s.board, isCell)) return null;
  const history =
    Array.isArray(s.history) && s.history.every(isSnapshot)
      ? (s.history as BoardSnapshot[])
      : [];
  const rawIndex = typeof s.historyIndex === 'number' ? s.historyIndex : 0;
  const historyIndex =
    history.length === 0 ? 0 : Math.min(Math.max(0, Math.floor(rawIndex)), history.length - 1);
  const num = (v: unknown) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;

  return {
    version: 1,
    difficulty: s.difficulty as Difficulty,
    board: s.board,
    history,
    historyIndex,
    elapsedSeconds: num(s.elapsedSeconds),
    mistakes: num(s.mistakes),
    hintsUsed: num(s.hintsUsed),
    isCompleted: s.isCompleted === true,
    lastUpdatedAt: num(s.lastUpdatedAt),
  };
}

export function loadSavedGame(): SavedGameState | null {
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (!raw) return null;
    return parseSavedGame(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGameState(state: SavedGameState): void {
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private browsing errors
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(GAME_STATE_KEY);
  } catch {
    // Ignore
  }
}

export function loadStats(): StatsRecord {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return DEFAULT_STATS;
    const parsed = JSON.parse(raw) ?? {};
    const merged = { ...DEFAULT_STATS };
    for (const d of DIFFICULTIES) {
      merged[d] = { ...DEFAULT_STATS[d], ...(parsed[d] || {}) };
    }
    return merged;
  } catch {
    return DEFAULT_STATS;
  }
}

export function saveStats(stats: StatsRecord): void {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Ignore
  }
}

export function recordGameStart(difficulty: Difficulty): StatsRecord {
  const current = loadStats();
  const diffStats = current[difficulty];
  const updated: StatsRecord = {
    ...current,
    [difficulty]: {
      ...diffStats,
      gamesPlayed: diffStats.gamesPlayed + 1,
    },
  };
  saveStats(updated);
  return updated;
}

export function recordGameWin(
  difficulty: Difficulty,
  elapsedSeconds: number
): { stats: StatsRecord; isNewBest: boolean } {
  const current = loadStats();
  const diffStats = current[difficulty];
  const isNewBest =
    diffStats.bestTimeSeconds === null ||
    elapsedSeconds < diffStats.bestTimeSeconds;

  const updated: StatsRecord = {
    ...current,
    [difficulty]: {
      gamesPlayed: Math.max(diffStats.gamesPlayed, diffStats.gamesWon + 1),
      gamesWon: diffStats.gamesWon + 1,
      bestTimeSeconds: isNewBest ? elapsedSeconds : diffStats.bestTimeSeconds,
      totalTimeSeconds: diffStats.totalTimeSeconds + elapsedSeconds,
    },
  };
  saveStats(updated);
  return { stats: updated, isNewBest };
}

export function loadSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

export function formatTime(seconds: number | null): string {
  if (seconds === null || seconds < 0) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function triggerHaptic(
  enabled: boolean,
  pattern: number | number[] = 10
): void {
  if (!enabled) return;
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore unsupported devices
  }
}
