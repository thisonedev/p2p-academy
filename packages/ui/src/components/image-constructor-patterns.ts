// Background patterns made from a style and a number. The same pair always draws the same pattern,
// and a new number gives a new arrangement, so a pattern can be shuffled as often as someone likes.

import type { ICArtDef, ICArtSlot } from './image-constructor-art.js';

const M = '{{main}}';
const D = '{{detail}}';

export const PATTERN_STYLES = [
  ['memphis', 'Memphis'],
  ['lattice', 'Lattice'],
  ['dots', 'Dot grid'],
  ['lines', 'Lines'],
  ['arcs', 'Arcs'],
  ['plus', 'Plus grid'],
] as const;

export type PatternStyle = (typeof PATTERN_STYLES)[number][0];
type Style = PatternStyle;

// Memphis is bold, in the accent and ink colors. The rest are faint line work in ink and muted
// colors, made to sit barely visible over either brand's color.
const BOLD: ICArtSlot[] = [
  { key: 'main', label: 'Main', role: 'accent', color: '#f4553b' },
  { key: 'detail', label: 'Detail', role: 'ink', color: '#10131c' },
];
const FAINT: ICArtSlot[] = [
  { key: 'main', label: 'Shapes', role: 'ink', color: '#10131c' },
  { key: 'detail', label: 'Lines', role: 'muted', color: '#6b7185' },
];

/** A repeatable random sequence from a seed. */
function random(seed: number) {
  let n = (Math.abs(Math.floor(seed)) % 2147483646) + 1;
  return () => {
    n = (n * 16807) % 2147483647;
    return (n - 1) / 2147483646;
  };
}

const f = (n: number) => n.toFixed(1);

/** One Memphis piece, about `s` wide, centered on 0 0. `id` keeps its clip path its own. */
function memphisPiece(kind: number, s: number, color: string, id: string): string {
  const stroke = (width: number) =>
    `fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
  const line = stroke(1.1);
  const h = s / 2;
  switch (kind) {
    case 0: {
      // Zigzag.
      const pts = Array.from(
        { length: 7 },
        (_, i) => `${f(-h + (i * s) / 6)} ${i % 2 ? -s / 8 : s / 8}`,
      );
      return `<polyline points="${pts.join(' ')}" ${line}/>`;
    }
    case 1:
      // Circle filled with stripes.
      return (
        `<clipPath id="${id}"><circle r="${f(h)}"/></clipPath><g clip-path="url(#${id})" stroke="${color}" stroke-width=".9">` +
        Array.from(
          { length: 9 },
          (_, i) =>
            `<path d="M${f(-s)} ${f(-h + i * (s / 8))}L${f(s)} ${f(-h + i * (s / 8) - s)}"/>`,
        ).join('') +
        '</g>'
      );
    case 2: {
      // Dot grid.
      let out = '';
      for (let y = 0; y < 4; y++)
        for (let x = 0; x < 5; x++)
          out += `<circle cx="${f(-h + x * (s / 4))}" cy="${f(-h * 0.6 + y * (s / 5))}" r=".55" fill="${color}"/>`;
      return out;
    }
    case 3:
      return `<circle r="${f(h * 0.8)}" ${line}/>`;
    case 4:
      return `<path d="M${f(-s / 5)} ${f(-s / 5)}L${f(s / 5)} ${f(s / 5)}M${f(s / 5)} ${f(-s / 5)}L${f(-s / 5)} ${f(s / 5)}" ${stroke(1.4)}/>`;
    case 5:
      // Half circle.
      return `<path d="M${f(-h * 0.8)} 0A${f(h * 0.8)} ${f(h * 0.8)} 0 0 1 ${f(h * 0.8)} 0Z" fill="${color}"/>`;
    case 6:
      return `<path d="M0 ${f(-h * 0.8)}L${f(h * 0.8)} ${f(h * 0.6)}H${f(-h * 0.8)}Z" ${line}/>`;
    case 7: {
      // Squiggle.
      let d = `M${f(-h)} 0`;
      for (let i = 0; i < 4; i++) d += `q${f(s / 8)} ${i % 2 ? s / 6 : -s / 6} ${f(s / 4)} 0`;
      return `<path d="${d}" ${line}/>`;
    }
    case 8:
      // Chevrons.
      return Array.from(
        { length: 3 },
        (_, i) =>
          `<path d="M${f(-h + i * (s / 3))} ${f(-s / 6)}l${f(s / 6)} ${f(s / 6)}l${f(-s / 6)} ${f(s / 6)}" ${line}/>`,
      ).join('');
    case 9:
      return `<circle r="${f(s / 7)}" fill="${color}"/>`;
    case 10:
      // Square with stripes.
      return (
        `<clipPath id="${id}"><rect x="${f(-h * 0.8)}" y="${f(-h * 0.8)}" width="${f(s * 0.8)}" height="${f(s * 0.8)}"/></clipPath><g clip-path="url(#${id})" stroke="${color}" stroke-width=".9">` +
        Array.from(
          { length: 8 },
          (_, i) => `<path d="M${f(-s + i * (s / 4))} ${f(h)}L${f(i * (s / 4))} ${f(-h)}"/>`,
        ).join('') +
        '</g>'
      );
    default:
      return `<path d="M0 ${f(-s / 4)}v${f(s / 2)}M${f(-s / 4)} 0h${f(s / 2)}" ${stroke(1.4)}/>`;
  }
}

/** Pieces spread over a loose grid, one per cell with a few left empty, so none overlap. */
function memphis(seed: number): string {
  const r = random(seed);
  const cols = 5;
  const rows = 5;
  const cell = 100 / cols;
  const out: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (r() < 0.3) continue;
      const cx = (x + 0.5) * cell + (r() - 0.5) * cell * 0.35;
      const cy = (y + 0.5) * cell + (r() - 0.5) * cell * 0.35;
      const s = cell * (0.45 + r() * 0.3);
      const kind = Math.floor(r() * 12);
      const rot = [0, 0, 45, 90, -30][Math.floor(r() * 5)];
      const color = r() < 0.45 ? M : D;
      out.push(
        `<g transform="translate(${f(cx)} ${f(cy)}) rotate(${rot})">${memphisPiece(kind, s, color, `pm-${seed}-${x}-${y}`)}</g>`,
      );
    }
  }
  return out.join('');
}

/** Small outline shapes, dots and crosses scattered over a faint pattern. */
function confetti(r: () => number, count: number): string {
  const out: string[] = [];
  const line = `fill="none" stroke="${M}" stroke-width=".55"`;
  for (let i = 0; i < count; i++) {
    const x = f(r() * 96 + 2);
    const y = f(r() * 96 + 2);
    const s = 1.5 + r() * 2.5;
    const rot = Math.round(r() * 90);
    const at = `transform="translate(${x} ${y}) rotate(${rot})"`;
    const kind = i % 6;
    if (kind === 0) out.push(`<circle cx="${x}" cy="${y}" r="${f(s / 2)}" ${line}/>`);
    else if (kind === 1)
      out.push(
        `<rect x="${f(-s / 2)}" y="${f(-s / 2)}" width="${f(s)}" height="${f(s)}" ${at} ${line}/>`,
      );
    else if (kind === 2)
      out.push(
        `<path d="M0 ${f(-s / 1.7)}L${f(s / 2)} ${f(s / 3.4)}H${f(-s / 2)}Z" ${at} ${line}/>`,
      );
    else if (kind === 3)
      out.push(`<path d="M0 -1.2v2.4M-1.2 0h2.4" ${at} stroke="${D}" stroke-width=".35"/>`);
    else out.push(`<circle cx="${x}" cy="${y}" r=".45" fill="${M}"/>`);
  }
  return out.join('');
}

/** A soft mask that shows a pattern in a few patches and fades it out between them. */
function patches(id: string, r: () => number, count: number): string {
  const spots = Array.from(
    { length: count },
    () =>
      `<circle cx="${f(r() * 100)}" cy="${f(r() * 100)}" r="${f(26 + r() * 14)}" fill="url(#${id}-f)"/>`,
  );
  return (
    `<defs><radialGradient id="${id}-f"><stop offset=".4" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>` +
    `<mask id="${id}"><rect width="100" height="100" fill="#000"/>${spots.join('')}</mask></defs>`
  );
}

function lattice(seed: number): string {
  const r = random(seed);
  const s = 12 + Math.floor(r() * 5);
  const h = s * 0.866;
  let d = '';
  for (let y = 0; y <= 100 + h; y += h) d += `M0 ${f(y)}H100`;
  for (let x = -100; x <= 200; x += s)
    d += `M${x} 0L${f(x + 100 / 1.732)} 100M${x} 0L${f(x - 100 / 1.732)} 100`;
  const id = `pl-${seed}`;
  return `${patches(id, r, 3)}<path d="${d}" stroke="${D}" stroke-width=".22" fill="none" mask="url(#${id})"/>${confetti(r, 20)}`;
}

function dots(seed: number): string {
  const r = random(seed);
  const gap = 5 + Math.floor(r() * 3);
  let out = '';
  for (let y = gap / 2; y < 100; y += gap)
    for (let x = gap / 2; x < 100; x += gap)
      out += `<circle cx="${f(x)}" cy="${f(y)}" r=".35" fill="${D}"/>`;
  return out + confetti(r, 7);
}

function lines(seed: number): string {
  const r = random(seed);
  const gap = 3 + r() * 2;
  let d = '';
  for (let x = -100; x < 100; x += gap) d += `M${f(x)} 100L${f(x + 100)} 0`;
  const id = `pd-${seed}`;
  const ring = () =>
    `<circle cx="${f(15 + r() * 70)}" cy="${f(15 + r() * 70)}" r="${f(4 + r() * 9)}" fill="none" stroke="${M}" stroke-width=".5"/>`;
  return `${patches(id, r, 2)}<path d="${d}" stroke="${D}" stroke-width=".2" fill="none" mask="url(#${id})"/>${ring()}${ring()}${confetti(r, 5)}`;
}

function arcs(seed: number): string {
  const r = random(seed);
  const corners = [
    [0, 100],
    [100, 0],
    [0, 0],
    [100, 100],
  ];
  const pick = corners.sort(() => r() - 0.5).slice(0, 2);
  const step = 7 + Math.floor(r() * 4);
  const rings = pick
    .map(([cx, cy]) =>
      [1, 2, 3, 4, 5].map((i) => `<circle cx="${cx}" cy="${cy}" r="${i * step}"/>`).join(''),
    )
    .join('');
  return `<g fill="none" stroke="${D}" stroke-width=".25">${rings}</g>${confetti(r, 9)}`;
}

function plus(seed: number): string {
  const r = random(seed);
  const gap = 10 + Math.floor(r() * 4);
  let d = '';
  for (let y = gap / 2; y < 100; y += gap)
    for (let x = gap / 2; x < 100; x += gap) d += `M${f(x - 1)} ${f(y)}h2M${f(x)} ${f(y - 1)}v2`;
  return `<path d="${d}" stroke="${D}" stroke-width=".3"/>${confetti(r, 6)}`;
}

const BUILD: Record<Style, (seed: number) => string> = {
  memphis,
  lattice,
  dots,
  lines,
  arcs,
  plus,
};

export const patternId = (style: Style, seed: number) => `pattern-${style}-${seed}`;

const PATTERN = /^pattern-([a-z]+)-(\d+)$/;

export const isPattern = (id: string) => PATTERN.test(id);

/** A new id for the same style with another arrangement. */
export function shufflePattern(id: string): string {
  const m = PATTERN.exec(id);
  if (!m) return id;
  return `pattern-${m[1]}-${1 + Math.floor(Math.random() * 99999)}`;
}

/** The drawing for a pattern id, or nothing if the id isn't one. */
export function patternDef(id: string): ICArtDef | undefined {
  const m = PATTERN.exec(id);
  const style = m?.[1] as Style | undefined;
  if (!m || !style || !(style in BUILD)) return undefined;
  const seed = Number(m[2]);
  const name = PATTERN_STYLES.find(([s]) => s === style)?.[1] ?? style;
  return {
    id,
    name,
    kind: 'shape',
    group: 'Backgrounds',
    ratio: 1,
    viewBox: '0 0 100 100',
    body: BUILD[style](seed),
    slots: style === 'memphis' ? BOLD : FAINT,
  };
}

/** One of each style, for the Elements tab. */
export const PATTERNS: ICArtDef[] = PATTERN_STYLES.map(
  ([style]) => patternDef(patternId(style, 1)) as ICArtDef,
);
