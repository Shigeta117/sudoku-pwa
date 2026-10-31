/// <reference lib="webworker" />
import { Difficulty } from '../types/sudoku';
import { generatePuzzle } from './sudokuEngine';

self.onmessage = (e: MessageEvent<{ difficulty: Difficulty }>) => {
  try {
    self.postMessage({ ok: true, ...generatePuzzle(e.data.difficulty) });
  } catch (err) {
    self.postMessage({ ok: false, error: String(err) });
  }
};
