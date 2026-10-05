// Benchmark templates: a local model measured against cloud and other local models, in each
// built-in brand. Every name and number is a placeholder to type over.

import { ANNOUNCE_BRANDS, layerBuilder, type LayerBuilder, renumber } from './design-announce.js';
import { SAMPLE_LOGO } from './design-brand-builtin.js';
import { type BrandKit, brandBackground } from './design-brand-kit.js';
import { grouped, nameParts } from './design-groups.js';
import { pointBox } from './design-update-art.js';
import {
  type ICElement,
  type ICFont,
  type ICLine,
  type ICRatio,
  type ICRole,
  type ICShape,
  type ICTemplate,
  withCards,
} from './design-layout.js';

type Fmt = 'x' | 'sq' | 'st';
type B = LayerBuilder;

const HEIGHT: Record<Fmt, number> = { x: 56.25, sq: 100, st: (1920 / 1080) * 100 };
const RATIO: Record<Fmt, ICRatio> = { x: 'x-post', sq: '1:1', st: 'story' };

interface Ctx {
  b: B;
  H: number;
  kit: BrandKit;
  logo: { url: string; ratio: number };
}

type Layout = (x: Ctx, spec: string) => ICElement[];

const MONO = { font: 'geist-mono' as const, weight: 500, track: 0.02 };
const head = (x: Ctx, weight = 700) => ({ font: x.kit.fonts.heading, weight, track: -0.02, lh: 1.05 });
const body = (x: Ctx, weight = 400) => ({ font: x.kit.fonts.body, weight, lh: 1.15 });

// Bold letters per em in each heading font, for sizing a highlight behind words before fonts load.
const EM: Partial<Record<ICFont, number>> = { grotesk: 0.56, geist: 0.57, sans: 0.58, 'archivo-black': 0.7 };
const textW = (x: Ctx, text: string, size: number) =>
  text.length * size * (EM[x.kit.fonts.heading] ?? 0.62);

const logo = (x: Ctx, lx: number, ly: number, lw: number) =>
  x.b.image('logo', lx, ly, lw, x.logo.url, x.logo.ratio);
const ellipse = (e: ICShape): ICShape => ({ ...e, kind: 'ellipse' });
const P = <T extends ICElement>(part: string, e: T): T => ({ ...e, part });


let lines = 0;
/** A straight line from (x1, y1) to (x2, y2), all in canvas-width units. */
function line(x: Ctx, x1: number, y1: number, x2: number, y2: number, th: number, tone: ICRole, op: number): ICLine {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const rot = (Math.atan2(y2 - y1, x2 - x1) * 180) / Math.PI;
  return {
    id: `ln${++lines}`,
    t: 'line',
    x: (x1 + x2) / 2 - len / 2,
    y: (((y1 + y2) / 2 - th / 2) / x.H) * 100,
    w: len,
    th,
    rot,
    op,
    color: x.kit.roles[tone],
    pal: { color: tone },
    vis: true,
  };
}

/** A placeholder company mark: a rounded tile with a letter. */
function chip(x: Ctx, role: string, cx: number, cy: number, s: number, letter: string, ours: boolean): ICElement[] {
  const { b } = x;
  return [
    b.rect(cx - s / 2, cy - s / 2, s, s, ours ? 'accent' : 'ink', { op: ours ? 1 : 0.12, radius: s * 0.26 }),
    b.text(role, cx - s / 2, cy - s * 0.3, s, letter, s * 0.48, {
      font: 'sans',
      weight: 800,
      align: 'center',
      lh: 1.2,
      tone: ours ? 'onAccent' : 'ink',
    }),
  ];
}

// ------------------------------------------------------------------ Ranked leaderboard

/** A ranked list's setup, `10@1`: how many items and which one is active, counted from 1. */
export const parseRanked = (spec: string) => {
  const [count, at] = spec.split('@').map(Number);
  const n = Math.max(1, count || 1);
  return { n, active: Math.min(Math.max(1, at || 1), n) - 1 };
};
export const rankedSpec = (n: number, active: number) => `${n}@${active + 1}`;

/** Placeholder names for a ranked list: the active item is yours, the rest take the others in turn. */
function names(n: number, active: number, others: string[], ours: string): string[] {
  let k = 0;
  return Array.from({ length: n }, (_, i) => (i === active ? ours : (others[k++] ?? `Model ${k}`)));
}

const SPEEDS = [323, 281, 244, 196, 171, 163, 139, 118, 96, 74, 61, 50];
const SPEED_NAMES = [
  'Local model A',
  'Local model B',
  'Cloud model A',
  'Local model C',
  'Cloud model B',
  'Local model D',
  'Cloud model C',
  'Local model E',
  'Cloud model D',
  'Local model F',
  'Cloud model E',
];

/** Models ranked by one score as bars, the first highlighted in the title and outlined. */
const leaderboard: Layout = (x, spec) => {
  const { b, H } = x;
  const m = b.pick(5, 6, 7);
  const { n: count, active } = parseRanked(spec);
  const label = names(count, active, SPEED_NAMES, 'Your Model');
  const ranked = label.map((nm, i): [string, number] => [nm, SPEEDS[i] ?? Math.max(10, 50 - (i - 11) * 8)]);
  const ts = b.pick(3.1, 4.6, 5.6);
  const t1 = b.pick(3, 5.6, 20);
  const t2 = t1 + ts * 1.25;
  const top = t2 + ts * 1.3 + b.pick(1.6, 4, 8);
  const foot = H - b.pick(3, 4.6, 7);
  const axis = b.pick(2.4, 3.6, 5);
  const rh = (foot - axis - b.pick(2.6, 3.4, 5) - top) / ranked.length;
  const x0 = b.pick(33, 40, 50);
  const x1 = 100 - m - 7;
  const X = (v: number) => x0 + (v / 350) * (x1 - x0);
  const name = 'Your Model:';
  const nw = textW(x, name, ts);
  const els: ICElement[] = [
    // Beside the title in X and a square, above it in a story.
    logo(x, b.f === 'st' ? m : 100 - m - b.pick(11, 15, 18), b.f === 'st' ? 10 : t1 + ts * 0.1, b.pick(11, 15, 20)),
    b.text('title', m, t1, 100 - 2 * m - b.pick(13, 17, 0), 'Speech to text on a laptop', ts, head(x)),
    P('highlight_box', b.rect(m - ts * 0.15, t2 - ts * 0.08, nw + ts * 0.35, ts * 1.24, 'accent', { radius: ts * 0.1 })),
    b.text('highlight', m, t2, nw + ts * 0.2, name, ts, { ...head(x), tone: 'onAccent', wrap: false }),
    b.text('rank', m + nw + ts * 0.5, t2, 100 - m - nw - ts, 'Ranked #1', ts, head(x)),
  ];
  const gridH = ranked.length * rh + rh * 0.2;
  for (let t = 0; t <= 350; t += b.pick(50, 50, 100)) {
    els.push(
      P(`grid${t}`, b.rect(X(t) - 0.06, top - rh * 0.2, 0.12, gridH, 'ink', { op: 0.08 })),
      b.text(`tick${t}`, X(t) - 4, top + ranked.length * rh + axis * 0.3, 8, `${t}×`, b.pick(1.1, 1.7, 2), {
        ...MONO,
        tone: 'muted',
        align: 'center',
      }),
    );
  }
  els.push(P('axis', b.rect(x0 - 0.1, top - rh * 0.2, 0.2, gridH, 'ink', { op: 0.25 })));
  ranked.forEach(([n, v], i) => {
    const y = top + i * rh;
    const cy = y + rh / 2;
    const ours = i === active;
    const r = Math.min(rh * 0.3, b.pick(1.3, 1.85, 2.4));
    const ns = Math.min(rh * 0.36, b.pick(1.5, 2.3, 3.3));
    const vs = Math.min(rh * 0.3, b.pick(1.3, 1.9, 2.8));
    const cs = Math.min(rh * 0.52, b.pick(2.2, 3.2, 4.2));
    const row: ICElement[] = [];
    if (ours)
      row.push(
        b.rect(m - 1.6, y + rh * 0.06, 100 - 2 * m + 3.2, rh * 0.88, 'accent', { op: 0.1, radius: rh * 0.22 }),
        b.rect(m - 1.6, y + rh * 0.06, 100 - 2 * m + 3.2, rh * 0.88, '', { line: 'accent', sw: 0.28, radius: rh * 0.22 }),
      );
    row.push(
      ellipse(b.rect(m + 0.2, cy - r, 2 * r, 2 * r, '', { line: 'muted', sw: 0.14 })),
      b.text(`rank${i + 1}`, m + 0.2, cy - r * 0.62, 2 * r, String(i + 1), r * 0.9, { ...MONO, tone: 'muted', align: 'center', lh: 1.2 }),
      b.text(`item${i + 1}_name`, m + 2 * r + 1.4, cy - ns * 0.6, x0 - m - 2 * r - cs - 3, n, ns, body(x, ours ? 700 : 500)),
      ...chip(x, `mark${i + 1}`, x0 - cs / 2 - 1, cy, cs, ours ? 'Y' : String.fromCharCode(65 + i - (i > active ? 1 : 0)), ours),
      b.rect(x0, cy - rh * 0.31, X(v) - x0, rh * 0.62, ours ? 'accent' : 'muted', { op: ours ? 1 : 0.45, radius: 0.4 }),
      b.text(`score${i + 1}`, X(v) + 1.2, cy - vs * 0.6, 12, `${v}×`, vs, {
        ...MONO,
        weight: ours ? 600 : 400,
        tone: ours ? 'ink' : 'muted',
      }),
    );
    els.push(...grouped(row));
  });
  const fs = b.pick(1.05, 1.4, 1.8);
  els.push(
    b.text('source', m, foot, 60, '2 HOURS OF AUDIO · LAPTOP GPU · SEPT 2026', fs, { ...MONO, tone: 'muted', track: 0.1 }),
    b.text('note', 100 - m - 40, foot, 40, '× FASTER THAN REAL TIME', fs, { ...MONO, tone: 'muted', track: 0.1, align: 'right' }),
  );
  return els;
};

// ------------------------------------------------------------------ Column leaderboard

const SCORES = [1382, 1369, 1365, 1361, 1349, 1347, 1342, 1338, 1333, 1330, 1326, 1323, 1320, 1305, 1298, 1290];
const CLOUDS = 'ABCDEFGHIJKLMNOP'.split('').map((l) => `Cloud\n${l}`);

/** Every model's score as a column, the local one in the accent with a callout pointing at it. */
const columns: Layout = (x, spec) => {
  const { b, H } = x;
  const m = b.pick(5, 6, 7);
  const { n: count, active: OURS } = parseRanked(spec);
  const data = names(count, OURS, CLOUDS, 'Your\nModel').map((nm, i): [string, number] => [nm, SCORES[i] ?? 1290 - (i - 15) * 6]);
  const ts = b.pick(3.4, 5, 6.2);
  const lw = b.pick(11, 15, 18);
  // The logo shares the title's row in X and sits above it in a square and a story.
  const ly = b.pick(3.6, m, 10);
  const ty = b.pick(3.4, m + 8, 22);
  const els: ICElement[] = [
    logo(x, b.f === 'x' ? 100 - m - lw : m, ly, lw),
    b.text('title', m, ty, 100 - 2 * m - b.pick(lw + 2, 0, 0), '#6 in translation,\n#1 offline', ts, head(x)),
  ];
  els.push(
    b.text('subtitle', m, ty + ts * 2.25, 100 - 2 * m, 'Translation quality across 14 models. The only one that runs on your device.', b.pick(1.6, 2.4, 2.8), {
      ...body(x),
      tone: 'muted',
    }),
  );
  const base = H - b.pick(9, 14, 24);
  const topY = ty + ts * 2.25 + b.pick(12, 20, 34);
  const x0 = m + 0.6;
  const x1 = 100 - m - 0.6;
  const gap = b.pick(0.9, 1.4, 1.8);
  const bw = (x1 - x0 - gap * (data.length - 1)) / data.length;
  const Y = (v: number) => base - ((v - 1150) / (1390 - 1150)) * (base - topY);
  els.push(P('baseline', b.rect(x0 - 0.6, base, x1 - x0 + 1.2, 0.16, 'ink', { op: 0.2 })));
  const vs = Math.min(bw * 0.3, b.pick(1.2, 1.8, 2.4));
  const ls = b.pick(1.05, 1.6, 2.1);
  let target: ICShape | undefined;
  data.forEach(([n, v], i) => {
    const bx = x0 + i * (bw + gap);
    const ours = i === OURS;
    const cs = bw * 0.5;
    const bar = b.rect(bx, Y(v), bw, base - Y(v), ours ? 'accent' : 'muted', { op: ours ? 1 : 0.45, radius: bw * 0.16 });
    if (ours) target = bar;
    els.push(
      ...grouped([
        bar,
        b.text(`score${i + 1}`, bx, Y(v) + bw * 0.25, bw, String(v), vs, {
          ...MONO,
          weight: 600,
          align: 'center',
          tone: ours ? 'onAccent' : 'ink',
        }),
        ellipse(b.rect(bx + (bw - cs) / 2, base - cs - bw * 0.3, cs, cs, ours ? 'onAccent' : 'bg', { op: ours ? 1 : 0.8 })),
        b.text(`mark${i + 1}`, bx, base - cs * 0.82 - bw * 0.3, bw, ours ? 'L' : 'C', cs * 0.5, {
          font: 'sans',
          weight: 800,
          align: 'center',
          lh: 1.2,
          tone: ours ? 'accent' : 'muted',
        }),
        b.text(`item${i + 1}_name`, bx - gap / 2, base + ls * 0.6, bw + gap, n, ls, {
          ...body(x, ours ? 700 : 400),
          align: 'center',
          lh: 1.2,
          tone: ours ? 'ink' : 'muted',
        }),
      ]),
    );
  });
  // The callout sits above the columns on whichever side of its column has room. Its pointer is
  // redrawn from the callout to the column whenever either one moves.
  const ox = x0 + OURS * (bw + gap) + bw / 2;
  const cs = b.pick(3.2, 4.6, 5.6);
  const label = 'Runs on your device';
  const lsz = b.pick(2.5, 3.6, 4.4);
  const lwid = textW(x, label, lsz);
  const cy = topY - lsz * 1.9;
  const reach = b.pick(5, 7, 9);
  // Right of the column when it fits there, else left of it.
  const right = ox + reach + cs + 1 + lwid <= 100 - m || ox - reach - cs - 1 - lwid < m;
  // Kept inside the margins when a wide font makes the words run long.
  const left = Math.min(
    100 - m - lwid - cs - 1,
    Math.max(m, right ? ox + reach : ox - reach - cs - 1 - lwid),
  );
  // The tile faces the column, so the pointer leaves from it without crossing the words.
  const tileX = right ? left : left + lwid + 1;
  const textX = right ? left + cs + 1 : left;
  const tile = chip(x, 'callout_mark', tileX + cs / 2, cy, cs, 'L', true);
  const words = b.text('callout', textX, cy - lsz * 0.62, lwid + 4, label, lsz, { ...head(x), wrap: false });
  const callout: ICElement[] = [...tile, words];
  const from = tile[0];
  if (target && from.t === 'shape') {
    // The same block the editor redraws it from: the tile and the words' box together.
    const ty = cy - lsz * 0.62;
    const x0b = Math.min(tileX, textX);
    const y0b = Math.min(cy - cs / 2, ty);
    const box = pointBox(
      {
        x: x0b,
        y: y0b,
        w: Math.max(tileX + cs, textX + lwid + 4) - x0b,
        h: Math.max(cy + cs / 2, ty + lsz * 1.05) - y0b,
      },
      { x: target.x, y: (target.y / 100) * H, w: target.w, h: (target.h / 100) * H },
    );
    const link = { from: from.id, to: target.id, flow: 'point' as const, with: words.id };
    callout.push(b.art(box.art, box.x, box.y, box.w, { lock: true, link }));
  }
  els.push(...grouped(callout));
  els.push(
    b.text('note', 100 - m - 60, H - b.pick(3, 4.6, 7), 60, 'L runs locally · C runs in the cloud · Sept 2026', b.pick(1.2, 1.8, 2.2), {
      ...body(x),
      tone: 'muted',
      align: 'right',
    }),
  );
  return els;
};

// ------------------------------------------------------------------ Quality vs cost

const COSTS: [string, number, number, 'right' | 'above' | 'below'][] = [
  ['Cloud A', 2.85, 59.9, 'below'],
  ['Cloud B', 4.35, 61.1, 'right'],
  ['Cloud C', 8.7, 63.1, 'above'],
  ['Cloud D', 11.7, 62.1, 'below'],
  ['Cloud E', 1.8, 54.2, 'right'],
];

/** Quality against the cloud bill, with the local model at $0 in the shaded best-value corner. */
const scatter: Layout = (x) => {
  const { b, H } = x;
  const m = b.pick(5, 6, 7);
  const ts = b.pick(3.6, 5.2, 6.4);
  const lw = b.pick(11, 15, 18);
  const ty = b.pick(3.4, m + 8, 22);
  const els: ICElement[] = [
    logo(x, b.f === 'x' ? 100 - m - lw : m, b.pick(3.6, m, 10), lw),
    b.text('title', m, ty, 100 - 2 * m, 'Quality vs cloud bill', ts, head(x)),
    b.text('subtitle', m, ty + ts * 1.25, 100 - 2 * m, 'Top left is best. A local model has no bill per token.', b.pick(1.6, 2.4, 2.8), {
      ...body(x),
      tone: 'muted',
    }),
  ];
  const tick = b.pick(1.2, 1.8, 2.2);
  const px0 = m + b.pick(7, 10, 11);
  const px1 = 100 - m - 1;
  const py0 = ty + ts * 1.25 + b.pick(7, 11, 20);
  const py1 = H - b.pick(9, 13, 22);
  const X = (v: number) => px0 + (v / 15) * (px1 - px0);
  const Y = (v: number) => py1 - ((v - 50) / 16) * (py1 - py0);
  els.push(
    b.rect(px0, py0, X(4.5) - px0, Y(58) - py0, 'accent', { op: 0.08 }),
    b.text('zone', px0 + 1.2, py0 + 1, 30, 'Best value', b.pick(1.3, 2, 2.4), { ...body(x, 700), tone: 'accent' }),
  );
  for (let v = 50; v <= 66; v += 4)
    els.push(
      b.rect(px0, Y(v) - 0.05, px1 - px0, 0.1, 'ink', { op: 0.1 }),
      b.text(`y${v}`, px0 - 9, Y(v) - tick * 0.6, 8, String(v), tick, { ...MONO, tone: 'muted', align: 'right' }),
    );
  for (let v = 0; v <= 15; v += 3)
    els.push(b.text(`x${v}`, X(v) - 4, py1 + tick * 0.8, 8, `$${v}`, tick, { ...MONO, tone: 'muted', align: 'center' }));
  els.push(
    b.rect(px0 - 0.08, py0, 0.16, py1 - py0, 'ink', { op: 0.3 }),
    b.rect(px0, py1 - 0.08, px1 - px0, 0.16, 'ink', { op: 0.3 }),
    b.text('x_axis', (px0 + px1) / 2 - 25, py1 + tick * 2.6, 50, 'Cost per 1M tokens (USD)', tick * 1.1, {
      ...body(x),
      tone: 'muted',
      align: 'center',
    }),
  );
  const yl = 30;
  const ycx = px0 - b.pick(5.5, 8, 9);
  els.push(
    b.text('y_axis', ycx - yl / 2, (py0 + py1) / 2 - tick * 0.6, yl, 'Quality score', tick * 1.1, {
      ...body(x),
      tone: 'muted',
      align: 'center',
      rot: -90,
    }),
  );
  const ours: [number, number] = [0.06, 59.6];
  const path: [number, number][] = [ours, [2.85, 59.9], [4.35, 61.1], [8.7, 63.1]];
  for (let i = 1; i < path.length; i++)
    els.push(line(x, X(path[i - 1][0]), Y(path[i - 1][1]), X(path[i][0]), Y(path[i][1]), 0.14, 'ink', 0.45));
  const dot = b.pick(1.8, 2.6, 3.2);
  const ps = b.pick(1.45, 2.2, 2.7);
  COSTS.forEach(([n, cx0, cy0, at], i) => {
    const cx = X(cx0);
    const cy = Y(cy0);
    const [lx, ly, align] =
      at === 'right'
        ? [cx + dot, cy - ps * 0.6, 'left' as const]
        : at === 'above'
          ? [cx - 10, cy - dot - ps * 1.4, 'center' as const]
          : [cx - 10, cy + dot * 0.9, 'center' as const];
    els.push(
      ...grouped([
        ellipse(b.rect(cx - dot / 2, cy - dot / 2, dot, dot, 'muted', { op: 0.7 })),
        b.text(`item${i + 1}_name`, lx, ly, 20, n, ps, { ...body(x, 500), align }),
      ]),
    );
  });
  const halo = dot * 2.2;
  const ox = X(ours[0]);
  const oy = Y(ours[1]);
  const ns = b.pick(1.8, 2.7, 3.3);
  els.push(
    ...grouped([
      ellipse(b.rect(ox - halo / 2, oy - halo / 2, halo, halo, 'accent', { op: 0.22 })),
      ellipse(b.rect(ox - dot * 0.65, oy - dot * 0.65, dot * 1.3, dot * 1.3, 'accent')),
      b.text('ours_name', ox + 0.4, Y(64.6), 30, 'Your Model', ns, { ...head(x), tone: 'accent' }),
      b.text('ours_score', ox + 0.4, Y(64.6) + ns * 1.25, 34, '59.6 · $0, on device', ns * 0.75, { ...MONO, weight: 600 }),
    ]),
  );
  return els;
};

// ------------------------------------------------------------------ Local vs cloud table

const COLS: [string, string][] = [
  ['Your Model', 'On device'],
  ['Cloud A', 'API'],
  ['Cloud B', 'For reference'],
];
const FACTS: [string, string, [string, string, string]][] = [
  ['Works offline', 'No network needed', ['Yes', 'No', 'No']],
  ['Cost', 'Per 1M tokens', ['$0', '$3.00', '$15.00']],
  ['First word', 'Time to first token', ['90 ms', '420 ms', '610 ms']],
  ['Your data', 'Where prompts go', ['Stays', 'Sent', 'Sent']],
  ['Quality', 'Benchmark score', ['78.4', '81.0', '84.2']],
];

/** What local changes, row by row, with the local column outlined and a reference column on a card. */
const table: Layout = (x) => {
  const { b, H } = x;
  const m = b.pick(5, 6.5, 7);
  const ts = b.pick(4, 7, 8);
  const ty = b.pick(3.4, 6.5, 14);
  const els: ICElement[] = [
    b.text('title', b.f === 'x' ? m : 10, ty, b.f === 'x' ? 60 : 80, 'Local vs cloud', ts, {
      ...head(x),
      align: b.f === 'x' ? 'left' : 'center',
    }),
  ];
  const cx = b.pick([54, 70, 86], [52, 70, 88], [52, 70, 88]);
  const cw = b.pick(14.5, 17.6, 17.6);
  const top = ty + ts * 1.25 + b.pick(1.2, 5, 12);
  const headH = b.pick(6, 10.8, 13);
  const foot = H - b.pick(3, 5, 8);
  const rh = (foot - b.pick(3, 5, 8) - top - headH) / FACTS.length;
  const bottom = top + headH + FACTS.length * rh;
  const colH = bottom - top + rh * 0.12;
  els.push(
    b.rect(cx[2] - cw / 2, top, cw, colH, 'card', { radius: cw * 0.14 }),
    ...grouped([
      b.rect(cx[0] - cw / 2, top, cw, colH, 'accent', { op: 0.13, radius: cw * 0.14 }),
      b.rect(cx[0] - cw / 2, top, cw, colH, '', { line: 'accent', sw: 0.28, radius: cw * 0.14 }),
    ]),
  );
  const hs = b.pick(1.8, 2.8, 3.1);
  COLS.forEach(([n, sub], i) => {
    els.push(
      b.text(`col${i + 1}_name`, cx[i] - cw / 2, top + headH * 0.2, cw, n, hs, {
        ...head(x, i === 0 ? 700 : 500),
        align: 'center',
      }),
      b.text(`col${i + 1}_note`, cx[i] - cw / 2, top + headH * 0.2 + hs * 1.35, cw, sub, hs * 0.66, {
        ...body(x),
        tone: 'muted',
        align: 'center',
      }),
    );
  });
  const ns = b.pick(1.8, 2.9, 3.3);
  const vs = b.pick(2.3, 3.8, 4.4);
  FACTS.forEach(([n, sub, vals], r) => {
    const y = top + headH + r * rh;
    els.push(
      b.rect(m, y, 100 - 2 * m + 1, 0.16, 'ink', { op: 0.12 }),
      ...grouped([
        b.text(`row${r + 1}_name`, m, y + rh * 0.24, cx[0] - cw / 2 - m - 1, n, ns, head(x, 600)),
        b.text(`row${r + 1}_note`, m, y + rh * 0.24 + ns * 1.3, cx[0] - cw / 2 - m - 1, sub, ns * 0.68, {
          ...body(x),
          tone: 'muted',
        }),
        ...vals.map((v, i) =>
          b.text(`row${r + 1}_value${i + 1}`, cx[i] - cw / 2, y + rh / 2 - vs * 0.6, cw, v, i === 0 ? vs * 1.08 : vs, {
            ...head(x, i === 0 ? 700 : 400),
            align: 'center',
          }),
        ),
      ]),
    );
  });
  const lw = b.pick(11, 15, 18);
  els.push(
    b.text('source', m, foot, 60, 'Same prompts, same laptop, Sept 2026', b.pick(1.2, 1.8, 2.2), { ...body(x), tone: 'muted' }),
    logo(x, 100 - m - lw, foot - lw * 0.05, lw),
  );
  return els;
};

// ------------------------------------------------------------------ Head-to-head

/** One result as two big bars: a cloud API against the local model, with the multiplier and time. */
const versus: Layout = (x) => {
  const { b, H } = x;
  const m = b.pick(5, 6.5, 7);
  const ts = b.pick(4, 6.4, 7.4);
  const ty = b.pick(5, 8, 16);
  const wide = b.f === 'x';
  const els: ICElement[] = [
    b.text('title', m, ty, 100 - 2 * m, wide ? 'Two hours of audio in 22 seconds' : 'Two hours of audio\nin 22 seconds', ts, head(x)),
    b.text('subtitle', m, ty + ts * (wide ? 1.35 : 2.45), 100 - 2 * m, 'Same file, timed from the click. Local needs no upload and no account.', b.pick(1.7, 2.6, 3), {
      ...body(x),
      tone: 'muted',
    }),
  ];
  // Beside the bars in X; above them in a square and a story.
  const tx = wide ? 34 : m;
  const tw = 100 - m - tx;
  const th = b.pick(6.75, 10, 12);
  const rows = [
    { label: 'Cloud API', sub: 'Upload, queue and transcribe', v: 163, t: '44.2 s', ours: false },
    { label: '', sub: 'On-device GPU, offline', v: 323, t: '22.3 s', ours: true },
  ];
  const start = ty + ts * (wide ? 2.6 : 4) + b.pick(4, 6, 30);
  const step = b.pick(12, 24, 44);
  const ls = b.pick(2.5, 3.6, 4.2);
  const lw = b.pick(14, 20, 24);
  rows.forEach((r, i) => {
    const y = start + i * step;
    const by = wide ? y : y + ls * 2.8;
    const w = (r.v / (323 * 1.45)) * tw;
    const big = `${r.v}×`;
    const bs = th * 0.5;
    const vx = tx + w + 1.6;
    els.push(
      ...grouped([
        r.ours
          ? logo(x, m, y + (wide ? th * 0.12 : 0), lw)
          : b.text('rival', m, y + (wide ? th * 0.1 : 0), 30, r.label, ls, head(x, 600)),
        b.text(`row${i + 1}_note`, m, y + (wide ? th * 0.12 + ls * 1.35 : ls * 1.35), 40, r.sub, ls * 0.6, { ...body(x), tone: 'muted' }),
        b.rect(tx, by, tw, th, 'card', { radius: th * 0.17 }),
        b.rect(tx, by, w, th, r.ours ? 'accent' : 'muted', { op: r.ours ? 1 : 0.5, radius: th * 0.17 }),
        b.text(`row${i + 1}_speed`, vx, by + th / 2 - bs * 0.6, 14, big, bs, { ...head(x), tone: r.ours ? 'accent' : 'ink', wrap: false }),
        b.text(`row${i + 1}_time`, vx + textW(x, big, bs) + 1.2, by + th / 2 - bs * 0.32, 12, r.t, bs * 0.5, {
          ...body(x),
          tone: 'muted',
          wrap: false,
        }),
      ]),
    );
  });
  els.push(
    b.text('note', m, H - b.pick(4, 5.5, 8), 100 - 2 * m, 'Test file: 2:00:00 of speech on a laptop, Sept 2026. × is faster than real time.', b.pick(1.25, 1.9, 2.3), {
      ...body(x),
      tone: 'muted',
    }),
  );
  return els;
};

// ------------------------------------------------------------------ Templates

interface Family {
  key: string;
  title: string;
  first: Fmt;
  layout: Layout;
  /** A ranked list the person edits in the Items section: its setup and how long it may grow. */
  list?: { spec: string; min: number; max: number };
}

const FAMILIES: Family[] = [
  { key: 'leaderboard', title: 'Ranked leaderboard', first: 'sq', layout: leaderboard, list: { spec: '10@1', min: 3, max: 12 } },
  { key: 'columns', title: 'Column leaderboard', first: 'x', layout: columns, list: { spec: '12@6', min: 3, max: 16 } },
  { key: 'scatter', title: 'Quality vs cloud bill', first: 'x', layout: scatter },
  { key: 'table', title: 'Local vs cloud table', first: 'sq', layout: table },
  { key: 'versus', title: 'Head-to-head', first: 'x', layout: versus },
];

function template(kit: BrandKit, brand: string, fam: Family, spec = fam.list?.spec ?? ''): ICTemplate {
  const logoOf = kit.logo ? { url: kit.logo, ratio: kit.logoRatio } : SAMPLE_LOGO;
  const fmts = [fam.first, ...(['x', 'sq', 'st'] as Fmt[]).filter((f) => f !== fam.first)];
  const [[, base], ...rest] = fmts.map((f) => {
    const b = layerBuilder(HEIGHT[f], kit.roles, f);
    return [RATIO[f], renumber(nameParts(fam.layout({ b, H: HEIGHT[f], kit, logo: logoOf }, spec)))] as const;
  });
  const id = brand === 'acme' ? `bench-${fam.key}` : `bench-${brand}-${fam.key}`;
  return {
    id: fam.list && spec !== fam.list.spec ? `${id}~${spec}` : id,
    title: fam.title,
    pack: BENCH_PACK_NAME,
    brand,
    family: `bench-${fam.key}`,
    ratio: RATIO[fam.first],
    scene: false,
    scenePrompt: '',
    seed: 1,
    model: 'flux2-klein',
    thumb: kit.roles.bg,
    bg: brandBackground(kit),
    els: base,
    variants: Object.fromEntries(rest),
    source: null,
    kit,
    ...(fam.list ? { list: { shape: 'ranked' as const, spec, min: fam.list.min, max: fam.list.max } } : {}),
  };
}

export const BENCH_PACK_NAME = 'Benchmarks';

export const BENCH_PACK: ICTemplate[] = ANNOUNCE_BRANDS.flatMap((c) =>
  FAMILIES.map((fam) => template(c.kit, c.id, fam)),
);

const cache = new Map<string, ICTemplate>();

/** A benchmark list template with another item setup, built once per setup. */
export function benchWithSpec(t: ICTemplate, spec: string): ICTemplate {
  const fam = FAMILIES.find((f) => `bench-${f.key}` === t.family);
  const brand = ANNOUNCE_BRANDS.find((c) => c.id === t.brand);
  if (!fam?.list || !brand) return t;
  const key = `${brand.id}|${fam.key}|${spec}`;
  let built = cache.get(key);
  if (!built) {
    built = withCards(template(brand.kit, brand.id, fam, spec));
    cache.set(key, built);
  }
  return built;
}
