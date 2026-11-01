// Mine worked examples for the technique dojo and write them to src/data/dojo/<id>.json.
// Finding rare techniques takes minutes, so the examples are generated once and committed.
//
//   node scripts/build-dojo.mjs                 # every lesson that has no file yet
//   node scripts/build-dojo.mjs x-wing y-wing   # only these lessons (overwrites)
//
// Environment: DOJO_COUNT (examples per lesson, default 4), DOJO_SEED (seed base, default 7),
// DOJO_ATTEMPTS (puzzles to try; default is sudoku-core's per-technique budget),
// DOJO_MERGE=1 (keep the existing examples and only add new ones up to DOJO_COUNT).
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { LEARN_TARGETS, STRATEGY, generateExamplesForTactic } from 'sudoku-core';

const OUT_DIR = new URL('../src/data/dojo/', import.meta.url);
const COUNT = Number(process.env.DOJO_COUNT ?? 4);
const SEED = Number(process.env.DOJO_SEED ?? 7);
const ATTEMPTS = process.env.DOJO_ATTEMPTS ? Number(process.env.DOJO_ATTEMPTS) : undefined;
const MERGE = process.env.DOJO_MERGE === '1';

// Naked triple is solved by the engine but has no lesson target in sudoku-core
const TARGETS = [
  ...LEARN_TARGETS,
  { id: 'naked-triple', strategy: STRATEGY.NAKED_TRIPLE },
];

const requested = process.argv.slice(2);
const targets = requested.length
  ? TARGETS.filter((t) => requested.includes(t.id))
  : TARGETS.filter((t) => !existsSync(new URL(`${t.id}.json`, OUT_DIR)));

mkdirSync(OUT_DIR, { recursive: true });

/** Compact form: board as an 81-char string, candidates as digit strings. */
function compact(example) {
  const { step } = example;
  return {
    board: example.board.join(''),
    candidates: example.candidates.map((c) => c.join('')),
    type: step.type,
    updates: step.updates,
    patternCells: step.patternCells ?? [],
    patternDigits: step.patternDigits ?? [],
    regionCells: step.regionCells ?? [],
  };
}

for (const target of targets) {
  const started = Date.now();
  const file = new URL(`${target.id}.json`, OUT_DIR);
  const kept = MERGE && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).examples : [];
  const found = generateExamplesForTactic(target, {
    count: COUNT - kept.length,
    seedBase: SEED,
    maxAttempts: ATTEMPTS,
    onProgress: (message) => console.log(new Date().toISOString().slice(11, 19), message),
  }).map(compact);
  const seen = new Set(kept.map((e) => e.board));
  const examples = [...kept, ...found.filter((e) => !seen.has(e.board))].slice(0, COUNT);
  if (examples.length === 0) {
    console.log(`${target.id}: no examples found, file not written`);
    continue;
  }
  writeFileSync(
    file,
    JSON.stringify({ id: target.id, strategy: target.strategy, examples }) + '\n'
  );
  console.log(`${target.id}: ${examples.length} examples (${found.length} new) in ${Math.round((Date.now() - started) / 1000)}s`);
}
