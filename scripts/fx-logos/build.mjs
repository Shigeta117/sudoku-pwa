// Render every effects-mode logo with Blender into public/fx/logos/*.webp.
// They are fetched only when ドパガキモード is on (not precached), and cached by the service worker then.
//
//   node scripts/fx-logos/build.mjs <DelaGothicOne-Regular.ttf> [id ...]
//
// BLENDER env var overrides the Blender path. Font source: github.com/google/fonts ofl/delagothicone (SIL OFL 1.1).
import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FX_LOGOS } from '../../src/fx/logos.ts';

const BLENDER = process.env.BLENDER ?? 'C:/Program Files (x86)/Steam/steamapps/common/Blender/blender.exe';
const SCRIPT = fileURLToPath(new URL('./render_logo.py', import.meta.url));
const OUT_DIR = fileURLToPath(new URL('../../public/fx/logos/', import.meta.url));

const [font, ...only] = process.argv.slice(2);
if (!font) {
  console.error('usage: node scripts/fx-logos/build.mjs <DelaGothicOne-Regular.ttf> [id ...]');
  process.exit(1);
}
mkdirSync(OUT_DIR, { recursive: true });

for (const logo of FX_LOGOS.filter((l) => only.length === 0 || only.includes(l.id))) {
  const out = `${OUT_DIR}${logo.id}.webp`;
  const started = Date.now();
  // One Blender at a time: it holds a lot of memory (see AE + Blender contention notes)
  execFileSync(BLENDER, ['-b', '-P', SCRIPT, '--', font, out, logo.style, ...logo.lines], { stdio: 'pipe' });
  console.log(`${logo.id}: ${Math.round((Date.now() - started) / 1000)}s`);
}
