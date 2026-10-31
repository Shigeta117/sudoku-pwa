import {
  Difficulty,
  SavedGameState,
  StatsRecord,
  UserSettings,
} from '../types/sudoku';

const GAME_STATE_KEY = 'zen_sudoku_saved_game_v1';
const STATS_KEY = 'zen_sudoku_stats_v1';
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
};

export function loadSavedGame(): SavedGameState | null {
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedGameState;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.board)) {
      return null;
    }
    return parsed;
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
    const parsed = JSON.parse(raw);
    return {
      easy: { ...DEFAULT_STATS.easy, ...(parsed.easy || {}) },
      medium: { ...DEFAULT_STATS.medium, ...(parsed.medium || {}) },
      hard: { ...DEFAULT_STATS.hard, ...(parsed.hard || {}) },
      expert: { ...DEFAULT_STATS.expert, ...(parsed.expert || {}) },
    };
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
