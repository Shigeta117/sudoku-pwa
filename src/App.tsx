import React, { Suspense, lazy, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Eraser,
  Pencil,
  BarChart2,
  Settings,
  GraduationCap,
  Sparkles,
  Check,
  Sun,
  Moon,
  Monitor,
  Trophy,
  Grid,
  Hash,
  Lightbulb,
  X,
} from 'lucide-react';
import {
  BoardSnapshot,
  CellData,
  DIFFICULTIES,
  Difficulty,
  GameChallenge,
  InputMethod,
  SavedGameState,
  StatsRecord,
  ThemePreference,
  UserSettings,
} from './types/sudoku';
import {
  DIFFICULTY_CONFIG,
  buildInitialBoard,
  evaluateBoardErrors,
  getDigitCounts,
  isBoardSolved,
} from './utils/sudokuEngine';
import { generatePuzzleAsync, prefetchPuzzle } from './utils/puzzleWorkerClient';
import { SEVENTEEN_BANDS, pickChallengePuzzle } from './utils/puzzlePool';
import { pushHistory } from './utils/history';
import { HintResult, findHint } from './utils/hint';
import { DojoErrorBoundary } from './components/dojo/DojoErrorBoundary';
import {
  DEFAULT_STATS,
  formatTime,
  loadSavedGame,
  loadSettings,
  loadStats,
  recordGameStart,
  recordGameWin,
  saveGameState,
  saveSettings,
  saveStats,
  triggerHaptic,
} from './utils/storage';

const DojoView = lazy(() => import('./components/dojo/DojoView'));

function createSnapshot(board: CellData[][]): BoardSnapshot {
  return {
    values: board.map((row) => row.map((c) => c.value)),
    notes: board.map((row) => row.map((c) => [...c.notes])),
  };
}

function applySnapshot(board: CellData[][], snapshot: BoardSnapshot): CellData[][] {
  const updated = board.map((row, r) =>
    row.map((cell, c) => ({
      ...cell,
      value: snapshot.values[r][c],
      notes: [...snapshot.notes[r][c]],
    }))
  );
  return evaluateBoardErrors(updated);
}

/** Check which rows, cols, or 3x3 boxes are completely and correctly filled */
function getCompletedUnits(board: CellData[][]): Set<string> {
  const units = new Set<string>();
  if (board.length !== 9) return units;

  for (let r = 0; r < 9; r++) {
    if (board[r].every((c) => c.value !== 0 && c.value === c.solution)) {
      units.add(`row-${r}`);
    }
  }
  for (let c = 0; c < 9; c++) {
    let ok = true;
    for (let r = 0; r < 9; r++) {
      if (board[r][c].value === 0 || board[r][c].value !== board[r][c].solution) {
        ok = false;
        break;
      }
    }
    if (ok) units.add(`col-${c}`);
  }
  for (let br = 0; br < 3; br++) {
    for (let bc = 0; bc < 3; bc++) {
      let ok = true;
      for (let r = br * 3; r < br * 3 + 3; r++) {
        for (let c = bc * 3; c < bc * 3 + 3; c++) {
          if (board[r][c].value === 0 || board[r][c].value !== board[r][c].solution) {
            ok = false;
            break;
          }
        }
      }
      if (ok) units.add(`box-${br}-${bc}`);
    }
  }
  return units;
}

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(() => loadSettings());
  const [stats, setStats] = useState<StatsRecord>(() => loadStats());

  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  // 17-clue / technique practice games: not counted in the stats, labelled by the challenge
  const [challenge, setChallenge] = useState<GameChallenge | null>(null);
  const [board, setBoard] = useState<CellData[][]>([]);
  const [history, setHistory] = useState<BoardSnapshot[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [activeNumber, setActiveNumber] = useState<number | null>(null);
  const [inputMethod, setInputMethod] = useState<InputMethod>(
    () => loadSettings().defaultInputMethod
  );
  const [isNoteMode, setIsNoteMode] = useState<boolean>(false);

  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [mistakes, setMistakes] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [isNewBestTime, setIsNewBestTime] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  // Only the latest requested puzzle may be applied (older workers can finish later)
  const generationIdRef = useRef(0);

  // Hint is tied to the board it was computed for; any move invalidates it
  const [hintState, setHintState] = useState<{
    board: CellData[][];
    result: HintResult;
    revealed: boolean;
  } | null>(null);
  const [hintsUsed, setHintsUsed] = useState<number>(0);
  const [showVictoryModal, setShowVictoryModal] = useState<boolean>(false);

  // Modals
  const [showNewGameModal, setShowNewGameModal] = useState<boolean>(false);
  const [showStatsModal, setShowStatsModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  // Technique dojo: null = closed, otherwise the lesson to open (null id = lesson list)
  const [dojo, setDojo] = useState<{ lessonId: string | null } | null>(null);

  // Subtle animation states
  const [lastPlacedCell, setLastPlacedCell] = useState<string | null>(null);
  const [flashingCells, setFlashingCells] = useState<Set<string>>(new Set());
  const prevUnitsRef = useRef<Set<string>>(new Set());

  // Apply Dark / Light theme class to document.documentElement
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark =
        settings.theme === 'dark' ||
        (settings.theme === 'system' && mediaQuery.matches);
      root.classList.toggle('dark', isDark);
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  // Save user settings whenever modified
  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  // Start a fresh puzzle of the specified difficulty, or of a challenge (17-clue / practice)
  const startNewGame = useCallback(
    async (requestedDifficulty: Difficulty, nextChallenge?: GameChallenge) => {
      const generationId = ++generationIdRef.current;
      setIsGenerating(true);
      setShowNewGameModal(false);
      setShowVictoryModal(false);
      setStatusMessage(null);

      let generated;
      let targetDifficulty = requestedDifficulty;
      let activeChallenge = nextChallenge;
      let fellBack = false;
      if (activeChallenge) {
        try {
          const picked = await pickChallengePuzzle(activeChallenge);
          generated = picked;
          targetDifficulty = picked.difficulty;
        } catch {
          // Pool missing or renamed technique: play a normal puzzle instead of an empty board
          activeChallenge = undefined;
          fellBack = true;
        }
      }
      try {
        generated ??= await generatePuzzleAsync(targetDifficulty);
      } catch {
        if (generationId !== generationIdRef.current) return;
        setIsGenerating(false);
        setStatusMessage('パズルの生成に失敗しました。もう一度お試しください');
        return;
      }
      // A newer request was made while this one was running: drop this result
      if (generationId !== generationIdRef.current) return;

      const initialBoard = buildInitialBoard(generated.puzzle, generated.solution);
      setDifficulty(targetDifficulty);
      setChallenge(activeChallenge ?? null);
      if (fellBack) setStatusMessage('特別な問題を読み込めなかったので、通常の問題を出しました');
      setBoard(initialBoard);
      setHistory([createSnapshot(initialBoard)]);
      setHistoryIndex(0);
      setElapsedSeconds(0);
      setMistakes(0);
      setHintsUsed(0);
      setHintState(null);
      setSelectedCell(null);
      setActiveNumber(null);
      setIsPaused(false);
      setIsCompleted(false);
      setIsNewBestTime(false);
      prevUnitsRef.current = getCompletedUnits(initialBoard);
      setIsGenerating(false);

      if (activeChallenge) return;
      const updatedStats = recordGameStart(targetDifficulty);
      setStats(updatedStats);
      prefetchPuzzle(targetDifficulty);
    },
    []
  );

  // Initial load: restore from localStorage or generate a new game
  useEffect(() => {
    const saved = loadSavedGame();
    if (saved && !saved.isCompleted) {
      setDifficulty(saved.difficulty);
      setChallenge(saved.challenge ?? null);
      setBoard(evaluateBoardErrors(saved.board));
      setHistory(
        saved.history.length > 0 ? saved.history : [createSnapshot(saved.board)]
      );
      setHistoryIndex(saved.history.length > 0 ? saved.historyIndex : 0);
      setElapsedSeconds(saved.elapsedSeconds);
      setMistakes(saved.mistakes);
      setHintsUsed(saved.hintsUsed ?? 0);
      setIsCompleted(false);
      prevUnitsRef.current = getCompletedUnits(saved.board);
      setIsGenerating(false);
      if (!saved.challenge) prefetchPuzzle(saved.difficulty);
    } else {
      startNewGame(saved?.difficulty ?? 'easy', saved?.challenge);
    }
  }, [startNewGame]);

  // Persist game state on every change
  // Latest savable state; declared before the save effects so it is current when they run
  const latestSaveRef = useRef<SavedGameState | null>(null);
  useEffect(() => {
    latestSaveRef.current =
      isGenerating || board.length !== 9
        ? null
        : {
            version: 1,
            difficulty,
            board,
            history,
            historyIndex,
            elapsedSeconds,
            mistakes,
            hintsUsed,
            isCompleted,
            lastUpdatedAt: Date.now(),
            ...(challenge ? { challenge } : {}),
          };
  }, [
    board,
    challenge,
    difficulty,
    elapsedSeconds,
    hintsUsed,
    history,
    historyIndex,
    isCompleted,
    isGenerating,
    mistakes,
  ]);

  const flushSave = useCallback(() => {
    if (latestSaveRef.current) saveGameState(latestSaveRef.current);
  }, []);

  // Save on every move, but not on every timer tick (the history can be large)
  useEffect(() => {
    flushSave();
  }, [board, challenge, difficulty, hintsUsed, history, historyIndex, isCompleted, isGenerating, mistakes, flushSave]);

  // Elapsed time: every 10 s, and whenever the page is hidden or closed
  useEffect(() => {
    if (elapsedSeconds > 0 && elapsedSeconds % 10 === 0) flushSave();
  }, [elapsedSeconds, flushSave]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushSave();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flushSave);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flushSave);
    };
  }, [flushSave]);

  // Game timer (pauses automatically when modal open, tab hidden, paused, or completed)
  useEffect(() => {
    if (
      isGenerating ||
      isPaused ||
      isCompleted ||
      showNewGameModal ||
      showStatsModal ||
      showSettingsModal ||
      dojo !== null
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setElapsedSeconds((prev) => prev + 1);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [
    isGenerating,
    isPaused,
    isCompleted,
    showNewGameModal,
    showStatsModal,
    showSettingsModal,
    dojo,
  ]);

  // Count how many of each digit (1-9) are completed on the board
  const digitCounts = useMemo(() => getDigitCounts(board), [board]);

  const activeHint = hintState && hintState.board === board ? hintState : null;

  // Check unit completion animations and game victory
  const handlePostMoveEffects = useCallback(
    (nextBoard: CellData[][], r: number, c: number) => {
      setLastPlacedCell(`${r}-${c}`);
      window.setTimeout(() => setLastPlacedCell(null), 220);

      const newUnits = getCompletedUnits(nextBoard);
      const newlyCompleted: string[] = [];
      newUnits.forEach((u) => {
        if (!prevUnitsRef.current.has(u)) newlyCompleted.push(u);
      });
      prevUnitsRef.current = newUnits;

      if (newlyCompleted.length > 0) {
        const flashSet = new Set<string>();
        newlyCompleted.forEach((unit) => {
          const parts = unit.split('-');
          if (parts[0] === 'row') {
            const rowIdx = Number(parts[1]);
            for (let cc = 0; cc < 9; cc++) flashSet.add(`${rowIdx}-${cc}`);
          } else if (parts[0] === 'col') {
            const colIdx = Number(parts[1]);
            for (let rr = 0; rr < 9; rr++) flashSet.add(`${rr}-${colIdx}`);
          } else if (parts[0] === 'box') {
            const br = Number(parts[1]) * 3;
            const bc = Number(parts[2]) * 3;
            for (let rr = br; rr < br + 3; rr++) {
              for (let cc = bc; cc < bc + 3; cc++) flashSet.add(`${rr}-${cc}`);
            }
          }
        });
        setFlashingCells(flashSet);
        triggerHaptic(settings.vibrationEnabled, [15, 40, 20]);
        window.setTimeout(() => setFlashingCells(new Set()), 650);
      }

      if (isBoardSolved(nextBoard)) {
        setIsCompleted(true);
        setShowVictoryModal(true);
        triggerHaptic(settings.vibrationEnabled, [30, 50, 30, 50, 60]);
        if (!challenge) {
          const { stats: updatedStats, isNewBest } = recordGameWin(
            difficulty,
            elapsedSeconds
          );
          setStats(updatedStats);
          setIsNewBestTime(isNewBest);
        }
      }
    },
    [challenge, difficulty, elapsedSeconds, settings.vibrationEnabled]
  );

  // Core function to apply a digit or note to cell (r, c)
  const applyInputToCell = useCallback(
    (r: number, c: number, num: number) => {
      if (isPaused || isCompleted || isGenerating) return;
      const target = board[r]?.[c];
      if (!target || target.given) return;

      // A correct digit is final: neither a digit nor a note may overwrite it (erase still can)
      if (target.value === target.solution) return;

      const nextBoard = board.map((row) =>
        row.map((cell) => ({ ...cell, notes: [...cell.notes] }))
      );
      const cell = nextBoard[r][c];

      if (isNoteMode) {
        // Taking notes on a wrong digit replaces it
        if (cell.value !== 0) {
          cell.value = 0;
        }
        if (cell.notes.includes(num)) {
          cell.notes = cell.notes.filter((n) => n !== num);
        } else {
          cell.notes = [...cell.notes, num].sort((a, b) => a - b);
        }
        triggerHaptic(settings.vibrationEnabled, 8);
      } else {
        // Normal number placement toggle
        if (cell.value === num) {
          cell.value = 0;
          triggerHaptic(settings.vibrationEnabled, 8);
        } else {
          cell.value = num;
          cell.notes = [];

          if (num !== cell.solution) {
            setMistakes((m) => m + 1);
            triggerHaptic(settings.vibrationEnabled, [25, 40, 25]);
          } else {
            triggerHaptic(settings.vibrationEnabled, 12);
            // Auto remove candidate notes in same row, column, and 3x3 block
            if (settings.autoRemoveNotes) {
              const startR = Math.floor(r / 3) * 3;
              const startC = Math.floor(c / 3) * 3;
              for (let i = 0; i < 9; i++) {
                nextBoard[r][i].notes = nextBoard[r][i].notes.filter(
                  (n) => n !== num
                );
                nextBoard[i][c].notes = nextBoard[i][c].notes.filter(
                  (n) => n !== num
                );
              }
              for (let rr = startR; rr < startR + 3; rr++) {
                for (let cc = startC; cc < startC + 3; cc++) {
                  nextBoard[rr][cc].notes = nextBoard[rr][cc].notes.filter(
                    (n) => n !== num
                  );
                }
              }
            }
          }
        }
      }

      const evaluated = evaluateBoardErrors(nextBoard);
      const pushed = pushHistory(history, historyIndex, createSnapshot(evaluated));

      setBoard(evaluated);
      setHistory(pushed.history);
      setHistoryIndex(pushed.index);

      if (!isNoteMode && evaluated[r][c].value !== 0) {
        handlePostMoveEffects(evaluated, r, c);
      }
    },
    [
      board,
      handlePostMoveEffects,
      history,
      historyIndex,
      isCompleted,
      isGenerating,
      isNoteMode,
      isPaused,
      settings.autoRemoveNotes,
      settings.vibrationEnabled,
    ]
  );

  // Erase cell value & notes
  const handleErase = useCallback(() => {
    if (isPaused || isCompleted || isGenerating || !selectedCell) return;
    const [r, c] = selectedCell;
    const target = board[r]?.[c];
    if (!target || target.given) return;
    if (target.value === 0 && target.notes.length === 0) return;
    // Any non-given cell can be cleared, including a correct digit
    const nextBoard = board.map((row) =>
      row.map((cell) => ({ ...cell, notes: [...cell.notes] }))
    );
    nextBoard[r][c].value = 0;
    nextBoard[r][c].notes = [];

    const evaluated = evaluateBoardErrors(nextBoard);
    const pushed = pushHistory(history, historyIndex, createSnapshot(evaluated));

    setBoard(evaluated);
    setHistory(pushed.history);
    setHistoryIndex(pushed.index);
    prevUnitsRef.current = getCompletedUnits(evaluated);
    triggerHaptic(settings.vibrationEnabled, 10);
  }, [
    board,
    history,
    historyIndex,
    isCompleted,
    isGenerating,
    isPaused,
    selectedCell,
    settings.vibrationEnabled,
  ]);

  // Undo
  const handleUndo = useCallback(() => {
    if (isPaused || isCompleted || isGenerating || historyIndex <= 0) return;
    const targetIndex = historyIndex - 1;
    const restored = applySnapshot(board, history[targetIndex]);
    setBoard(restored);
    setHistoryIndex(targetIndex);
    prevUnitsRef.current = getCompletedUnits(restored);
    triggerHaptic(settings.vibrationEnabled, 8);
  }, [
    board,
    history,
    historyIndex,
    isCompleted,
    isGenerating,
    isPaused,
    settings.vibrationEnabled,
  ]);

  // Redo
  const handleRedo = useCallback(() => {
    if (isPaused || isCompleted || isGenerating || historyIndex >= history.length - 1) return;
    const targetIndex = historyIndex + 1;
    const restored = applySnapshot(board, history[targetIndex]);
    setBoard(restored);
    setHistoryIndex(targetIndex);
    prevUnitsRef.current = getCompletedUnits(restored);
    triggerHaptic(settings.vibrationEnabled, 8);
  }, [
    board,
    history,
    historyIndex,
    isCompleted,
    isGenerating,
    isPaused,
    settings.vibrationEnabled,
  ]);

  // Handle tapping a cell on the 9x9 board
  const handleCellTap = useCallback(
    (r: number, c: number) => {
      if (isPaused || isCompleted || isGenerating) return;
      const tappedCell = board[r]?.[c];
      if (!tappedCell) return;

      setSelectedCell([r, c]);

      if (inputMethod === 'number-first' && activeNumber !== null) {
        if (!tappedCell.given && tappedCell.value !== tappedCell.solution) {
          applyInputToCell(r, c, activeNumber);
          return;
        }
      }

      // In number-first mode the locked digit must not change by tapping a filled cell
      if (tappedCell.value !== 0 && inputMethod === 'cell-first') {
        setActiveNumber(tappedCell.value);
      }
      triggerHaptic(settings.vibrationEnabled, 5);
    },
    [
      activeNumber,
      applyInputToCell,
      board,
      inputMethod,
      isCompleted,
      isGenerating,
      isPaused,
      settings.vibrationEnabled,
    ]
  );

  // Hint: 1st press shows the cell and the technique, 2nd press on the same board reveals the digit
  const handleHint = useCallback(() => {
    if (isPaused || isCompleted || isGenerating || board.length !== 9) return;
    if (activeHint) {
      if (activeHint.result.kind === 'step' && !activeHint.revealed) {
        setHintState({ ...activeHint, revealed: true });
      }
      return;
    }
    const result = findHint(board);
    setHintState({ board, result, revealed: false });
    if (result.kind === 'step') {
      setHintsUsed((n) => n + 1);
      setSelectedCell(result.cell);
    }
    triggerHaptic(settings.vibrationEnabled, 8);
  }, [activeHint, board, isCompleted, isGenerating, isPaused, settings.vibrationEnabled]);

  // Handle tapping a digit (1-9) on the bottom keypad
  const handleNumberTap = useCallback(
    (num: number) => {
      if (isPaused || isCompleted || isGenerating) return;

      if (inputMethod === 'number-first') {
        setActiveNumber((prev) => (prev === num ? null : num));
        triggerHaptic(settings.vibrationEnabled, 8);
        return;
      }

      // Cell-first mode
      setActiveNumber(num);
      if (selectedCell) {
        const [r, c] = selectedCell;
        applyInputToCell(r, c, num);
      } else {
        triggerHaptic(settings.vibrationEnabled, 6);
      }
    },
    [
      applyInputToCell,
      inputMethod,
      isCompleted,
      isGenerating,
      isPaused,
      selectedCell,
      settings.vibrationEnabled,
    ]
  );

  // Keyboard support for desktop / tablet keyboards
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        isPaused ||
        isCompleted ||
        showNewGameModal ||
        showStatsModal ||
        showSettingsModal ||
        dojo !== null
      ) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      // Leave browser / OS shortcuts (Ctrl+1, Alt+←, Cmd+N ...) alone
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Holding a digit key would toggle the cell on every repeat
      if (e.repeat) return;

      if (e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        handleNumberTap(Number(e.key));
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        handleErase();
        return;
      }
      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsNoteMode((prev) => !prev);
        return;
      }
      if (e.key.toLowerCase() === 'h') {
        e.preventDefault();
        handleHint();
        return;
      }
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
      ) {
        e.preventDefault();
        if (!selectedCell) {
          setSelectedCell([4, 4]);
          return;
        }
        const [cr, cc] = selectedCell;
        let nr = cr;
        let nc = cc;
        if (e.key === 'ArrowUp') nr = (cr + 8) % 9;
        if (e.key === 'ArrowDown') nr = (cr + 1) % 9;
        if (e.key === 'ArrowLeft') nc = (cc + 8) % 9;
        if (e.key === 'ArrowRight') nc = (cc + 1) % 9;
        setSelectedCell([nr, nc]);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    handleErase,
    handleHint,
    handleNumberTap,
    handleRedo,
    handleUndo,
    isCompleted,
    isPaused,
    selectedCell,
    showNewGameModal,
    showSettingsModal,
    showStatsModal,
    dojo,
  ]);

  // Determine the number currently highlighted across the board
  const highlightedDigit = useMemo(() => {
    if (inputMethod === 'number-first' && activeNumber !== null) {
      return activeNumber;
    }
    if (selectedCell && board.length === 9) {
      const val = board[selectedCell[0]]?.[selectedCell[1]]?.value;
      if (val && val !== 0) return val;
    }
    return activeNumber;
  }, [activeNumber, board, inputMethod, selectedCell]);

  return (
    <div className="h-[100dvh] w-full flex flex-col justify-between bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 select-none overflow-hidden pt-safe pb-safe">
      {/* Top App Bar */}
      <header className="w-full max-w-md mx-auto px-3 pt-1.5 pb-1 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm shadow-indigo-500/30">
            9
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight leading-none">
              Zen Sudoku
            </h1>
            <button
              type="button"
              onClick={() => setShowNewGameModal(true)}
              className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:opacity-80 active:scale-95 transition"
              aria-label="難易度を変更または新規ゲーム"
            >
              {challenge ? (
                // The header is narrow on phones: the difficulty is shown on the clear screen instead
                <span className="max-w-[9rem] truncate">{challenge.label}</span>
              ) : (
                <>
                  <span>{DIFFICULTY_CONFIG[difficulty].jaLabel}</span>
                  <span className="text-[10px] opacity-75">
                    ({DIFFICULTY_CONFIG[difficulty].label})
                  </span>
                </>
              )}
              <span className="text-[10px] ml-0.5">▼</span>
            </button>
          </div>
        </div>

        {/* Center Status: Mistakes & Timer */}
        <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium leading-none">
              ミス
            </div>
            <div className="text-xs font-bold font-mono mt-0.5 text-slate-700 dark:text-slate-200">
              {mistakes}
            </div>
          </div>

          <div className="h-5 w-px bg-slate-200 dark:bg-slate-800" />

          <button
            type="button"
            onClick={() => !isCompleted && setIsPaused((p) => !p)}
            className="flex items-center gap-1.5 text-left group"
            aria-label={isPaused ? '再開' : '一時停止'}
          >
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 font-medium leading-none">
                タイム
              </div>
              <div className="text-xs font-bold font-mono mt-0.5 text-slate-700 dark:text-slate-200">
                {formatTime(elapsedSeconds)}
              </div>
            </div>
            <span className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-active:scale-90 transition">
              {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            </span>
          </button>
        </div>

        {/* Right Utility Icons */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDojo({ lessonId: null })}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 active:scale-95 transition"
            aria-label="解法道場"
            title="解法道場（解き方を学ぶ）"
          >
            <GraduationCap className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowStatsModal(true)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 active:scale-95 transition"
            aria-label="統計・ベストタイム"
            title="統計・ベストタイム"
          >
            <BarChart2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 active:scale-95 transition"
            aria-label="設定"
            title="設定"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Board Container — Flexibly scales to fit within 100dvh on any mobile screen */}
      <main className="flex-1 min-h-0 w-full max-w-md mx-auto px-3 flex flex-col items-center justify-center">
        <div className="relative w-full max-w-[min(92vw,44dvh)] sm:max-w-[min(88vw,48dvh)] aspect-square bg-white dark:bg-slate-900 rounded-2xl shadow-lg shadow-slate-900/5 dark:shadow-black/40 border-2 border-slate-800 dark:border-slate-600 overflow-hidden">
          {isGenerating ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 dark:bg-slate-900/95 z-20">
              <div className="w-9 h-9 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                パズルを生成中...
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                上級以上は数秒かかることがあります
              </p>
            </div>
          ) : null}

          {/* Pause Overlay Mask */}
          {isPaused && !isCompleted ? (
            <div className="absolute inset-0 z-20 bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center text-white p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center mb-3">
                <Pause className="w-7 h-7 text-indigo-300" />
              </div>
              <h2 className="text-lg font-bold mb-1">一時停止中</h2>
              <p className="text-xs text-slate-300 mb-5">
                フェアプレイのため盤面をマスクしています
              </p>
              <button
                type="button"
                onClick={() => setIsPaused(false)}
                className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition font-semibold text-sm flex items-center gap-2 shadow-lg shadow-indigo-600/30"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>ゲームを再開</span>
              </button>
            </div>
          ) : null}

          {/* 9x9 Grid */}
          <div
            className="w-full h-full grid grid-cols-9 grid-rows-9"
            role="grid"
            aria-label="ナンプレ盤面"
          >
            {board.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const isSelected =
                  selectedCell?.[0] === rIdx && selectedCell?.[1] === cIdx;

                const isPeer =
                  settings.highlightPeerAreas &&
                  selectedCell !== null &&
                  !isSelected &&
                  (selectedCell[0] === rIdx ||
                    selectedCell[1] === cIdx ||
                    (Math.floor(selectedCell[0] / 3) === Math.floor(rIdx / 3) &&
                      Math.floor(selectedCell[1] / 3) ===
                        Math.floor(cIdx / 3)));

                const isSameValue =
                  settings.highlightSameNumbers &&
                  highlightedDigit !== null &&
                  cell.value !== 0 &&
                  cell.value === highlightedDigit;

                const hasCandidateHighlight =
                  settings.highlightSameNumbers &&
                  highlightedDigit !== null &&
                  cell.value === 0 &&
                  cell.notes.includes(highlightedDigit);

                const isError = settings.highlightConflicts && cell.isError;
                const cellKey = `${rIdx}-${cIdx}`;
                const isJustPlaced = lastPlacedCell === cellKey;
                const isFlashing = flashingCells.has(cellKey);
                const hintResult = activeHint?.result;
                const isHintCell =
                  hintResult?.kind === 'step' &&
                  hintResult.cell[0] === rIdx &&
                  hintResult.cell[1] === cIdx;
                const isHintMistake =
                  hintResult?.kind === 'mistake' &&
                  hintResult.cells.some(([hr, hc]) => hr === rIdx && hc === cIdx);
                const revealedDigit =
                  isHintCell && activeHint?.revealed && hintResult?.kind === 'step'
                    ? hintResult.digit
                    : null;

                // Borders for 3x3 blocks
                const borderRight =
                  cIdx === 2 || cIdx === 5
                    ? 'border-r-2 border-r-slate-800 dark:border-r-slate-500'
                    : cIdx < 8
                    ? 'border-r border-r-slate-200 dark:border-r-slate-800'
                    : '';
                const borderBottom =
                  rIdx === 2 || rIdx === 5
                    ? 'border-b-2 border-b-slate-800 dark:border-b-slate-500'
                    : rIdx < 8
                    ? 'border-b border-b-slate-200 dark:border-b-slate-800'
                    : '';

                let bgClass = 'bg-white dark:bg-slate-900';
                if (isSelected) {
                  bgClass = 'bg-indigo-500/25 dark:bg-indigo-500/35';
                } else if (isError) {
                  bgClass = 'bg-rose-100 dark:bg-rose-950/70';
                } else if (isSameValue) {
                  bgClass = 'bg-indigo-200/85 dark:bg-indigo-800/70';
                } else if (hasCandidateHighlight) {
                  bgClass = 'bg-indigo-100/60 dark:bg-indigo-900/35';
                } else if (isPeer) {
                  bgClass = 'bg-slate-100/90 dark:bg-slate-800/65';
                }

                let textClass = 'text-indigo-600 dark:text-indigo-400 font-semibold';
                if (cell.given) {
                  textClass = 'text-slate-900 dark:text-slate-100 font-bold';
                } else if (isError) {
                  textClass = 'text-rose-600 dark:text-rose-400 font-bold animate-shake';
                }

                return (
                  <button
                    key={cellKey}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`行${rIdx + 1} 列${cIdx + 1} ${
                      cell.value ? `値${cell.value}` : '空'
                    }`}
                    onClick={() => handleCellTap(rIdx, cIdx)}
                    className={`relative flex items-center justify-center p-0 focus:outline-none transition-colors duration-100 ${borderRight} ${borderBottom} ${bgClass} ${
                      isFlashing ? 'animate-line-glow' : ''
                    } ${
                      isHintCell
                        ? 'ring-2 ring-inset ring-amber-500'
                        : isHintMistake
                        ? 'ring-2 ring-inset ring-rose-500'
                        : ''
                    }`}
                  >
                    {revealedDigit !== null && cell.value === 0 ? (
                      <span className="text-[clamp(1.05rem,4.3vw,1.65rem)] leading-none font-semibold text-amber-500/80">
                        {revealedDigit}
                      </span>
                    ) : cell.value !== 0 ? (
                      <span
                        className={`text-[clamp(1.05rem,4.3vw,1.65rem)] leading-none ${textClass} ${
                          isJustPlaced ? 'animate-pop-in' : ''
                        }`}
                      >
                        {cell.value}
                      </span>
                    ) : cell.notes.length > 0 ? (
                      <div className="w-full h-full grid grid-cols-3 grid-rows-3 p-[1px] pointer-events-none">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => {
                          const present = cell.notes.includes(n);
                          const isHighlightedNote =
                            present && highlightedDigit === n;
                          return (
                            <span
                              key={n}
                              className={`flex items-center justify-center text-[clamp(0.45rem,1.65vw,0.68rem)] leading-none font-mono ${
                                isHighlightedNote
                                  ? 'text-indigo-600 dark:text-indigo-300 font-extrabold scale-110'
                                  : 'text-slate-500 dark:text-slate-400 font-medium'
                              }`}
                            >
                              {present ? n : ''}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* One-line status: hint explanation or generation error (fixed height, no layout shift) */}
        <div className="h-5 mt-1.5 w-full flex items-center justify-center gap-1.5">
          <p
            className="min-w-0 text-[11px] leading-5 truncate text-slate-600 dark:text-slate-300"
            role="status"
            aria-live="polite"
          >
            {statusMessage ??
              (activeHint?.result.kind === 'mistake'
                ? `間違っている数字が ${activeHint.result.cells.length} 個あります（赤枠）`
                : activeHint?.result.kind === 'step'
                ? `${activeHint.result.techniques.join(' → ')}で枠のマスが決まる${
                    activeHint.revealed ? `（答え ${activeHint.result.digit}）` : '（もう一度で答え）'
                  }`
                : activeHint?.result.kind === 'none'
                ? 'ヒントが見つかりませんでした'
                : '')}
          </p>
          {!statusMessage && activeHint?.result.kind === 'step' && activeHint.result.lessonId ? (
            <button
              type="button"
              onClick={() =>
                activeHint.result.kind === 'step' &&
                setDojo({ lessonId: activeHint.result.lessonId })
              }
              className="shrink-0 px-1.5 rounded-md text-[11px] leading-5 font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50"
            >
              解説
            </button>
          ) : null}
        </div>
      </main>

      {/* Bottom Controls: Action Bar + Number Keypad */}
      <footer className="w-full max-w-md mx-auto px-3 pt-1 pb-2 flex flex-col gap-2 shrink-0">
        {/* Mode Switcher & Tool Actions */}
        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndex <= 0 || isPaused || isCompleted}
            className="flex flex-col items-center justify-center py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-35 active:scale-95 transition shadow-sm"
            aria-label="元に戻す (Undo)"
          >
            <RotateCcw className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">戻す</span>
          </button>

          <button
            type="button"
            onClick={handleRedo}
            disabled={
              historyIndex >= history.length - 1 || isPaused || isCompleted
            }
            className="flex flex-col items-center justify-center py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-35 active:scale-95 transition shadow-sm"
            aria-label="やり直す (Redo)"
          >
            <RotateCw className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">進む</span>
          </button>

          <button
            type="button"
            onClick={handleErase}
            disabled={isPaused || isCompleted || !selectedCell}
            className="flex flex-col items-center justify-center py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-35 active:scale-95 transition shadow-sm"
            aria-label="消しゴム"
          >
            <Eraser className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">消去</span>
          </button>

          <button
            type="button"
            onClick={handleHint}
            disabled={isPaused || isCompleted || isGenerating}
            className="flex flex-col items-center justify-center py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-35 active:scale-95 transition shadow-sm"
            aria-label="ヒント"
            title="ヒント（H）"
          >
            <Lightbulb className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">ヒント</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsNoteMode((prev) => !prev);
              triggerHaptic(settings.vibrationEnabled, 8);
            }}
            className={`relative flex flex-col items-center justify-center py-2 rounded-xl border active:scale-95 transition shadow-sm ${
              isNoteMode
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-indigo-500/25'
                : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-700 dark:text-slate-200'
            }`}
            aria-label="メモ入力モード切替"
            aria-pressed={isNoteMode}
          >
            <span
              className={`absolute top-0.5 right-0.5 text-[8px] leading-tight font-bold px-0.5 rounded ${
                isNoteMode
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
              }`}
            >
              {isNoteMode ? 'ON' : 'OFF'}
            </span>
            <Pencil className="w-4 h-4 mb-0.5" />
            <span className="text-[10px] font-semibold">メモ</span>
          </button>
        </div>

        {/* 1-9 Numpad */}
        <div className="grid grid-cols-9 gap-1 sm:gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
            const count = digitCounts[num] || 0;
            const isDone = count >= 9;
            const isRemain = Math.max(0, 9 - count);
            const isSelectedNum =
              (inputMethod === 'number-first' && activeNumber === num) ||
              (inputMethod === 'cell-first' && highlightedDigit === num);

            return (
              <button
                key={num}
                type="button"
                onClick={() => handleNumberTap(num)}
                disabled={isPaused || isCompleted}
                aria-label={`数字 ${num} (${
                  isDone ? '完了' : `残り${isRemain}個`
                })`}
                className={`relative flex flex-col items-center justify-center py-2.5 sm:py-3 rounded-xl border font-bold transition active:scale-90 shadow-sm ${
                  isDone
                    ? 'bg-slate-100 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/50 text-slate-400 dark:text-slate-600 opacity-60'
                    : isSelectedNum
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-500/25'
                    : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 text-indigo-600 dark:text-indigo-400 hover:border-indigo-300'
                }`}
              >
                <span className="text-lg sm:text-xl leading-none">{num}</span>
                {isDone ? (
                  <span className="mt-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                ) : (
                  <span
                    className={`mt-1 text-[9px] font-mono leading-none ${
                      isSelectedNum
                        ? 'text-indigo-100'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {isRemain}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </footer>

      {/* Victory Modal */}
      {isCompleted && showVictoryModal ? (
        <div className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-2xl text-center animate-pop-in">
            <button
              type="button"
              onClick={() => setShowVictoryModal(false)}
              className="absolute top-3 right-3 p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="閉じて盤面を見る"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Trophy className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">
              パズルクリア！
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {challenge
                ? `${challenge.label}（${DIFFICULTY_CONFIG[difficulty].jaLabel}）を解き明かしました`
                : `${DIFFICULTY_CONFIG[difficulty].jaLabel} (${DIFFICULTY_CONFIG[difficulty].label}) を解き明かしました`}
            </p>

            {isNewBestTime ? (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>自己ベストタイム更新！</span>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-2 my-5 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800">
              <div>
                <div className="text-[10px] text-slate-400 font-medium">
                  クリア時間
                </div>
                <div className="text-base font-extrabold font-mono mt-0.5 text-indigo-600 dark:text-indigo-400">
                  {formatTime(elapsedSeconds)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">
                  {challenge ? '難しさ' : 'ベスト記録'}
                </div>
                <div className="text-base font-extrabold font-mono mt-0.5">
                  {challenge
                    ? DIFFICULTY_CONFIG[difficulty].jaLabel
                    : formatTime(stats[difficulty].bestTimeSeconds)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-medium">
                  ミス回数
                </div>
                <div className="text-base font-extrabold font-mono mt-0.5">
                  {mistakes}
                  {hintsUsed > 0 ? (
                    <span className="block text-[10px] font-medium text-slate-400">
                      ヒント {hintsUsed}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => startNewGame(difficulty, challenge ?? undefined)}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-bold text-sm shadow-lg shadow-indigo-600/25 transition"
              >
                {challenge ? '同じ種類の次の問題' : '同じ難易度でもう1局'}
              </button>
              <button
                type="button"
                onClick={() => setShowNewGameModal(true)}
                className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-xs transition"
              >
                別の難易度を選ぶ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* New Game / Difficulty Selector Modal */}
      {showNewGameModal ? (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl animate-pop-in">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">新しいパズルを始める</h2>
              <button
                type="button"
                onClick={() => setShowNewGameModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              解が1つだけのパズルを、解くのに必要な解き方の難しさで6段階に分けています。勘で埋める必要はありません。
            </p>
            <div className="flex flex-col gap-2">
              {DIFFICULTIES.map(
                (diff) => {
                  const cfg = DIFFICULTY_CONFIG[diff];
                  const dStat = stats[diff];
                  return (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => startNewGame(diff)}
                      className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition active:scale-98 ${
                        !challenge && difficulty === diff
                          ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                          : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-sm flex items-center gap-2">
                          <span>{cfg.jaLabel}</span>
                          <span className="text-xs font-medium text-slate-400">
                            {cfg.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {cfg.techniques}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400">ベスト</div>
                        <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                          {formatTime(dStat.bestTimeSeconds)}
                        </div>
                      </div>
                    </button>
                  );
                }
              )}
            </div>

            <h3 className="mt-5 mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">
              特別な問題
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
              最初の数字が 17 個しかない問題です。16 個以下では解が 1 つに決まらないことが証明されていて、17 個が最少です。記録には数えません。
            </p>
            <div className="flex flex-col gap-2">
              {SEVENTEEN_BANDS.map((band) => (
                <button
                  key={band.key}
                  type="button"
                  onClick={() =>
                    startNewGame('easy', { kind: 'seventeen', key: band.key, label: band.label })
                  }
                  className={`w-full p-3 rounded-2xl border text-left transition active:scale-98 ${
                    challenge?.kind === 'seventeen' && challenge.key === band.key
                      ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40'
                      : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="font-bold text-sm">{band.label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {band.note}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Statistics Modal */}
      {showStatsModal ? (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl animate-pop-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold">プレイ統計・ベスト記録</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {DIFFICULTIES.map(
                (diff) => {
                  const cfg = DIFFICULTY_CONFIG[diff];
                  const s = stats[diff];
                  const avg =
                    s.gamesWon > 0
                      ? Math.round(s.totalTimeSeconds / s.gamesWon)
                      : null;

                  return (
                    <div
                      key={diff}
                      className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between"
                    >
                      <div>
                        <div className="text-sm font-bold">
                          {cfg.jaLabel}{' '}
                          <span className="text-xs font-normal text-slate-400">
                            ({cfg.label})
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          クリア回数: <strong className="text-slate-700 dark:text-slate-200">{s.gamesWon}</strong> 回
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-right">
                        <div>
                          <div className="text-[10px] text-slate-400">平均</div>
                          <div className="text-xs font-mono font-semibold">
                            {formatTime(avg)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400">最短ベスト</div>
                          <div className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                            {formatTime(s.bestTimeSeconds)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}
            </div>

            <div className="mt-4 flex justify-between items-center pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  saveStats(DEFAULT_STATS);
                  setStats(DEFAULT_STATS);
                }}
                className="text-xs text-rose-500 hover:underline"
              >
                記録をリセット
              </button>
              <button
                type="button"
                onClick={() => setShowStatsModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dojo ? (
        <DojoErrorBoundary onClose={() => setDojo(null)}>
          <Suspense fallback={null}>
            <DojoView
              initialLessonId={dojo.lessonId}
              onClose={() => setDojo(null)}
              onPractice={(strategy, title) => {
                setDojo(null);
                startNewGame('easy', { kind: 'practice', key: strategy, label: `練習 ${title}` });
              }}
            />
          </Suspense>
        </DojoErrorBoundary>
      ) : null}

      {/* Settings Modal */}
      {showSettingsModal ? (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-2xl animate-pop-in">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <h2 className="text-base font-bold">環境設定</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="閉じる"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Theme Selector */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                カラーテーマ
              </div>
              <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(
                  [
                    { id: 'system', label: '自動', icon: Monitor },
                    { id: 'light', label: 'ライト', icon: Sun },
                    { id: 'dark', label: 'ダーク', icon: Moon },
                  ] as Array<{
                    id: ThemePreference;
                    label: string;
                    icon: React.ComponentType<{ className?: string }>;
                  }>
                ).map((item) => {
                  const Icon = item.icon;
                  const active = settings.theme === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateSettings({ theme: item.id })}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${
                        active
                          ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Input Method */}
            <div className="mb-4">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                入力の順番
              </div>
              <div className="flex flex-col gap-1.5">
                {(
                  [
                    {
                      id: 'cell-first',
                      label: 'マスを選んでから数字',
                      icon: Grid,
                      note: 'マスをタップし、下の数字を押して入れる。普通の入力方法です。',
                    },
                    {
                      id: 'number-first',
                      label: '数字を選んでからマス',
                      icon: Hash,
                      note: '下の数字を押すと選ばれたままになり、タップしたマスに次々入る。同じ数字をまとめて置くときに速い。もう一度押すと解除。',
                    },
                  ] as Array<{
                    id: InputMethod;
                    label: string;
                    icon: React.ComponentType<{ className?: string }>;
                    note: string;
                  }>
                ).map((item) => {
                  const Icon = item.icon;
                  const active = inputMethod === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setInputMethod(item.id);
                        setActiveNumber(null);
                        updateSettings({ defaultInputMethod: item.id });
                      }}
                      aria-pressed={active}
                      className={`text-left p-2.5 rounded-xl border transition ${
                        active
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div
                        className={`flex items-center gap-1.5 text-xs font-semibold ${
                          active ? 'text-indigo-600 dark:text-indigo-400' : ''
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{item.label}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {item.note}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Toggles */}
            <div className="flex flex-col gap-3 text-sm">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-xs">自動メモ消去</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    数字確定時、同行・列・ブロックの同じ候補メモを自動削除
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.autoRemoveNotes}
                  onChange={(e) =>
                    updateSettings({ autoRemoveNotes: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-xs">同じ数字を強調表示</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    選択中の数字と同一の盤面数字・メモをハイライト
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.highlightSameNumbers}
                  onChange={(e) =>
                    updateSettings({ highlightSameNumbers: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-xs">
                    行・列・3×3ブロックのハイライト
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    選択セルの関連エリアを淡く表示して視認性を向上
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.highlightPeerAreas}
                  onChange={(e) =>
                    updateSettings({ highlightPeerAreas: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-xs">間違いを赤で表示</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    正解と違う数字をすぐに知らせる（オフで自力チェック）
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.highlightConflicts}
                  onChange={(e) =>
                    updateSettings({ highlightConflicts: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <div className="font-semibold text-xs">
                    タッチ微振動（Haptics）
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    対応スマートフォンでの心地よい打鍵フィードバック
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.vibrationEnabled}
                  onChange={(e) =>
                    updateSettings({ vibrationEnabled: e.target.checked })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded"
                />
              </label>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
              >
                完了
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
