// Pick the bundled puzzle pools from files rated by mine-pool.mjs and write src/data/pool/*.json.
//
//   node scripts/build-pool.mjs <rated.jsonl ...>
//
// 極 (extreme): L10 that needs chains (rank >= 6.6) at least EXTREME_MIN_CHAINS times, hardest first.
// 17 個 (seventeen): 17-clue puzzles, spread over levels.
// 練習 (practice): per technique, puzzles whose hardest technique is that one, most uses first.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { TACTICS, getUniqueSolution, isUniqueSolution } from 'sudoku-core';

const OUT_DIR = new URL('../src/data/pool/', import.meta.url);
// 12+ chains is the top ~3.5% of 5,982 mined L10 puzzles (8+ would be ~14%)
const EXTREME_MIN_CHAINS = 12;
const EXTREME_COUNT = 200;
const SEVENTEEN_PER_LEVEL = { L3: 60, L4: 60, L5: 60, L6: 50, L7: 50, L8: 50, L9: 30, L10: 40 };
const PRACTICE_COUNT = 8;
const CHAIN_RANK = 6.6;

const RANK = Object.fromEntries(TACTICS.map((t) => [t.title, t.rank]));
const chainSteps = (row) =>
  Object.entries(row.used).reduce((n, [title, freq]) => n + (RANK[title] >= CHAIN_RANK ? freq : 0), 0);

function readRows(files) {
  const byPuzzle = new Map();
  for (const file of files) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      byPuzzle.set(row.p, row);
    }
  }
  return [...byPuzzle.values()];
}

function entry(row, extra = {}) {
  const puzzle = [...row.p].map((c) => (c === '.' ? null : Number(c)));
  if (!isUniqueSolution(puzzle)) throw new Error(`not unique: ${row.p}`);
  return { p: row.p, s: getUniqueSolution(puzzle).join(''), level: row.level, ...extra };
}

function write(name, data) {
  writeFileSync(new URL(`${name}.json`, OUT_DIR), JSON.stringify(data) + '\n');
}

// Refuse to overwrite the bundled pools with too little data (wrong path, empty file)
const MIN_EXTREME = 50;
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('usage: node scripts/build-pool.mjs <rated.jsonl ...>');
  process.exit(1);
}
const rows = readRows(files);
mkdirSync(OUT_DIR, { recursive: true });

const extreme = rows
  .filter((r) => r.level === 'L10' && r.givens > 17 && chainSteps(r) >= EXTREME_MIN_CHAINS)
  .sort((a, b) => chainSteps(b) - chainSteps(a) || b.score - a.score)
  .slice(0, EXTREME_COUNT);
if (extreme.length < MIN_EXTREME) {
  console.error(`only ${extreme.length} extreme puzzles (need ${MIN_EXTREME}); nothing written`);
  process.exit(1);
}
write('extreme', { minChains: EXTREME_MIN_CHAINS, puzzles: extreme.map((r) => entry(r, { chains: chainSteps(r) })) });
console.log(`extreme: ${extreme.length} (chains ${chainSteps(extreme.at(-1) ?? { used: {} })}..${chainSteps(extreme[0] ?? { used: {} })})`);

const seventeen = Object.entries(SEVENTEEN_PER_LEVEL).flatMap(([level, count]) => {
  // Evenly spaced over the list instead of its head, so the source order does not bias the sample
  const all = rows.filter((r) => r.givens === 17 && r.level === level);
  const step = Math.max(1, all.length / count);
  const picked = Array.from({ length: Math.min(count, all.length) }, (_, i) => all[Math.floor(i * step)]);
  console.log(`seventeen ${level}: ${picked.length}/${count}`);
  return picked;
});
write('seventeen', { puzzles: seventeen.map((r) => entry(r)) });

// Only techniques that have a dojo lesson (each lesson's example file names its strategy)
const DOJO_DIR = new URL('../src/data/dojo/', import.meta.url);
const lessonStrategies = readdirSync(DOJO_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(new URL(f, DOJO_DIR), 'utf8')).strategy);

const practice = {};
for (const title of lessonStrategies) {
  const picked = rows
    .filter((r) => r.hardest === title && r.used[title] > 0)
    .sort((a, b) => b.used[title] - a.used[title] || a.score - b.score)
    .slice(0, PRACTICE_COUNT);
  if (picked.length > 0) practice[title] = picked.map((r) => entry(r, { uses: r.used[title] }));
  console.log(`practice ${title}: ${picked.length} (uses ${picked.map((r) => r.used[title]).join(',')})`);
}
write('practice', { byStrategy: practice });
