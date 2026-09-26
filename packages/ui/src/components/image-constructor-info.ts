// Info templates: numbers, charts, dated moments and report covers, in each built-in brand.
// Charts carry their own data, which the person edits or loads from a CSV or JSON file.

import {
  ANNOUNCE_BRANDS,
  layerBuilder,
  type LayerBuilder,
  renumber,
} from './image-constructor-announce.js';
import { rows } from './image-constructor-groups.js';
import { SAMPLE_LOGO } from './image-constructor-brand-builtin.js';
import { type BrandKit, brandBackground } from './image-constructor-brand-kit.js';
import { sampleData, seriesColors } from './image-constructor-charts.js';
import type { ICElement, ICRatio, ICTemplate } from './image-constructor-layout.js';

type Fmt = 'x' | 'sq' | 'st';
type B = LayerBuilder;

const HEIGHT: Record<Fmt, number> = { x: 56.25, sq: 100, st: (1920 / 1080) * 100 };
const FMTS: [Fmt, ICRatio][] = [
  ['x', 'x-post'],
  ['sq', '1:1'],
  ['st', 'story'],
];

interface Brand {
  id: string;
  kit: BrandKit;
  name: string;
  ticker: string;
  logo: { url: string; ratio: number };
}

const BRANDS: Brand[] = ANNOUNCE_BRANDS.map((b) => ({
  id: b.id,
  kit: b.kit,
  name:
    b.id === 'p2p'
      ? 'P2P Academy'
      : b.id === 'tether'
        ? 'Tether'
        : b.id === 'qvac'
          ? 'QVAC'
          : 'Your Brand',
  ticker:
    b.id === 'p2p' ? 'LESSONS' : b.id === 'tether' ? 'USDT' : b.id === 'qvac' ? 'MODELS' : 'BRAND',
  logo: b.kit.logo ? { url: b.kit.logo, ratio: b.kit.logoRatio } : SAMPLE_LOGO,
}));

interface Ctx {
  b: B;
  H: number;
  c: Brand;
  k: number;
}

type Layout = (x: Ctx) => ICElement[];

const MONO = { font: 'geist-mono' as const, weight: 500, track: 0.18 };
const SERIF = { font: 'serif' as const, weight: 500, track: -0.01, lh: 1.05 };

const logo = (x: Ctx, lx: number, ly: number, lw: number) =>
  x.b.image('logo', lx, ly, lw, x.c.logo.url, x.c.logo.ratio);

const heading = (x: Ctx) => ({ font: x.c.kit.fonts.heading, weight: 700, track: -0.03, lh: 1.05 });

// ------------------------------------------------------------------ Info

/** A big number with its ticker, a stack of coins, and two side panels: the date and a second stat. */
const reserve: Layout = (x) => {
  const { b, H, c, k } = x;
  const tall = b.f === 'st';
  const rw = b.pick(30, 28, 0);
  const size = b.pick(9.6, 11, 12);
  const tick = b.pick(13, 15.5, 18);
  const top = b.pick(5, 6, 26);
  const w = 100 - rw - 8;
  const panel = (
    px: number,
    py: number,
    pw: number,
    ph: number,
    fill: 'accent' | 'panel',
    big: string,
    small: string,
  ) => {
    const bs = b.pick(4.4, 4.6, 5.6);
    const ss = b.pick(1.8, 2.2, 2.6);
    const tone = fill === 'accent' ? 'onAccent' : 'ink';
    const cy = py + ph / 2 - (bs * 1.1 + ss * 2) / 2;
    return [
      b.rect(px, py, pw, ph, fill),
      b.text(fill === 'accent' ? 'period' : 'stat', px + 2, cy, pw - 4, big, bs, {
        ...heading(x),
        tone,
        align: 'center',
      }),
      b.text(
        fill === 'accent' ? 'period_label' : 'stat_label',
        px + 2,
        cy + bs * 1.25,
        pw - 4,
        small,
        ss,
        {
          ...MONO,
          tone: fill === 'accent' ? 'onAccent' : 'muted',
          align: 'center',
          lh: 1.3,
        },
      ),
    ];
  };
  const coins = b.pick<[number, number, number]>([6, 30, 30], [6, 48, 50], [25, 62, 50]);
  return [
    b.art('coin-stack', ...coins, { op: 0.9 }),
    b.text(
      'amount',
      5,
      top,
      w,
      c.id === 'p2p'
        ? '52,480'
        : c.id === 'tether'
          ? '140.2B'
          : c.id === 'qvac'
            ? '1,248,300'
            : '5,673,707',
      size,
      {
        ...heading(x),
        weight: 500,
        track: -0.04,
        lh: 1,
      },
    ),
    b.text('ticker', 5, top + size * 1.02, w, c.ticker, tick, {
      ...heading(x),
      weight: 800,
      track: -0.05,
      lh: 0.95,
    }),
    b.text(
      'amount_label',
      5,
      top + size * 1.02 + tick * 1.05 + 2 * k,
      w,
      c.id === 'p2p'
        ? 'LESSONS FINISHED'
        : c.id === 'qvac'
          ? 'MODELS SHIPPED'
          : 'CURRENT RESERVE SIZE',
      b.pick(1.9, 2.4, 3),
      {
        ...MONO,
        tone: 'muted',
      },
    ),
    ...(tall
      ? [
          ...panel(8, 116, 41, 30, 'accent', 'AUG 2026', 'RESERVE\nUPDATE'),
          ...panel(51, 116, 41, 30, 'panel', '$4.4M+', 'USD VALUE\nOF INFLOW'),
        ]
      : [
          ...panel(100 - rw, 0, rw, H * 0.42, 'accent', 'AUG 2026', 'RESERVE\nUPDATE'),
          ...panel(100 - rw, H * 0.42, rw, H * 0.58, 'panel', '$4.4M+', 'USD VALUE\nOF INFLOW'),
        ]),
  ];
};

const ICONS = ['coin', 'bitcoin', 'tether-coin', 'hexagon', 'chain', 'atom', 'wallet', 'shield'];

/** A headline number and a line chart with milestone dots, over a row of ecosystem icons. */
const volume: Layout = (x) => {
  const { b } = x;
  const [tx, ty, ts] = b.pick<[number, number, number]>([5, 6, 7], [6, 6, 9], [8, 26, 10]);
  const [cx, cy, cw] = b.pick<[number, number, number]>([40, 3, 58], [4, 32, 92], [4, 58, 92]);
  const [iy, is, gap] = b.pick<[number, number, number]>(
    [45, 4.6, 7.4],
    [91, 5.4, 11.4],
    [120, 6, 11.4],
  );
  const [ix, count] = b.pick<[number, number]>([41, 8], [6, 8], [6, 8]);
  return [
    b.text('number', tx, ty, 60, '$300B', ts, { ...heading(x), weight: 700, track: -0.04 }),
    b.text(
      'headline',
      tx,
      ty + ts * 1.1,
      b.pick(36, 60, 60),
      'Lifetime\ntransaction volume',
      ts * b.pick(0.46, 0.55, 0.55),
      {
        ...heading(x),
        weight: 500,
        tone: 'muted',
      },
    ),
    logo(x, b.pick(5, 76, 72), b.pick(46, 7, 27), b.pick(16, 18, 20)),
    b.art('chart-line', cx, cy, cw, { data: { ...sampleData('chart-line') } }),
    ...ICONS.slice(0, count).map((icon, i) => b.art(icon, ix + i * gap, iy, is)),
  ];
};

/** A big caps headline over a glowing line that climbs to a lit point, with the logo below. */
const growth: Layout = (x) => {
  const { b, H, c } = x;
  const glow = b.pick(90, 110, 160);
  return [
    b.art('glow', -glow * 0.35, H - glow * 0.7, glow, { op: 0.5, lock: true }),
    b.text(
      'headline',
      b.pick(20, 6, 6),
      b.pick(4, 8, 27),
      b.pick(60, 88, 88),
      `${c.name.toUpperCase()} TVL\nCROSSES $4.6B`,
      b.pick(4.6, 7.4, 8),
      {
        ...heading(x),
        weight: 800,
        track: -0.02,
        align: 'center',
      },
    ),
    b.art(
      'chart-glow',
      ...b.pick<[number, number, number]>([18, 16.5, 64], [6, 26, 88], [4, 50, 92]),
      {
        data: sampleData('chart-glow'),
      },
    ),
    logo(x, ...b.pick<[number, number, number]>([5, 5, 14], [41, 88, 18], [37, 118, 26])),
  ];
};

/** A stacked area chart with a two-line title, a legend in the chart's own colors, and a source line. */
const breakdown: Layout = (x) => {
  const { b, c } = x;
  const data = sampleData('chart-area');
  const r = c.kit.roles;
  const colors = seriesColors(data.series.length, r.accent, r.muted, r.ink);
  const [tx, ty, ts, tw] = b.pick<[number, number, number, number]>(
    [5, 5, 4.6, 44],
    [6, 6, 6.6, 70],
    [8, 26, 7, 64],
  );
  const [lx, ly, ls, cols, lgap, lcol] = b.pick<[number, number, number, number, number, number]>(
    [5, 27, 2.2, 1, 4, 0],
    [6, 87, 2.6, 3, 4, 30],
    [8, 112, 3.2, 2, 5.4, 44],
  );
  const legend = rows(data.series, (s, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const px = lx + col * lcol;
    const py = ly + row * lgap;
    return [
      b.rect(px, py + ls * 0.15, ls * 0.9, ls * 0.9, '', {
        fill: colors[i],
        radius: ls * 0.15,
        pal: {},
      }),
      b.text(`series_${i + 1}`, px + ls * 1.5, py, 26, s.name, ls, { weight: 500, lh: 1.1 }),
    ];
  });
  return [
    b.text('headline', tx, ty, tw, 'Tokenized assets\ntop $35B', ts, heading(x)),
    b.text('subtitle', tx, ty + ts * 2.25, tw, 'Tokenized value by category ($B)', ts * 0.5, {
      tone: 'muted',
    }),
    b.art(
      'chart-area',
      ...b.pick<[number, number, number]>([46, 4, 52], [4, 28, 92], [4, 50, 92]),
      { data },
    ),
    ...legend,
    b.text(
      'source',
      ...b.pick<[number, number]>([5, 50.5], [6, 96.5], [8, 138]),
      b.pick(38, 60, 60),
      'Source: your data. Sample figures.',
      b.pick(1.8, 2.2, 2.8),
      {
        tone: 'muted',
      },
    ),
    logo(x, ...b.pick<[number, number, number]>([84, 48, 12], [80, 6, 14], [74, 26, 18])),
  ];
};

/** Two pyramids side by side, one upside down: how the balance changed between two years. */
const compare: Layout = (x) => {
  const { b } = x;
  const [tx, ty, ts] = b.pick<[number, number, number]>([5, 4, 5.4], [6, 6, 8], [8, 26, 8.6]);
  const [yy, ys, cy, cs, ay, aw, ls] = b.pick<
    [number, number, number, number, number, number, number]
  >([13, 4.2, 18, 2.2, 22, 26, 2.6], [20, 6.4, 28, 3, 35, 40, 4], [42, 7, 51, 3.4, 58, 40, 4]);
  const col = (
    cx: number,
    year: string,
    caption: string,
    art: 'pyramid-down' | 'pyramid-up',
    label: string,
    note: string,
  ) => {
    const ah = aw / 1.2;
    const labelY = art === 'pyramid-down' ? ay + ah * 0.18 : ay + ah * 0.55;
    return [
      b.text('year', cx - 20, yy, 40, year, ys, {
        ...heading(x),
        weight: 800,
        tone: 'accent',
        align: 'center',
      }),
      b.text('caption', cx - 20, cy, 40, caption, cs, { tone: 'muted', align: 'center' }),
      b.art(art, cx - aw / 2, ay, aw),
      b.text('label', cx - aw * 0.3, labelY, aw * 0.6, label, ls, {
        ...heading(x),
        tone: 'onAccent',
        align: 'center',
        lh: 1.1,
      }),
      b.text('note', cx - 20, ay + ah + ls * 0.8, 40, note, cs, { tone: 'muted', align: 'center' }),
    ];
  };
  return [
    b.text('headline', tx, ty, 88, 'The ratio flipped', ts, heading(x)),
    ...col(b.pick(28, 27, 27), '2021', 'top-heavy', 'pyramid-down', 'Hype\n80%', 'Proof 20%'),
    ...col(b.pick(72, 73, 73), '2026', 'grounded', 'pyramid-up', 'Proof\n80%', 'Hype 20%'),
  ];
};

// ------------------------------------------------------------------ On this day

/** Height of the "On this day" box. */
const badgeH = (b: B) => b.pick(2.4, 3.2, 3.6) * 2.2;

/** Where a headline starts below the badge at `y`, with room between them. */
const belowBadge = (b: B, y: number) => y + badgeH(b) + b.pick(3, 4.5, 5.5);

/** "On this day" in an outlined box, centered at the top. */
function badge(x: Ctx, y: number, text: string) {
  const { b } = x;
  const size = b.pick(2.4, 3.2, 3.6);
  const w = size * 0.56 * text.length + size * 3;
  const h = size * 2.2;
  return [
    b.rect(50 - w / 2, y, w, h, 'card', { line: 'accent', sw: 0.25 }),
    b.text('badge', 50 - w / 2, y + (h - size * 1.15) / 2, w, text, size, {
      weight: 500,
      align: 'center',
    }),
  ];
}

/** Two coin grids on a timeline: what a reward was, and what it became. */
const coinGrids: Layout = (x) => {
  const { b } = x;
  const [by, ts] = b.pick<[number, number]>([3, 5.2], [5, 8], [27, 8.6]);
  const ty = belowBadge(b, by);
  const [gw, base, lx, rx] = b.pick<[number, number, number, number]>(
    [11, 46, 32, 57],
    [18, 76, 26, 56],
    [30, 130, 16, 54],
  );
  const labels = (cx: number, year: string, amount: string) => [
    b.rect(cx - 0.8, base + 0.35, 1.6, 1.6, 'accent', { radius: 0.8 }),
    b.text('year', cx - 15, base + b.pick(2.6, 4, 5), 30, year, b.pick(2.6, 3.6, 4), {
      ...heading(x),
      align: 'center',
    }),
    b.text('amount', cx - 15, base + b.pick(5.8, 8.6, 10.2), 30, amount, b.pick(2.2, 3.2, 3.6), {
      tone: 'muted',
      align: 'center',
    }),
  ];
  return [
    ...badge(x, by, 'On this day: 11 years ago'),
    b.text('headline', 5, ty, 90, b.f === 'x' ? 'The first halving' : 'The first\nhalving', ts, {
      ...SERIF,
      align: 'center',
    }),
    b.art('coins-5-50', lx, base - gw * 2, gw),
    b.art('coins-5-25', rx, base - gw, gw),
    b.rect(0, base + 1, 100, 0.2, 'muted'),
    ...labels(lx + gw / 2, '2011', '50 coins'),
    ...labels(rx + gw / 2, '2015', '25 coins'),
  ];
};

/** Two chains merging into one at a coin, with a label on each lane. */
const merge: Layout = (x) => {
  const { b, H } = x;
  const [by, ts] = b.pick<[number, number]>([3, 5], [5, 7.4], [27, 8]);
  const ty = belowBadge(b, by);
  const [lx, ly, lw] = b.pick<[number, number, number]>([32, 21.5, 68], [0, 40, 100], [0, 72, 100]);
  const lh = lw / 2;
  const coin = b.pick(7, 13, 15);
  const cx = lx + lw * 0.57;
  const cy = ly + lh * 0.52;
  const small = b.pick(2.4, 3.4, 3.8);
  return [
    ...badge(x, by, 'On this day: 4 years ago'),
    b.text(
      'headline',
      5,
      ty,
      90,
      b.f === 'x' ? 'We completed the upgrade' : 'We completed\nthe upgrade',
      ts,
      { ...SERIF, align: 'center' },
    ),
    b.art('lanes', lx, ly, lw),
    b.art('coin', cx - coin / 2, cy - coin / 2, coin),
    b.text('new_lane', lx + lw * 0.64, ly - small * 0.4, 34, 'New chain\nProof-of-stake', small, {
      weight: 600,
      lh: 1.25,
    }),
    // Under the old lane, but never closer to the bottom than the page margin.
    b.text(
      'old_lane',
      5,
      Math.min(ly + lh * 0.82, H - b.pick(5, 7, 34) - small * 2.5),
      40,
      'Old chain\nProof-of-work',
      small,
      {
        weight: 600,
        lh: 1.25,
      },
    ),
    b.text('moment', cx + coin * 0.7, cy - small * 0.6, 30, 'The upgrade', small, {
      weight: 700,
      tone: 'accent',
    }),
  ];
};

const HALVINGS: [year: string, reward: string, count: number][] = [
  ['2009', '50', 50],
  ['2012', '25', 25],
  ['2016', '12.5', 12],
  ['2020', '6.25', 6],
  ['2024', '3.125', 3],
];

/** Each halving as a column of coins shrinking left to right, with one column picked out. */
const halvings: Layout = (x) => {
  const { b } = x;
  const [ty, ts] = b.pick<[number, number]>([3.5, 4.6], [6, 7], [27, 8]);
  const [cw, base, ns, ys] = b.pick<[number, number, number, number]>(
    [8, 47, 2.6, 2.6],
    [13, 82, 3.6, 3.6],
    [14.5, 128, 4, 4],
  );
  const centers = [14, 32, 50, 68, 86];
  const pick = 2;
  return [
    b.text('headline', 5, ty, 90, 'The second\nhalving', ts, { ...SERIF, align: 'center' }),
    ...rows(HALVINGS, ([year, reward, count], i) => {
      const rows = Math.ceil(count / 4);
      const h = (cw * rows) / 4;
      const left = centers[i] - cw / 2;
      const on = i === pick;
      return [
        ...(on
          ? [
              b.rect(left - cw * 0.3, base - h - ns * 2.4, cw * 1.6, h + ns * 2.4 + ys * 2.4, '', {
                line: 'accent',
                sw: 0.25,
                radius: 1.5,
              }),
            ]
          : []),
        b.text(`reward_${i + 1}`, centers[i] - 10, base - h - ns * 1.6, 20, reward, ns, {
          tone: on ? 'ink' : 'muted',
          align: 'center',
        }),
        b.art(`coins-4-${count}`, left, base - h, cw, { op: on ? 1 : 0.6 }),
        b.text(`year_${i + 1}`, centers[i] - 10, base + ys * 0.5, 20, year, ys, {
          ...heading(x),
          tone: on ? 'ink' : 'muted',
          align: 'center',
        }),
      ];
    }),
  ];
};

// ------------------------------------------------------------------ Report

/** A report cover: a thin frame, light streaks, the logo, a big serif title, the period and a byline. */
const report: Layout = (x) => {
  const { b, H, c } = x;
  const inset = 3;
  const w = Math.max(100, H);
  const [lx, ly, lw] = b.pick<[number, number, number]>([7, 7, 16], [8, 8, 22], [8, 27, 24]);
  const [ty, ts] = b.pick<[number, number]>([15, 10.4], [28, 16], [56, 17]);
  // The title, period and logo share one left edge.
  const tx = lx;
  const [py, pw] = b.pick<[number, number]>(
    [ty + ts * 2.05, 50],
    [ty + ts * 2.05, 70],
    [ty + ts * 2.05, 80],
  );
  return [
    b.art('streaks', 50 - w / 2, 0, w, { lock: true }),
    b.rect(inset, inset, 100 - inset * 2, H - inset * 2, '', { line: 'ink', sw: 0.18, op: 0.6 }),
    logo(x, lx, ly, lw),
    b.text('headline', tx, ty, 84, 'Signals\nReport', ts, { ...SERIF, weight: 400, lh: 0.95 }),
    b.text('period', tx, py, pw, 'Q3 2026', b.pick(3.8, 5, 5.6), {
      ...heading(x),
      weight: 700,
      track: 0.08,
    }),
    b.text(
      'byline',
      100 - 8 - 70,
      H - b.pick(8, 9, 34),
      70,
      `By ${c.name} Research`,
      b.pick(2.2, 3, 3.4),
      {
        tone: 'muted',
        align: 'right',
      },
    ),
  ];
};

// ------------------------------------------------------------------ Templates

const PACKS: [pack: string, key: string, title: string, layout: Layout][] = [
  ['Info', 'reserve', 'Reserve update', reserve],
  ['Info', 'volume', 'Line chart', volume],
  ['Info', 'growth', 'Growth chart', growth],
  ['Info', 'breakdown', 'Stacked chart', breakdown],
  ['Info', 'compare', 'Comparison', compare],
  ['Info', 'coin-grids', 'Coin grids', coinGrids],
  ['Info', 'merge', 'Merge', merge],
  ['Info', 'halvings', 'Halvings', halvings],
  ['Info', 'report', 'Report cover', report],
];

function template(c: Brand, pack: string, key: string, title: string, layout: Layout): ICTemplate {
  const [[, base], ...rest] = FMTS.map(([f, ratio]) => {
    const b = layerBuilder(HEIGHT[f], c.kit.roles, f);
    return [ratio, renumber(layout({ b, H: HEIGHT[f], c, k: b.pick(0.62, 1, 1.12) }))] as const;
  });
  const bg = brandBackground(c.kit);
  return {
    id: c.id === 'acme' ? `info-${key}` : `info-${c.id}-${key}`,
    title,
    pack,
    brand: c.id,
    family: key,
    ratio: 'x-post',
    scene: false,
    scenePrompt: '',
    seed: 1,
    model: 'flux2-klein',
    thumb: c.kit.roles.bg,
    bg,
    els: base,
    variants: Object.fromEntries(rest),
    source: null,
    kit: c.kit,
  };
}

export const INFO_PACK: ICTemplate[] = BRANDS.flatMap((c) =>
  PACKS.map(([pack, key, title, layout]) => template(c, pack, key, title, layout)),
);
