// Background patterns made from a style and a number. The same pair always draws the same pattern,
// and a new number gives a new arrangement, so a pattern can be shuffled as often as someone likes.
// Each one is a cluster or two growing from the corners, leaving the middle of the post clear.

import type { ICArtDef, ICArtSlot } from './image-constructor-art.js';

const M = '{{main}}';

export const PATTERN_STYLES = [
  ['squares', 'Squares'],
  ['lattice', 'Triangles'],
  ['dots', 'Dots'],
  ['lines', 'Lines'],
  ['arcs', 'Arcs'],
  ['plus', 'Plus'],
  ['grid', 'Grid'],
] as const;

export type PatternStyle = (typeof PATTERN_STYLES)[number][0];
type Style = PatternStyle;

// One color, the ink, made to sit barely visible over any brand's background.
const FAINT: ICArtSlot[] = [{ key: 'main', label: 'Color', role: 'ink', color: '#10131c' }];

/** A repeatable random sequence from a seed. */
function random(seed: number) {
  let n = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    n = (n * 16807) % 2147483647;
    return (n - 1) / 2147483646;
  };
}

const f = (n: number) => n.toFixed(1);

/** One cluster: the corner it grows from, which way is inward, and how far it reaches. */
interface Spot {
  x: number;
  y: number;
  dx: 1 | -1;
  dy: 1 | -1;
  r: number;
}

/** One or two corners to grow from, the second opposite the first and smaller. */
function spots(rand: () => number, w: number, h: number): Spot[] {
  const corners: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  const i = Math.floor(rand() * 4);
  const at = (c: [number, number], r: number): Spot => ({
    x: c[0],
    y: c[1],
    dx: c[0] === 0 ? 1 : -1,
    dy: c[1] === 0 ? 1 : -1,
    r,
  });
  const main = at(corners[i], 55 + rand() * 15);
  return rand() < 0.6 ? [main, at(corners[(i + 2) % 4], 32 + rand() * 10)] : [main];
}

/** How strong a point is: full at the corner, gone at the edge of the cluster. */
const fade = (sp: Spot, x: number, y: number) =>
  Math.max(0, 1 - Math.hypot(x - sp.x, y - sp.y) / sp.r) ** 0.7;

/** Soft squares stacked into the corner, some running off the edge. */
function squares(rand: () => number, sp: Spot): string {
  let out = '';
  const n = 5 + Math.floor(rand() * 3);
  for (let i = 0; i < n; i++) {
    const size = sp.r * (0.22 + rand() * 0.3);
    const u = rand() * sp.r * 0.75;
    const v = rand() * sp.r * 0.75;
    const x = sp.x + sp.dx * u - size / 2;
    const y = sp.y + sp.dy * v - size / 2;
    const a = 0.25 + 0.75 * fade(sp, x + size / 2, y + size / 2);
    out += `<rect x="${f(x)}" y="${f(y)}" width="${f(size)}" height="${f(size)}" rx="${f(size * 0.04)}" fill="${M}" fill-opacity="${a.toFixed(2)}"/>`;
  }
  return out;
}

/** A grid of marks filling the corner and thinning out away from it. */
function grid(sp: Spot, gap: number, mark: (x: number, y: number, a: number) => string): string {
  let out = '';
  for (let u = gap / 2; u < sp.r; u += gap)
    for (let v = gap / 2; v < sp.r; v += gap) {
      const x = sp.x + sp.dx * u;
      const y = sp.y + sp.dy * v;
      const a = fade(sp, x, y);
      if (a > 0.05) out += mark(x, y, a);
    }
  return out;
}

const dots = (_: () => number, sp: Spot) =>
  grid(
    sp,
    3.4,
    (x, y, a) =>
      `<circle cx="${f(x)}" cy="${f(y)}" r=".65" fill="${M}" fill-opacity="${a.toFixed(2)}"/>`,
  );

const plus = (_: () => number, sp: Spot) =>
  grid(
    sp,
    6,
    (x, y, a) =>
      `<path d="M${f(x - 1.1)} ${f(y)}h2.2M${f(x)} ${f(y - 1.1)}v2.2" stroke="${M}" stroke-width=".5" stroke-opacity="${a.toFixed(2)}"/>`,
  );

/** Rings around the corner, fainter as they grow. */
function arcs(rand: () => number, sp: Spot): string {
  const count = 4 + Math.floor(rand() * 2);
  let out = '';
  for (let i = 1; i <= count; i++) {
    const a = 1 - (i - 1) / count;
    out += `<circle cx="${f(sp.x)}" cy="${f(sp.y)}" r="${f((sp.r / count) * i)}" fill="none" stroke="${M}" stroke-width=".45" stroke-opacity="${a.toFixed(2)}"/>`;
  }
  return out;
}

/** A fade from the corner outward, for line work that can't fade line by line. */
const mask = (id: string, sp: Spot) =>
  `<defs><radialGradient id="${id}-g" gradientUnits="userSpaceOnUse" cx="${f(sp.x)}" cy="${f(sp.y)}" r="${f(sp.r)}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>` +
  `<mask id="${id}"><rect x="-10" y="-10" width="400" height="400" fill="url(#${id}-g)"/></mask></defs>`;

function lines(_: () => number, sp: Spot, id: string): string {
  let d = '';
  for (let c = 2; c < sp.r * 1.4; c += 3.4) {
    d += `M${f(sp.x + sp.dx * c)} ${f(sp.y)}L${f(sp.x)} ${f(sp.y + sp.dy * c)}`;
  }
  return `${mask(id, sp)}<path d="${d}" stroke="${M}" stroke-width=".4" fill="none" mask="url(#${id})"/>`;
}

function lattice(rand: () => number, sp: Spot, id: string): string {
  const s = 8 + Math.floor(rand() * 4);
  const h = s * 0.866;
  const x0 = Math.min(sp.x, sp.x + sp.dx * sp.r);
  const y0 = Math.min(sp.y, sp.y + sp.dy * sp.r);
  let d = '';
  for (let y = y0; y <= y0 + sp.r; y += h) d += `M${f(x0)} ${f(y)}h${f(sp.r)}`;
  for (let x = x0 - sp.r; x <= x0 + sp.r * 2; x += s)
    d += `M${f(x)} ${f(y0)}l${f(sp.r / 1.732)} ${f(sp.r)}M${f(x)} ${f(y0)}l${f(-sp.r / 1.732)} ${f(sp.r)}`;
  return `${mask(id, sp)}<path d="${d}" stroke="${M}" stroke-width=".4" fill="none" mask="url(#${id})"/>`;
}

/** Fine grid lines, like graph paper, fading out from the corner. */
function gridLines(_: () => number, sp: Spot, id: string): string {
  const x0 = Math.min(sp.x, sp.x + sp.dx * sp.r);
  const y0 = Math.min(sp.y, sp.y + sp.dy * sp.r);
  let d = '';
  for (let u = 0; u <= sp.r; u += 5) d += `M${f(x0 + u)} ${f(y0)}v${f(sp.r)}M${f(x0)} ${f(y0 + u)}h${f(sp.r)}`;
  return `${mask(id, sp)}<path d="${d}" stroke="${M}" stroke-width=".3" fill="none" mask="url(#${id})"/>`;
}

const BUILD: Record<Style, (rand: () => number, sp: Spot, id: string) => string> = {
  squares,
  lattice,
  dots,
  lines,
  arcs,
  plus,
  grid: gridLines,
};

/** A canvas shape a pattern is drawn for: square, landscape (16:9) or portrait (9:16). */
type Shape = '' | 'l' | 'p';

// An optional l or p after the number; older designs have none and are square. Memphis was
// replaced by squares, so its ids draw squares.
const PATTERN = /^pattern-([a-z]+)-(\d+)(?:-([lp]))?$/;

export const isPattern = (id: string) => PATTERN.test(id);

export const patternId = (style: Style, seed: number, shape: Shape = '') =>
  `pattern-${style}-${seed}${shape ? `-${shape}` : ''}`;

/** The seed in a pattern id, so a style change keeps the arrangement. */
export const patternSeed = (id: string) => Number(PATTERN.exec(id)?.[2]) || 1;

/** The same pattern drawn for a canvas `height` percent of its width tall. */
export function patternFor(id: string, height: number): string {
  const m = PATTERN.exec(id);
  if (!m) return id;
  const shape: Shape = height < 90 ? 'l' : height > 112 ? 'p' : '';
  return `pattern-${m[1]}-${m[2]}${shape ? `-${shape}` : ''}`;
}

/** A new id for the same style with another arrangement. */
export function shufflePattern(id: string): string {
  const m = PATTERN.exec(id);
  if (!m) return id;
  return `pattern-${m[1]}-${1 + Math.floor(Math.random() * 99999)}${m[3] ? `-${m[3]}` : ''}`;
}

/** The drawing for a pattern id, or nothing if the id isn't one. */
export function patternDef(id: string): ICArtDef | undefined {
  const m = PATTERN.exec(id);
  if (!m) return undefined;
  const style = (m[1] === 'memphis' ? 'squares' : m[1]) as Style;
  if (!(style in BUILD)) return undefined;
  const seed = Number(m[2]);
  // The shorter side is 100 in every shape, so the shapes keep their size.
  const [w, h] = m[3] === 'l' ? [177.8, 100] : m[3] === 'p' ? [100, 177.8] : [100, 100];
  const rand = random(seed);
  const body = spots(rand, w, h)
    .map((sp, i) => BUILD[style](rand, sp, `pt-${style}-${seed}-${m[3] ?? 's'}-${i}`))
    .join('');
  return {
    id,
    name: PATTERN_STYLES.find(([st]) => st === style)?.[1] ?? style,
    kind: 'shape',
    group: 'Backgrounds',
    ratio: w / h,
    viewBox: `0 0 ${w} ${h}`,
    body,
    slots: FAINT,
  };
}

/** One of each style, for the Elements tab. */
export const PATTERNS: ICArtDef[] = PATTERN_STYLES.map(
  ([style]) => patternDef(patternId(style, 1)) as ICArtDef,
);
