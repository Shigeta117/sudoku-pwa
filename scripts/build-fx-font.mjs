// Subset Dela Gothic One to the characters the effects mode uses, so the bundled font is tiny
// and works offline. Rerun after changing any text in src/fx/ (fx.test.ts checks it).
//
//   node scripts/build-fx-font.mjs <DelaGothicOne-Regular.ttf>
//
// Source: https://github.com/google/fonts/tree/main/ofl/delagothicone (SIL OFL 1.1)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import subsetFont from 'subset-font';

const FX_DIR = new URL('../src/fx/', import.meta.url);
const OUT_DIR = new URL('../src/fx/fonts/', import.meta.url);

const [source] = process.argv.slice(2);
if (!source) {
  console.error('usage: node scripts/build-fx-font.mjs <DelaGothicOne-Regular.ttf>');
  process.exit(1);
}

// Every non-ASCII character in the effects sources (texts, comments: a few spare glyphs are cheap)
const used = new Set();
for (const file of readdirSync(FX_DIR).filter((f) => /\.(ts|tsx)$/.test(f))) {
  for (const ch of readFileSync(new URL(file, FX_DIR), 'utf8')) {
    if (ch.codePointAt(0) > 0x7e) used.add(ch);
  }
}
const ascii = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCharCode(0x20 + i));
const glyphs = [...ascii, ...[...used].sort()].join('');

const subset = await subsetFont(readFileSync(source), glyphs, { targetFormat: 'woff2' });
writeFileSync(new URL('dela-gothic-fx.woff2', OUT_DIR), subset);
writeFileSync(new URL('glyphs.txt', OUT_DIR), [...used].sort().join('') + '\n');
console.log(`${used.size} non-ASCII glyphs, ${subset.length} bytes`);
