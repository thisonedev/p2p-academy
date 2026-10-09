// Fails the build when UI code uses a raw Tailwind palette class (text-red-300) or a
// hex color instead of a token from src/tokens.css. Hex is allowed only in the files
// listed in ALLOWED, each with the reason it holds content colors, not app theme.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const ROOTS = ['packages/ui/src', 'apps/web/src'];
const SKIP = ['packages/ui/src/generated/'];

const ui = 'packages/ui/src/components/';
const ALLOWED = {
  [`${ui}design/art/`]: 'art presets and sample charts the user edits',
  [`${ui}design/brand/`]: 'brand kits and palettes the user picks',
  [`${ui}design/templates/`]: 'template designs',
  [`${ui}design/render/`]: 'draws and exports user designs',
  [`${ui}design/video/`]: 'video themes and canvas-drawn pointer icons',
  [`${ui}design/motion/`]: 'canvas drawing for motion export',
  [`${ui}design/panels/kit-sheet.tsx`]: 'brand kit preview',
  [`${ui}design/panels/avatar-editor.tsx`]: 'avatar color choices',
  [`${ui}design/panels/previews.tsx`]: 'checkerboard behind transparent exports',
  [`${ui}design/panels/chart-drawer.tsx`]: 'spreadsheet green and the chart sheet',
  [`${ui}design/panels/panel-fields.tsx`]: 'default value of a color picker',
  [`${ui}design/studio/studio.tsx`]: 'checkerboard behind a transparent canvas',
  [`${ui}design/studio/use-add-layers.ts`]: 'default colors of a new layer',
  [`${ui}course/course-home.tsx`]: 'course cover gradients',
  [`${ui}playground/export-popup.tsx`]: 'file format brand colors',
  [`${ui}playground/config-popup.tsx`]: 'default value of a color picker',
  [`${ui}playground/lib/pdf.ts`]: 'white page drawn on a canvas',
  [`${ui}shell/donate-button.tsx`]: 'coin brand colors',
  'apps/web/src/app/(home)/page.tsx': 'scaled-down app mockups on the home page',
};

const HUES =
  'red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone';
const PALETTE = new RegExp(
  `(?<![\\w-])(?:text|bg|border(?:-[lrtbxy])?|ring|ring-offset|fill|stroke|from|via|to|outline|decoration|caret|divide|shadow|placeholder|accent)-(?:${HUES})-\\d{2,3}\\b`,
  'g',
);
const HEX = /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

function files(dir) {
  return readdirSync(path.join(root, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (SKIP.some((s) => `${rel}/`.startsWith(s))) return [];
    if (statSync(path.join(root, rel)).isDirectory()) return files(rel);
    return /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}

// Comments may name a color or an issue number (#418); only code counts. Walks the
// source so a '/*' or '//' inside a string ('image/*', 'https://') is not a comment.
function stripComments(source) {
  let out = '';
  let quote = null;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quote) {
      out += ch;
      if (ch === '\\') out += source[++i] ?? '';
      else if (ch === quote) quote = null;
    } else if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      const stop = end < 0 ? source.length : end + 2;
      out += source.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop - 1;
    } else {
      if (ch === "'" || ch === '"' || ch === '`') quote = ch;
      out += ch;
    }
  }
  return out;
}

const problems = [];
const usedAllowances = new Set();
for (const file of ROOTS.flatMap(files)) {
  const allowance = Object.keys(ALLOWED).find((prefix) => file.startsWith(prefix));
  const lines = stripComments(readFileSync(path.join(root, file), 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const [m] of line.matchAll(PALETTE)) problems.push(`${file}:${i + 1}  ${m}  (use a token from tokens.css)`);
    if (allowance) {
      if (HEX.test(line)) usedAllowances.add(allowance);
      HEX.lastIndex = 0;
      return;
    }
    for (const [m] of line.matchAll(HEX)) problems.push(`${file}:${i + 1}  ${m}  (use a token, or add the file to ALLOWED with a reason)`);
  });
}

// An entry with no hex left would quietly allow new hex there later.
for (const prefix of Object.keys(ALLOWED)) {
  if (!usedAllowances.has(prefix)) problems.push(`${prefix}  has no hex any more, remove it from ALLOWED`);
}

if (problems.length) {
  console.error(`check-colors: ${problems.length} raw color(s) in UI code\n${problems.join('\n')}`);
  process.exit(1);
}
console.log('check-colors: no raw palette classes or hex outside the allowed files');
