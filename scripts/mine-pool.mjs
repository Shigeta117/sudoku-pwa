// Rate puzzles for the bundled pools (極, 17-clue challenge, technique practice).
// Each line of the output is one rated puzzle; build-pool.mjs picks from these files.
//
//   node scripts/mine-pool.mjs gen <out.jsonl> <seedStart> <count> [levels]   # generate and rate (levels: L6,L8,...)
//   node scripts/mine-pool.mjs rate <in.txt> <out.jsonl> <shard> <shards>    # rate an external list (81 chars per line)
//
// Run several processes with different seeds / shards in parallel.
import { appendFileSync, readFileSync } from 'node:fs';
import { analyze, generate } from 'sudoku-core';

const DEFAULT_LEVELS = ['L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'];

function parse(line) {
  return [...line].map((c) => (c === '.' || c === '0' ? null : Number(c)));
}

function isPointSymmetric(puzzle) {
  return puzzle.every((v, i) => (v === null) === (puzzle[80 - i] === null));
}

function rate(puzzle) {
  const a = analyze(puzzle);
  if (!a.hasUniqueSolution || !a.difficulty) return null;
  return {
    p: puzzle.map((v) => v ?? '.').join(''),
    level: a.difficulty,
    score: a.score,
    tedium: a.tedium,
    hardest: a.hardestTechnique,
    hardestRank: a.hardestRank,
    used: Object.fromEntries(a.usedStrategies.map((s) => [s.title, s.freq])),
    givens: puzzle.filter((v) => v !== null).length,
    symmetric: isPointSymmetric(puzzle),
  };
}

function gen(outFile, seedStart, count, levels) {
  const started = Date.now();
  for (let i = 0; i < count; i++) {
    const level = levels[i % levels.length];
    let puzzle;
    try {
      puzzle = generate(level, { seed: seedStart + i, maxAttempts: 40 });
    } catch {
      continue;
    }
    const rated = rate(puzzle);
    if (rated) appendFileSync(outFile, JSON.stringify(rated) + '\n');
    if (i % 100 === 99) console.log(`${seedStart}: ${i + 1}/${count}, ${Math.round((Date.now() - started) / 1000)}s`);
  }
}

function rateList(inFile, outFile, shard, shards) {
  const lines = readFileSync(inFile, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => /^[.0-9]{81}$/.test(l));
  const started = Date.now();
  for (let i = shard; i < lines.length; i += shards) {
    const rated = rate(parse(lines[i]));
    if (rated) appendFileSync(outFile, JSON.stringify(rated) + '\n');
    if (i % (shards * 500) === shard) console.log(`shard ${shard}: ${i}/${lines.length}, ${Math.round((Date.now() - started) / 1000)}s`);
  }
}

const [mode, ...args] = process.argv.slice(2);
if (mode === 'gen') gen(args[0], Number(args[1]), Number(args[2]), args[3] ? args[3].split(',') : DEFAULT_LEVELS);
else if (mode === 'rate') rateList(args[0], args[1], Number(args[2]), Number(args[3]));
else console.log('usage: gen <out.jsonl> <seedStart> <count> [levels] | rate <in.txt> <out.jsonl> <shard> <shards>');
