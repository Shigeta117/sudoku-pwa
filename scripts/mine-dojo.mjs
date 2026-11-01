// Mine dojo examples for every technique at once: each hard puzzle is solved step by step and the
// first position of each technique is kept. Far cheaper than build-dojo.mjs for rare techniques,
// because one puzzle feeds all lessons instead of one.
//
//   node scripts/mine-dojo.mjs mine <out.jsonl> <seedStart> <puzzles>   # append raw finds
//   node scripts/mine-dojo.mjs merge <a.jsonl> [b.jsonl ...]            # top up src/data/dojo
//
// Run several `mine` processes with different seedStart values in parallel, then one `merge`.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import {
  LEARN_TARGETS,
  STRATEGY,
  applyTeachStep,
  candidatesFromBoard,
  generate,
  teachHint,
} from 'sudoku-core';

const OUT_DIR = new URL('../src/data/dojo/', import.meta.url);
const COUNT = Number(process.env.DOJO_COUNT ?? 4);
const LEVELS = ['L6', 'L7', 'L8', 'L9', 'L10'];
const TARGETS = [...LEARN_TARGETS, { id: 'naked-triple', strategy: STRATEGY.NAKED_TRIPLE }];
const ID_BY_STRATEGY = new Map(TARGETS.map((t) => [t.strategy, t.id]));

function mineOne(puzzle) {
  const found = new Map();
  let board = puzzle.map((v) => v ?? 0);
  let candidates = candidatesFromBoard(puzzle);
  for (let guard = 0; guard < 400 && board.includes(0); guard++) {
    const hint = teachHint(board.map((v) => v || null), candidates, 'continue');
    if (!hint) break;
    const { step } = hint;
    if (!found.has(step.strategy)) {
      found.set(step.strategy, {
        board: hint.previewBoard.join(''),
        candidates: hint.previewCandidates.map((c) => c.join('')),
        type: step.type,
        updates: step.updates,
        patternCells: step.patternCells ?? [],
        patternDigits: step.patternDigits ?? [],
        regionCells: step.regionCells ?? [],
      });
    }
    const next = applyTeachStep(board.map((v) => v || null), candidates, step);
    if (!next) break;
    board = next.board;
    candidates = next.candidates;
  }
  return found;
}

function mine(outFile, seedStart, puzzles) {
  const started = Date.now();
  for (let i = 0; i < puzzles; i++) {
    const seed = seedStart + i;
    let puzzle;
    try {
      puzzle = generate(LEVELS[i % LEVELS.length], { seed, maxAttempts: 40 });
    } catch {
      continue;
    }
    for (const [strategy, example] of mineOne(puzzle)) {
      const id = ID_BY_STRATEGY.get(strategy);
      if (id) appendFileSync(outFile, JSON.stringify({ id, strategy, example }) + '\n');
    }
    if (i % 20 === 19) console.log(`${seed}: ${i + 1}/${puzzles} puzzles, ${Math.round((Date.now() - started) / 1000)}s`);
  }
}

function merge(files) {
  const byId = new Map();
  for (const file of files) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const { id, strategy, example } = JSON.parse(line);
      if (!byId.has(id)) byId.set(id, { strategy, examples: [] });
      byId.get(id).examples.push(example);
    }
  }
  for (const target of TARGETS) {
    const path = new URL(`${target.id}.json`, OUT_DIR);
    const kept = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')).examples : [];
    const seen = new Set(kept.map((e) => e.board));
    const extra = (byId.get(target.id)?.examples ?? []).filter((e) => {
      if (seen.has(e.board)) return false;
      seen.add(e.board);
      return true;
    });
    const examples = [...kept, ...extra].slice(0, COUNT);
    if (examples.length === kept.length) {
      console.log(`${target.id}: ${kept.length} (unchanged)`);
      continue;
    }
    writeFileSync(path, JSON.stringify({ id: target.id, strategy: target.strategy, examples }) + '\n');
    console.log(`${target.id}: ${kept.length} -> ${examples.length}`);
  }
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'mine') mine(args[0], Number(args[1]), Number(args[2]));
else if (mode === 'merge') merge(args);
else console.log('usage: mine <out.jsonl> <seedStart> <puzzles> | merge <files...>');
