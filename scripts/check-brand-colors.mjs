#!/usr/bin/env node
/**
 * Brand guard for apps/web/src. Fails the build when code drifts from the
 * calm, flat Cydemic design system:
 *  - raw colors (hex / rgb / hsl / oklch) outside src/styles (tokens live there)
 *  - glows and effects: text-shadow, box/drop shadows, gradients, blur, scanlines
 *  - removed pieces: HudCorner, the Press Start 2P pixel font
 *  - big type (> 32px) and thick borders
 *  - Anton (font-display) outside components/ui/Display.tsx
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = join(import.meta.dirname, '..');
const srcDir = join(root, 'apps', 'web', 'src');
const stylesDir = join(srcDir, 'styles') + sep;
const displayFile = join(srcDir, 'components', 'ui', 'Display.tsx');

/** [name, regex, appliesTo(file)] */
const rules = [
  ['raw color (use theme tokens)', /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab)\(/g, (f) => !f.startsWith(stylesDir)],
  ['text-shadow', /text-shadow|textShadow/gi, () => true],
  ['inline box-shadow / filter', /boxShadow|backdropFilter|filter:\s*['"]?blur/g, () => true],
  ['shadow utility', /(?<![\w-])(?:shadow|drop-shadow|inset-shadow)(?:-[\w[\]/.#()%,-]+)?(?=["'`\s}]|$)/g, (f) => !f.startsWith(stylesDir)],
  ['box-shadow', /box-shadow\s*:/gi, () => true],
  ['gradient', /gradient|bg-linear-|bg-radial|bg-conic/gi, () => true],
  ['blur', /blur\(|(?<![\w-])(?:backdrop-)?blur(?:-[\w[\]]+)?(?=["'`\s]|$)/g, () => true],
  ['scanline', /scanline/gi, () => true],
  ['HudCorner (removed)', /HudCorner/g, () => true],
  ['pixel font (removed)', /Press Start|press-start|font-pixel/gi, () => true],
  ['type larger than 32px', /text-(?:[3-9]xl|\[(?:3[3-9]|[4-9]\d|\d{3,})px\])/g, () => true],
  ['thick border', /(?<![\w-])border(?:-[trblxy])?-(?:4|8|\[(?:[3-9]|\d{2,})px\])(?=["'`\s]|$)/g, () => true],
  ['Anton outside Display.tsx', /font-display/g, (f) => f !== displayFile && !f.startsWith(stylesDir)],
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(tsx?|css)$/.test(name)) yield path;
  }
}

const problems = [];
for (const file of walk(srcDir)) {
  const lines = readFileSync(file, 'utf8').split('\n');
  for (const [name, regex, applies] of rules) {
    if (!applies(file)) continue;
    lines.forEach((line, i) => {
      // Theme lines that wipe a Tailwind scale (e.g. `--shadow-*: initial;`) remove effects; allow them.
      if (/^\s*--[\w-]+\*:\s*initial;/.test(line)) return;
      for (const match of line.matchAll(regex)) {
        problems.push(`${relative(root, file)}:${i + 1}  [${name}]  ${match[0]}`);
      }
    });
  }
}

if (problems.length > 0) {
  console.error('Brand check failed. Keep the UI flat and on-token (see apps/web/src/styles/theme.css):\n');
  console.error(problems.map((p) => `  ${p}`).join('\n'));
  process.exit(1);
}
console.log('Brand check passed: tokens only, flat surfaces, no removed effects or fonts.');
